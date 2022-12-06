import * as utility_m from './utility.js';
import * as recorder_m from './recorder.js';
import * as observer_m from './observer.js'; 
import './controls.js';
import './replay_track_list.js';
import './messages.js';


const recorder_controller = document.querySelector('[data-type="recorder_controller"]');
//question is whether it is a good idea to use customized built-ins, for now, answer is that it hints towards a more complex behaviour than a simple button

const replay_track_list = document.querySelector('[data-type="replay_track_list"]');
const messages = document.querySelector( '[data-type="messages"]' );
const controls = document.querySelector( '[data-type="controls"]' );
observer_m.register_dispatcher_targets(
  replay_track_list,
  controls,
  messages,
  recorder_controller
);

const linker = observer_m.generate_observers();
//All that is needed for now
linker.attach_observers(
  messages,
  replay_track_list,
  recorder_controller,
  controls
);

const discussion = document.querySelector('[data-type="discussion"]');
let current_contact;
function load_discussion_a(users, contact) {
  current_contact = contact;
  load_header(contact);
  Object.defineProperty(
    discussion, 'current',
    {get: function() {return users.join('+') ;}, configurable: true}
  );
  return load_messages_a();
}
function load_header(contact){
  const avatar = document.querySelector( '[data-type="discussion"] > avatar-icon' );
  while(avatar.firstChild){avatar.removeChild(avatar.firstChild);}
  avatar.set_configuration( contact.avatar );
  avatar.apply_configuration();
  const username = document.querySelector( '[data-type="discussion"] > span' );
  username.textContent = contact.username;
}
function load_messages_a() {
  while(messages.firstChild){messages.removeChild(messages.firstChild);}
  return fetch(`./discussion/${discussion.current}`)
    .then( response => {if(!response.ok){throw response}; return response;} )  
    .then( response => response.json() )
    .then( response => {
      console.log(response);
      response.messages.forEach( message => {
        console.log(message);
        const track = Object.assign(
          document.createElement('message-track'),
          {classList:`flow_flex aesthetics_pannel ${message.self_authored? 'self_authored':''}`}
        );
        track.set_configuration( message.configuration );
        messages.appendChild(track);
      });
    });
}
const return_button = discussion.querySelector('[data-type="return"]');
return_button.addEventListener(
  'click',
  () => return_button.closest('dialog').close()
);
const reload_button = discussion.querySelector('[data-type="retrieve_discussion"]');
reload_button.addEventListener(
  'click',
  () => load_messages_a().catch(utility_m.reset_session)
);
export {load_discussion_a};
