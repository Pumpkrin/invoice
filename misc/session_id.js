const crypto_m = require('node:crypto');

let registered_sessions = [];
//TODO&REFLECT: what if user reload page -> session wont be valid anymore, should either clear or return old session but reinitialize it 
let manager = { 
add_session(user){
  const session = {
    id: crypto_m.randomBytes(16).toString('base64'),
    user: user,
  }
  session.timeout = setTimeout( () => {
    registered_sessions.splice(
      registered_sessions.findIndex( registered_session => registered_session === session ),
      1
    ); 
  }, 20000 );
  registered_sessions.push( session );
  console.log(registered_sessions);
  return session;
}, 
confirmation_chain : [
function confirm_cookie_existence(request, response, next){
  if( !request.headers.cookie ){
    return next( Object.assign(
      new Error('Cookie header was not set'),
      {status: 401}
    ));
  }
  next();
},
function extract_session_parameters(request, response, next){
  const parameters = request.headers.cookie.split(';')
    .map( parameter => parameter.trim() )
    .map( parameter => parameter.replace(/\w+=/, '') );
  //TODO&REFLECT: order of cookie parameters might not be guaranteed
  [request.user, request.session_id] = parameters;
  console.log( request.user );
  console.log( request.session_id );
  next();
 },
function find_session( request, response, next ){  
  console.log( registered_sessions );
  const session = registered_sessions.find( session => session.user === request.user );
  console.log( session );
  if( !session || session.id !== request.session_id ){ 
    return next( Object.assign( 
      new Error('Session was either not found or did not match'),
      {status: 401}
    ));
  }
  request.session_id = undefined;
  next();
},
function reset_session( request, response, next){
  const session = registered_sessions.find( session => session.user === request.user );
  clearTimeout( session.timeout );
  const index = registered_sessions.findIndex( session => session.user === request.user );
  session.timeout = setTimeout( () => {
    registered_sessions.splice(
      index,
      1
    ); 
  }, 20000 );
  next();  
}]
};

module.exports = manager;
