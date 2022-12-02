'use strict';
import * as utility_m from './utility.mjs'
import './avatar.mjs';
import {load_home} from './home.mjs';

const form = document.querySelector('[data-type="connection_form"]'); 
form.addEventListener(
  'submit',
  function user_authentication_handler( event ) {
    console.log('submitting form');
    event.preventDefault();
    let user;
    let response_status;
    const submit_p = fetch('./doorway', {
        method: 'post',
        body: new FormData(form)
      }).then( response => {response_status = response.ok; return response;} )
      .then( response => response.json() )
      .then( response => {
        if( !response_status ){ throw Error(response.error); }
        return response;
      }).then( options => { console.log(options);  user = options.public_key.user.name; return options; } );  

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
        if( options.required_action !== 'registration'){
          throw Error('', { cause: 'pathing'});
        }
        return create_credentials_a( options ); 
      },
      function post_credentials( credential ) {
        credential.user = user;
        return fetch('./doorway/registration_ceremony', {
          method: 'post',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(utility_m.apply_format(credential, 'attestation'))
        });
      },
      finalize_connection.bind( null, '' )
    ];
    const authentication_path = [
      function authentication( options ){
        if( options.required_action !== 'authentication'){
          throw Error('Incorrect path', {cause: 'pathing'});
        }
        return get_credentials_a( options ); 
      },
      function post_credentials( credential ) {
        credential.user = user;
        return fetch('./doorway/authentication_ceremony', {
          method: 'post',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(utility_m.apply_format(credential, 'assertion'))
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

    utility_m.fulfillment_chain_a(submit_p, registration_path)
      .catch( silence_pathing )
      .catch( error_handler );
    utility_m.fulfillment_chain_a(submit_p, authentication_path)
      .catch( silence_pathing )
      .catch( error_handler );
  }
);


async function create_credentials_a( {public_key} ){
  return navigator.credentials.create( { publicKey: utility_m.proxy_format(public_key, 'create_credentials') });
}

async function get_credentials_a( {public_key} ){
  return navigator.credentials.get( {publicKey: utility_m.proxy_format( public_key, 'get_credentials') } );
}


