class discussion_link extends HTMLElement {
  user;
  constructor(){super()}
  set_user(user){this.user=user}
  connectedCallback() {
//    fetch(`./users/${this.user}`)
//      .then( response => response.json() )
//      .then( response => {
//        const avatar = document.createElement('avatar-icon');
//        avatar.set_configuration( response.avatar );
//        this.appendChild( avatar );
//        this.appendChild(Object.assign(
//          document.createElement('span'),
//          {textContent: `${response.name}`}
//        ));
//      });

    this.addEventListener('click',()=>{console.log('should pop out the dialog discussion')});
  }
}
customElements.define('discussion-link', discussion_link);

function add_discussion( user ) {
  const discussion_link = document.createElement('discussion-link');
  discussion_link.set_user( user )
  discussion_link.classList.add('flow_flex_column aesthetics_interaction');
  document.querySelector('[data-type="discussions"]').appendChild( discussion_link );
}

function load_home( configuration ){
  const header = document.querySelector( '[data-type="home"] > h1');
  header.textContent += configuration.message + ', ' + configuration.user; 
  const avatar = document.querySelector( '[data-type="home"] > avatar-icon' );
  avatar.set_configuration( configuration.avatar );
  avatar.apply_configuration();
  configuration.discussions.forEach( add_discussion ); 
}

const form = document.querySelector('[data-type="contact_form"]'); 
form.addEventListener(
  'submit',
  function add_contact_handler( event ) {
    console.log('submitting form');
    event.preventDefault();
    function error_handler( error ){
      console.log('test');
      const contact_error = document.querySelector("[data-type='contact_error']");
      contact_error.classList.remove('hidden');
      contact_error.textContent = error.message;
    }
    fetch('./add_contact', {
      method: 'post',
      body: new FormData(form)
    }).then( response => {
      if( !response.ok ){
        return response.json().then( response => {throw Error(response.error)} )
      }
      console.log('now adding the discussion');
    }).catch( error_handler );
  }
);

export {load_home};
