import * as utility_m from './utility.js';
import * as discussion_m from './discussion.js';

class discussion_link extends HTMLElement {
  users;
  constructor(){super()}
  set_users(users){this.users=users}
  connectedCallback() {
    console.log(this.users);
    const contact = {};
    contact.username = this.users.reduce( (a,b) => a === user ? b : a);
    //TODO: if lots of discussions with various users, can be quite heavy, you sould return directly from backend the user list + avatars, and pass that as argument, rather than fetch each 
    fetch(`./users/${contact.username}`)
      .then( response => {if(!response.ok){throw response}; return response;} )  
      .then( response => response.json() )
      .then( response => {
        const avatar = document.createElement('avatar-icon');
        avatar.classList.add('flow_center');
        avatar.set_configuration( response.avatar );
        contact.avatar = response.avatar;
        this.appendChild( avatar );
        this.appendChild(Object.assign(
          document.createElement('span'),
          {textContent: `${contact.username}`}
        ));
      })
      .catch(utility_m.reset_session) 

    this.addEventListener(
      'click',
      ()=>{
        //TODO: no need to do a request if contact is already the good one ?
        discussion_m.load_discussion_a(this.users, contact)
          .then( () => {
            const dialog = document.querySelector('[data-type="discussion_dialog"]');
            dialog.showModal();
          }).catch(utility_m.reset_session) 
      }
    );
  }
}
customElements.define('discussion-link', discussion_link);

function add_discussion( discussion ) {
  const discussion_link = document.createElement('discussion-link');
  discussion_link.set_users( discussion.users )
  discussion_link.classList.add('flow_flex_column');
  discussion_link.classList.add('aesthetics_interaction');
  document.querySelector('[data-type="discussions"]').appendChild( discussion_link );
}

let user;
function load_home( configuration ){
  if(user !== configuration.user){
    user = configuration.user;
    clear_home();
    const header = document.querySelector( '[data-type="home"] > h1');
    header.textContent = 'Welcome' +  configuration.message + ', ' + configuration.user; 
    const avatar = document.querySelector( '[data-type="home"] > avatar-icon' );
    avatar.set_configuration( configuration.avatar );
    avatar.apply_configuration();
    console.log(configuration.discussions);
    configuration.discussions.forEach( add_discussion ); 
  }
}
function clear_home() {
  const header = document.querySelector( '[data-type="home"] > h1');
  header.textContent = '';
  const avatar = document.querySelector( '[data-type="home"] > avatar-icon' );
  while(avatar.firstChild){avatar.removeChild(avatar.firstChild);}
  const discussions = document.querySelector( '[data-type="discussions"]' );
  while(discussions.firstChild){discussions.removeChild(discussions.firstChild);}
}

const form = document.querySelector('[data-type="contact_form"]'); 
form.addEventListener(
  'submit',
  function add_contact_handler( event ) {
    console.log('submitting form');
    event.preventDefault();
    const contact_error = document.querySelector("[data-type='contact_error']");
    contact_error.classList.add('hidden');
    fetch('./add_contact', {
      method: 'post',
      body: new FormData(form)
    }).then( response => {
      if( !response.ok ){ throw response; }
      console.log('now adding the discussion');
      const other_user = this.querySelector('[name="contact"]').value;
      add_discussion( {users: [user, other_user].sort()} ); 
    }).catch( utility_m.reset_session )
    .catch( response => {
      console.log( response.status );
      response.json().then( response => {
        console.log(response);
        const contact_error = document.querySelector("[data-type='contact_error']");
        contact_error.classList.remove('hidden');
        contact_error.textContent = response.error;
      });
    });
  }
);

export {load_home};
