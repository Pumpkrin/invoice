const express_m = require('express');
const router = express_m.Router();
const fs_m = require( 'node:fs/promises');
const {pipeline} = require('node:stream/promises');
const stream_m = require('node:stream');
const multer_m = require('multer');

const utility_m = require('../misc/utility.js');
const session_id_m = require('../misc/session_id.js');

const mongoose_m = require('mongoose');
const mongo_m = require('mongodb');
const bucket = new mongo_m.GridFSBucket( mongoose_m.connection ); 
const discussion_model = require('../models/discussion.js');
const message_model = require('../models/message.js');

router.get('/', function(request, response, next) {
  response.setHeader('Accept-Ranges', 'bytes');
});

router.get('/:users',
session_id_m.extraction_chain,
session_id_m.confirmation_chain, 
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
      const results = [...Array(messages.length).keys()]
        .map( index => {return {index: index}});
      console.log('creating response');
      console.log(results);
      for(const [result, message] of utility_m.zip(results, messages)){
        result.self_authored = message.author === request.user ;
        result.configuration = {
          visualisation: message.visualisation,
          track_counter: message.track_counter,
          mimetype: message.mimetype,
          url: message.url(result.index)
        };
        delete result.index;
      }
      console.log('sending:');
      console.log( results );
      response.send({messages:results});
    }); 
},
function (error, request, response, next){
  response.status(error.status);
  response.send({error: error.message});
});

const message_upload_chain = [
session_id_m.extraction_chain,
multer_m().array('audio'),
function(request, response) {
  const message = new message_model({
    discussion: request.body.discussion,
    author: request.user, 
    mimetype: request.files[0].mimetype,
    visualisation: JSON.parse(request.body.visualisation), 
    track_counter: request.files.length,
    file_ids: [...Array(request.files.length)].map( () => new mongoose_m.Types.ObjectId() )
  }); 
  console.log('upload_chain');
  console.log(message);
  function write_file_a( [id, file] ){
    return pipeline( 
      stream_m.Readable.from(file.buffer),
      bucket.openUploadStream( '', {
        id: id,
        contentType: request.files[0].mimetype
      })
    );
  }
//TODO: need to handle the case were some are not written to disk, for whatever reason
  const files = [...utility_m.zip(message.file_ids, request.files)];
  Promise.allSettled(files.map(write_file_a))  
      .then( () => message.save() )
      .then( () => message.update_discussion_a() )
      .then( () => {
        console.log( `saved message is: ${message}` );
        response.end();
      }).catch(console.error)
}];
router.post('/message', message_upload_chain); 

const message_request_chain = [
function(request, response) {
  const {discussion, message_index, track_index} = request.params;
  console.log( `got request for message: ${discussion}/${message_index}/${track_index}` );
  const discussion_query_a = discussion_model.findOne({users: discussion.split('+')}, '-_id messages').populate('messages');
  let message;
  let cursor;
  discussion_query_a.then( ({messages}) => {
    message = messages[message_index];
    return bucket.find( message.file_ids[track_index] );
  }).then( track_cursor => {cursor = track_cursor; return cursor.next()} ) 
  .then( track => {
    console.log('got track');
    console.log( track );
    //REFLECT: no findOne for bucket, therefore, cursor iterates only once ?
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', track.contentType );
    response.setHeader('Content-Length', track.length);
    return pipeline(
      bucket.openDownloadStream(track._id),
      response
    );
  }).catch( console.error )
  .finally( () => cursor.close() ); 
},
];

router.get('/:discussion/:message_index/:track_index', message_request_chain); 
module.exports = router;
