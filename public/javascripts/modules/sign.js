import './avatar.js';
import {load_home} from './home.js';

let user;
const form = document.querySelector('[data-type="connection_form"]'); 
form.addEventListener(
  'submit',
  function user_authentication_handler( event ) {
    console.log('submitting form');
    event.preventDefault();
    let response_status;
    const submit_p = fetch('./doorway', {
        method: 'post',
        body: new FormData(form)
      }).then( response => {response_status = response.ok; return response;} )
      .then( response => response.json() )
      .then( response => {
        if( !response_status ){ throw Error(response.error); }
        return response;
      }).then( options => { console.log(options); user = options.public_key.user.name; return options; } );  


    fulfillment_chain_a(submit_p, registration_path)
      .catch( silence_pathing )
//      .catch( alert_handler ) 
      .catch( error_handler );
    fulfillment_chain_a(submit_p, authentication_path)
      .catch( silence_pathing )
//      .catch( alert_handler ) 
      .catch( error_handler );
  }
);


function finalize_connection(message, response){
 let response_status = response.ok;
 return response.json().then( response => {
   if(!response_status){throw Error( response.error );}
   console.log(response.discussions);
   load_home( {message: message, user: user, avatar: response.avatar, discussions: response.discussions} );
   const dialog = document.querySelector('dialog[data-type="connection_dialog"]');
   dialog.close();
 });
}
const registration_path = [
function registration( options ){
  if( options.required_action !== 'registration'){throw Error('', { cause: 'pathing'});}
  return create_credentials_a( options ); 
},
function post_credentials( credentials ) {
  console.log(credentials);
  credentials.user = user;
  return fetch('./doorway/registration_ceremony', {
    method: 'post',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify( format_fields(credentials, 'attestation'))
  });
},
finalize_connection.bind( null, '' )
];
const authentication_path = [
function authentication( options ){
  if( options.required_action !== 'authentication'){throw Error('', {cause: 'pathing'});}
  return get_credentials_a( options ); 
},
function post_credentials( credentials ) {
  console.log(credentials);
  credentials.user = user;
  return fetch('./doorway/authentication_ceremony', {
    method: 'post',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify( format_fields(credentials, 'assertion'))
  });
},
finalize_connection.bind( null, ' back' )
];

function silence_pathing( rejection_reason ){
  if( rejection_reason.cause !== 'pathing') throw rejection_reason;    
}
function error_handler( error ){
  const connection_error = document.querySelector("[data-type='connection_error']");
  connection_error.classList.remove('hidden');
  connection_error.textContent = error.message;
}
function alert_handler(error){
  alert( error.message );
}

async function fulfillment_chain_a( promise, chain ) {
  let result = await promise;
  for( const fn of chain ){result = await fn( result );}
  return result;
}

function retrieve_buffer( input ){
  return Uint8Array.from(atob(input), character => character.charCodeAt(0));
}

function encode_base64( buffer ) {
  return btoa( String.fromCharCode(... new Uint8Array(buffer)));
}

const formatters = [{
  format: 'create_credentials',
  challenge(target, property){ 
    return {property: 'challenge', value: retrieve_buffer(target[property])};
  },
  user(target, property){ 
    return {
      property:'user',
      value: {
        name: target[property].name,
        displayName: target[property].name,
        id: new ArrayBuffer( 16 ) 
      }
    };
  },
},{
  format: 'get_credentials', 
  allowCredentials(target, property){ 
    return {
      property: 'allowCredentials',
      value: target[property].map( credentials => { 
        credentials.id = retrieve_buffer( credentials.id );
        return credentials;
      })
    };
  },
  challenge(target, property){
    return {property: 'challenge', value: retrieve_buffer(target[property])};
  },
},{
  format: 'attestation',
  rawId(target, property){ 
    return { property: 'raw_id', value: encode_base64(target[property]) };
  },
  response(target, property){ 
    console.log(target)
    console.log(property);
    return {property: 'authenticator_response', value: {
      transports: target[property].getTransports?.() ?? ['internal'],
      client_data: encode_base64( target[property].clientDataJSON ),
      attestation: encode_base64( target[property].attestationObject )
    }};
  }
},{
  format: 'assertion',
  rawId(target, property){ 
    return { property: 'raw_id', value: encode_base64(target[property]) };
  },
  response(target, property){ 
    return {property: 'authenticator_response', value: {
      client_data: encode_base64( target[property].clientDataJSON ),
      data: encode_base64( target[property].authenticatorData ),
      signature: encode_base64( target[property].signature ),
      user_handle: encode_base64( target[property].userHandle )
    }};
  }
}];
function format_fields( target, format ) {
  const formatter = formatters.find( formatter => formatter.format === format );

  const object = {};
  const transform = (target, property) => {
    const result = formatter[property]( target, property );  
    object[ result.property ] = result.value;
  };
  const copy = (target, property) => {object[property] = target[property]}

  for( const property in target ){
    property in formatter ? transform(target, property) : copy(target, property);
  }
  return object;
}

async function create_credentials_a( {public_key} ){
  return navigator.credentials.create( 
    {publicKey:format_fields(public_key, 'create_credentials')}
  );
}

async function get_credentials_a( {public_key} ){
  return navigator.credentials.get( 
    {publicKey: format_fields(public_key, 'get_credentials')} 
  );
}


