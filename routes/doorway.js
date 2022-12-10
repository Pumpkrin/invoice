const express = require('express');
const router = express.Router();
const crypto_m = require('node:crypto');
const webcrypto_m = crypto_m.webcrypto;
const { Buffer: buffer_m} = require('node:buffer');
const {body, validationResult: validation_result} = require('express-validator');
const multer_m = require('multer');
const cbor_m = require('cbor');
const asn1_m = require('@lapo/asn1js');
const util_m = require('node:util');

const session_id_m = require('../misc/session_id');
const {generate_avatar} = require('../misc/avatar');

const {credential_record_model, user_model} = require('../models/user');
const server_configuration = {
  scheme: 'https',
  host: process.env.HOST ? 'invoice.up.railway.app' : 'localhost',
  port: process.env.PORT ?? 3000,
  serialize(){ 
    return process.env.PORT ?
      this.scheme + '://' + this.host :
      this.scheme + '://' + this.host + ':' + this.port;
  }
};

const user_doorway = [
  multer_m().none(),
  body('user')
    .trim()
    .isAlphanumeric()
    .withMessage("The given username contains non-alphanumeric characters"),
  clear_issued_challenges,
  (request, response, next) => {
    const result = validation_result( request );
    if( result.errors.length > 0 ){
      return next( new Error( result.errors[0].msg ) )
    }
    next('route');
  },
];

let issued_challenges = [];

function clear_issued_challenges( request, response, next ){
  const issued_challenge=issued_challenges.find( entry => entry.user === request.body.user );
  if( issued_challenge ){ 
    issued_challenges.splice(
      issued_challenges.findIndex( entry => entry.user === request.body.user ),
      1
    );
  }
  next();
}

const key_parameters = [{
  type: 'public-key',
  alg: -7
  },
//        }, {
//          type: 'public-key',
//          alg: -257
];

const send_registration_options = [ 
(request, response, next) => {request.body.sign_type === 'sign_up' ? next() : next('route')},
(request, response, next) => {
  user_model.find({ 'name': request.body.user }).then( user => {
    return user.length > 0 ? 
      next( new Error('A user with the given username already exist: either sign in or use a different username' ) ):
      next();
  });
}, 
function send_registration_options(request, response) {
    const challenge = webcrypto_m.getRandomValues( new Uint8Array(32) );
    issued_challenges.push( {
      user: request.body.user,
      challenge: Buffer.from(challenge).toString('base64url'),
    });

    const options = {
      required_action: 'registration',
      public_key: {
        rp: {
          id: server_configuration.host,
          name: 'invoice'
        },
        user: {
          name: request.body.user
        },
        pubKeyCredParams: key_parameters,
        attestation: 'indirect', 
        authenticatorSelection:{
          requireResidentKey: false,
          residentKey: 'preferred',
          userVerification: 'required'
        },
        timeout: 60000,
        challenge: Buffer.from(challenge).toString('base64') 
      }
    };
    response.send( options );
},
];

const send_authentication_options = [
(request, response, next) => {
  return request.body.sign_type === 'sign_in' ? next() : next('route')
},
(request, response, next) => {
  user_model.find({ 'name': request.body.user }).then( user => {
    return user.length > 0 ? 
      next():
      next( new Error('No user with the given username was found: please sign up' ) );
  });
}, 
function send_authentication_options( request, response) {
  const challenge = webcrypto_m.getRandomValues( new Uint8Array(32) );
  issued_challenges.push( {
    user: request.body.user,
    challenge: Buffer.from(challenge).toString('base64url'),
  });
  let user;
  user_model.findOne({'name': request.body.user}).populate('credential_record')
    .then( found_user => {
      user = found_user;
      const options = {
        required_action: 'authentication',
          public_key: {
          allowCredentials: [ {
            id: user.id,
            transports: user.credential_record.transports,
            type: user.credential_record.type 
          } ],
          user: {
            name: user.name
          },
          rpId: server_configuration.host,
          timeout: 60000,
          userVerification: 'required',
          challenge: Buffer.from(challenge).toString('base64') 
        }
      };
      response.send( options );
    });
},
];

function apply_property_chain( target, property_chain ) {
  return property_chain.reduce( (target, property) => target[property], target ); 
}

function check_client_data(type, request, response, next ) {
  const client_data = request.body.authenticator_response.client_data
  const client_data_JSON = JSON.parse( client_data.toString('utf8') );
  if( client_data_JSON.type !== type ){ 
    return next( failure_error() );
  }

  const issued_challenge = issued_challenges.splice(
    issued_challenges.findIndex( entry => entry.user === body.user ),
    1
  ).reduce( () => {} );
  if(issued_challenge.challenge !== client_data_JSON.challenge){
    return next( failure_error() );
  }
  
  if( client_data_JSON.origin !== server_configuration.serialize()){
    return next( failure_error() );
  }
  next();
}

function check_hash(property_chain, request, response, next) {
  const data = apply_property_chain(request.body.authenticator_response, property_chain);
    
  const hash = new crypto_m.createHash('sha256')
    .update( server_configuration.host )
    .digest(); 
  if( hash.compare( data, 0, 32 ) ){
    return next( failure_error() );
  }
  next();
}

function extract_flags(options, request, response, next ){
  const data = apply_property_chain(request.body.authenticator_response, options.extraction_chain);
  function check_bit( flags, shift ) {
    return (flags & (1 << shift)) !== 0 ? true : false;
  }
  const flags = data.readUInt8( 32 );
  const save_anchor = apply_property_chain( request.body.authenticator_response, options.save_chain );
  save_anchor[options.save_point] = {
    user_presence: check_bit( flags, 0 ),
    user_verification: check_bit( flags, 2 ),
    credential_data: check_bit( flags, 6 ),
    extensions: check_bit( flags, 7 )
  };
  next();
}

function extract_signature_count(options, request, response, next){
  const extraction_point = apply_property_chain(
    request.body.authenticator_response,
    options.extraction_chain
  );
  const signature_count = extraction_point.readUInt32BE( 33 );
  const save_anchor = apply_property_chain(
    request.body.authenticator_response,
    options.save_chain
  );
  save_anchor[options.save_point] = signature_count;
  next();
}

function extract_oid( certificate, oid ){
  const asn1_structure = asn1_m.decode( certificate.raw );

}

const attestation_formats = [{
  format:'packed',
  signature_verification(request, response, next){
    const attestation = request.body.authenticator_response.attestation;
    if( attestation.credential_data.public_key.get(3) !== 
        attestation.attStmt.alg ){
      return next( failure_error() )
    }
    
    const hash = crypto_m.createHash('sha256')
      .update(request.body.authenticator_response.client_data).digest();
    const valid_signature = crypto_m.createVerify( 'sha256' )
             .update( Buffer.concat([attestation.authData, hash]) )
             .verify(
               crypto_m.createPublicKey(attestation.credential_data.jwk_key), 
               attestation.attStmt.sig
             ); 
    if( !valid_signature ){
      return next( failure_error() )
    }

    attestation.type= 'self';
    return next();
  }
},{
  format:'none',
  signature_verification(request, response, next){
    const attestation = request.body.authenticator_response.attestation;
    attestation.type= 'none';
    return next();
  }
},{
  format: 'apple',
  signature_verification(request, response, next){
    console.log('apple_signature_verification');
    const attestation = request.body.authenticator_response.attestation;
    const hash = crypto_m.createHash('sha256')
      .update(request.body.authenticator_response.client_data).digest();
    const expected_nonce = crypto_m.createHash('sha256')
      .update( Buffer.concat([attestation.authData, hash]) ).digest();
    const certificate = new crypto_m.X509Certificate( attestation.attStmt.x5c[0] );
    const retrieved_nonce = extract_oid( certificate, '1.2.840.113635.100.8.2' );
    if( Buffer.compare( expected_nonce, retrieved_nonce ) !== 0 ){
      console.log('nonce comparison was not successful');
      return next( failure_error() );
    }
    console.log('nonce compared successfuly');
    if( x5c.verify(crypto_m.createPublicKey(attestation.credental_data.jwk_key)) ){ 
      console.log(`verify did not work`);
      return next( failure_error() );
    }
    next();
  }
}];
function allow_access( request, response ){
  const session = session_id_m.add_session( request.body.user ); 
  response.setHeader('Set-Cookie', [
    `session=${session.id};Secure; HttpOnly; Path=/; SameSite=Strict`,
    `user=${session.user};Secure; HttpOnly; Path=/; SameSite=Strict`, 
  ]);
  user_model.findOne({'name': request.body.user}, '-_id avatar discussions')
    .populate('discussions', '-_id users')
    .then( user => response.send(user) ); 
}

function failure_error(){
  return new Error('Something went wrong with the connection procedure: please try again later')
}
function supported_error(){
 return new Error('The device used to connect is not currently supported by invoice'); 
}

const registration_ceremony = [
  express.json(),
  function( request, response, next ){ console.log('a:express.json()'); next(); },
  function( request, response, next ){ console.log(request.body); next(); },
  function decode_response( request, response, next ) { 
    request.body.authenticator_response.attestation = 
      Buffer.from( request.body.authenticator_response.attestation, 'base64');
    request.body.authenticator_response.client_data =
      Buffer.from( request.body.authenticator_response.client_data, 'base64');
    next()
  },
  function( request, response, next ){ console.log('a:decode_response'); next(); },
  check_client_data.bind(null, 'webauthn.create'),
  function( request, response, next ){ console.log('a:check_client_response'); next(); },
  function decode_attestation( request, response, next ) {
    const attestation = request.body.authenticator_response.attestation;
    cbor_m.decodeFirst(attestation).then( attestation => {
      request.body.authenticator_response.attestation = attestation;
      next();
    }).catch( rejection_reason => 
      next( failure_error() )
    );
  },    
  function( request, response, next ){ console.log('a:decode_attestation'); next(); },
  check_hash.bind(null, ['attestation','authData']),
  function( request, response, next ){ console.log('a:check_hash'); next(); },
  extract_flags.bind(
    null, 
    {
      extraction_chain: ['attestation', 'authData'],
      save_chain: ['attestation'],
      save_point: 'flags'
    }
  ),
  function( request, response, next ){ console.log('a:extract_flags'); next(); },
  function check_flags( request, response, next ){
    const attestation = request.body.authenticator_response.attestation;
    //TODO: arguably, unsupported not failure ?
    if( !attestation.flags.user_presence ){return next( failure_error() );}
    if( !attestation.flags.user_verification ){return next( failure_error() );}
    if( !attestation.flags.credential_data ){return next( failure_error() );}
    next();
  },
  function( request, response, next ){ console.log('a:check_flags'); next(); },
  extract_signature_count.bind(null, {
    extraction_chain: ['attestation', 'authData'],
    save_chain: ['attestation'],
    save_point: 'signature_count' 
  }),
  function( request, response, next ){ console.log('a:extract_signature_count'); next(); },
  function extract_and_check_id( request, response, next ){
    const attestation = request.body.authenticator_response.attestation;
    const credential_data = attestation.authData.subarray(37);
    attestation.credential_data = {
      id_length: credential_data.readUint16BE( 16 ),
    };
    if( attestation.credential_data.id_length > 1023 ){
      return next( failure_error() )
    }
    attestation.credential_data.id = credential_data.subarray(
      18, 
      18 + attestation.credential_data.id_length
    );
    next();
  },
  function( request, response, next ){ console.log('a:extract_id'); next(); },
  function extract_public_key_and_extensions( request, response, next){
    const attestation = request.body.authenticator_response.attestation;
    const credential_data = attestation.authData.subarray(37);
    const remainder = credential_data.subarray( 18 + attestation.credential_data.id_length );
    cbor_m.decodeAll( remainder ).then( result => {
      attestation.credential_data.public_key = result[0];
      if( attestation.flags.extensions ){ 
        attestation.credential_data.extensions = result[1];
      }
      next();
    }).catch( rejection_reason => 
      next( failure_error() )
    );
  },
  function( request, response, next ){ console.log('a:extract_public_key'); next(); },
  function check_attestation( request, response, next ) {
    const attestation = request.body.authenticator_response.attestation;
    if( !key_parameters.some( entry => attestation.credential_data.public_key.get(3) === entry.alg ) ){
      return next( supported_error() );
    }

    const supported_format = 
      attestation_formats.find(({format}) => attestation.fmt === format ); 
    if( !supported_format ){
      return next( supported_error() );
    }
    attestation.signature_verification = supported_format.signature_verification;

    next();
  }, 
  function( request, response, next ){ console.log('a:check_attestation'); next(); },
  function register_key_jwk( request, response, next ) {
    const attestation = request.body.authenticator_response.attestation;
    //TODO: algorithm based
    attestation.credential_data.jwk_key = { key: {
      kty: 'EC',
      crv: 'P-256',
      x: attestation.credential_data.public_key.get(-2).toString('base64url'), 
      y: attestation.credential_data.public_key.get(-3).toString('base64url') 
    },
      format: 'jwk'
    };
    next();
  },
  function( request, response, next ){ console.log('a:register_key'); next(); },
  function verification_procedure( request, response, next) {
    const attestation = request.body.authenticator_response.attestation;
    return attestation.signature_verification( request, response, next);
  },
  function( request, response, next ){ console.log('a:verification_procedure'); next(); },
  function check_signature_trustworthiness( request, response, next ){
    //REFLECT: since there is no need to check for certificate, here any error would be catched before
    next();
  },
//  function check_user_existence( request, response, next ){
//    if( users.some( user => user.id === request.raw_id ) ){
//      next( new Error('Something went wrong with the connection procedure: please try again later') );
//    }
//    next();
//  },
  function( request, response, next ){ console.log('a:check_sigtrust'); next(); },
  function register_user( request, response, next ){
    const user = new user_model({
      name: request.body.user,
      id: request.body.raw_id,
      avatar: generate_avatar(),
      discussions: []
    });
    const record = new credential_record_model({
      type: request.body.type,
      public_key: request.body.authenticator_response.attestation.credential_data.jwk_key,
      sign_count: request.body.authenticator_response.attestation.signature_count,
      transports: request.body.authenticator_response.transports,
    });
    user.credential_record = record._id;
    record.user = user._id;
    user.save()
      .then( () => record.save() )
      .then( () => next() )
      .catch(console.error); 
  },
  function( request, response, next ){ console.log('a:register_user'); next(); },
  allow_access
];

let counter = 0;
const authentication_ceremony = [
  express.json(),
//  function( request, response, next ){ console.log(request.body); next(); },
  function decode_response( request, response, next ) { 
    const authenticator_response = request.body.authenticator_response;
    authenticator_response.data = Buffer.from( authenticator_response.data, 'base64');
    authenticator_response.client_data = Buffer.from( authenticator_response.client_data, 'base64');
    authenticator_response.signature = Buffer.from( authenticator_response.signature, 'base64');
    authenticator_response.user_handle = Buffer.from( authenticator_response.user_handle, 'base64');
    next()
  },
  function user_identification( request, response, next ) {
    user_model.findOne( {'name': request.body.user} ).populate('credential_record')
      .then( user => {
        if( user.id !== request.body.raw_id ){
          return next( failure_error() )
        }
        request.body.credential_record = user.credential_record;
        next();
    });
  },
  check_client_data.bind(null, 'webauthn.get'),
  check_hash.bind(null, ['data']),
  extract_flags.bind(null, {
    extraction_chain: ['data'],
    save_chain: [],
    save_point: 'flags'
  }),
  function check_flags( request, response, next ){
    const authenticator_response = request.body.authenticator_response;
    if( !authenticator_response.flags.user_presence ){return next( failure_error() );}
    if( !authenticator_response.flags.user_verification ){return next( failure_error() );}
    next();
  },
  function signature_validation( request, response, next) {
    const authenticator_response = request.body.authenticator_response;
    
    const hash = crypto_m.createHash('sha256')
      .update(request.body.authenticator_response.client_data).digest();
    const valid_signature = crypto_m.createVerify( 'sha256' )
                   .update( Buffer.concat([authenticator_response.data, hash]) )
                   .verify( 
                     crypto_m.createPublicKey(request.body.credential_record.public_key),
                     authenticator_response.signature
                   ); 
    if( !valid_signature ){
      return next( failure_error() )
    }
    next();
  },
  function update_signature_count( request, response, next ){
    const record = request.body.credential_record; 
    const signature_count = request.body.authenticator_response.signature_count;
    if( 
      (signature_count != 0 || record.signature_count != 0) &&
      signature_count <= record.signature_count 
    ){
      return next( failure_error() )
    }
    next();
  },
  allow_access
];

router.post('/', user_doorway); 
router.post('/', send_authentication_options);
router.post('/', send_registration_options);
router.post('/registration_ceremony', registration_ceremony); 
router.post('/authentication_ceremony', authentication_ceremony); 
router.use((error, request, response, next) => {
  console.log(error.message);
  response.status(400);
  response.send({error: error.message});
});
module.exports = router;
