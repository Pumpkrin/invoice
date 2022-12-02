const express = require('express');
const router = express.Router();
const {body, validationResult: validation_result} = require('express-validator');
const multer_m = require('multer');

const session_id_m = require('../misc/session_id'); 

const {user_model} = require('../models/user');
const discussion_model = require('../models/discussion');

router.get('/', function(req, res, next) {
  res.render('index', { title: 'invoice' });
});
router.get('/users/$id', function(request, response, next) {
  user_model.findOne({'name': request.params.id}, '-_id name avatar')
    .then( user => {response.send(user)}); 
});
router.post('/add_contact', [
session_id_m.confirmation_chain,
multer_m().none(),
body('contact')
  .trim()
  .isAlphanumeric()
  .withMessage("The given username cannot be processed"),
function (request, response, next){
  const result = validation_result( request );
  if( result.errors.length > 0 ){
    return next( Object.assign(
      new Error( result.errors[0].msg ),
      {status:400}
    ));
  }
  next();
},
function confirm_user_existence(request, response, next){
  user_model.findOne({name: request.body.contact})
    .then(user => { 
      if(!user){ 
        return next( Object.assign(
          new Error('No user found with given username'),
          {status: 400}
        ));
      }
      next();
    });
}, 
function confirm_discussion_inexistence(request, response, next){
  discussion_model.findOne({users: [request.user, request.body.contact].sort()})
    .then( discussion => {
      if(discussion){
        return next( Object.assign(
          new Error('A discussion with the user already exists'),
          {status: 400}
        ));
      }
      next();
    });
},
function (request, response, next){
  const discussion = new discussion_model({
    users:[request.user, request.body.contact].sort()  
  });
  console.log(discussion);
  discussion.save()
    .then( () => discussion.update_users_a() )
    .then( () => response.end() )
    .catch(console.error);
},
function (error, request, response, next){
  response.status(error.status);
  response.send({error: error.message});
}
]);


module.exports = router;
