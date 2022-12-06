const express_m = require('express');
const router = express_m.Router();
const fs_m = require( 'node:fs/promises');
const {pipeline} = require('node:stream/promises');
const stream_m = require('node:stream');
const multer_m = require('multer');

const utility_m = require('../misc/utility.js');
const session_id_m = require('../misc/session_id.js');

const discussion_model = require('../models/discussion.js');
const message_model = require('../models/message.js');

router.get('/', function(request, response, next) {
  response.setHeader('Accept-Ranges', 'bytes');
});

router.get('/:users', session_id_m.confirmation_chain, 
function(request, response, next){
  const users = request.params.users.split('+');
  console.log(`confirm user in discussion: ${users}`);
  if(!users.includes(request.user)){  
    return next( Object.assign(
      Error('Illegal discussion request'),
      {status: 401}
    ));
  }
  request.users = users;
  next();
},
function(request, response){
  console.log(`got a request for: ${request.users}`);
  discussion_model.findOne({users: request.users}, '-_id messages' ).populate('messages')  
    .then( ({messages})  => {
      console.log(messages);
      console.log(messages.length);
      const results = [...Array(messages.length).keys()]
        .map( index => {return {index: index}});
      console.log(results);
      for(const [result, message] of utility_m.zip(results, messages)){
        console.log(result);
        console.log(message);
        result.self_authored = message.author === request.user ;
        console.log('testing url function');
        console.log(message.url(1));
        result.configuration = {
          visualisation: message.visualisation,
          track_counter: message.track_counter,
          mimetype: message.mimetype,
          url: message.url(result.index)
        };
      }
      console.log(results);
      response.send({messages:results});
    }); 
},
function (error, request, response, next){
  response.status(error.status);
  response.send({error: error.message});
});

const upload_chain = [
function should_not_be_here( request, response, next ){
  const parameters = request.headers.cookie.split(';')
    .map( parameter => parameter.trim() )
    .map( parameter => parameter.replace(/\w+=/, '') );
  //TODO&REFLECT: order of cookie parameters might not be guaranteed
  request.user = parameters[0];
  next();
},
  multer_m().array('audio'),
  function(request, response) {
    console.log(request.files);
    console.log(request.body);
    const message = new message_model({
      mimetype: request.files[0].mimetype,
      discussion: request.body.discussion,
      author: request.user, 
      visualisation: JSON.parse(request.body.visualisation), 
      track_counter: request.files.length,
    }); 
    console.log(`resulting message: ${message}`);
    const file_descriptors = [];
    const path = '.' + message.local_url;
    function write_file_a( [filepath, file] ){
      return fs_m.open( filepath, 'w+' )
        .then( file_handle => {
          file_descriptors.push( file_handle );
          return pipeline(
            stream_m.Readable.from(file.buffer),
            file_handle.createWriteStream()
          );
        }).catch( console.error );
    }
//TODO: need to handle the case were some are not written to disk, for whatever reason
    const files = [...utility_m.zip(message.paths, request.files)];
    fs_m.mkdir(path, {recursive: true})
      .then( () => Promise.allSettled(files.map(write_file_a)) ) 
      .then( () => message.save() )
      .then( () => message.update_discussion_a() )
      .then( () => {
        console.log( `saved message is: ${message}` );
        response.end();
      }).catch(console.error)
      .finally( () => file_descriptors.forEach( file => file.close() ) );
  }
];
router.post('/message', upload_chain); 

const message_request_chain = [
function(request, response) {
  //TODO -> should ask database what local url is -> discussion not yet handled because doesn't make sense here
  let file_descriptor;
  const {discussion, message, index} = request.params;
  console.log( `got request for message: ${discussion}/${message}/${index}` );
  const discussion_query_a = discussion_model.findOne({users: discussion.split('+')}, '-_id messages').populate('messages');
  let message_entry;
  discussion_query_a.then( ({messages}) => {
    message_entry = messages[message];
    const filepath = message_entry.paths.find(path => path.match(/[^/]+(?=\.)/)[0] === index);
    return fs_m.open( filepath );
  }).then( file_handle => {
    file_descriptor = file_handle;
    return file_handle.stat();
  }).then( ({size}) => {
//    response.status(206);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', message_entry.mimetype);
//    response.setHeader('Content-Range', `bytes 0-${size-1}/${size}`); // safari doesn't like it
    response.setHeader('Content-Length', size);
    return pipeline(
      file_descriptor.createReadStream(),
      response
    );
  }).catch( console.error ).finally( () => file_descriptor?.close() );
},
];

router.get('/:discussion/:message/:index', message_request_chain); 
module.exports = router;
