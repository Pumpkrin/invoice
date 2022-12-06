import * as utility_m from './utility.js';
import {state_machine_c} from './state_machine.js';
import * as observer_m from './observer.js';
import {recorder} from './recorder.js';

const controls = document.querySelector( '[data-type="controls"]' );
controls.detach_one = function retract_one(element){
  element = element.emitter ?? element; 
  const inline_start = getComputedStyle(element).getPropertyValue('--inline-start-a'); 
  const block_start = getComputedStyle(element).getPropertyValue('--block-start-a'); 
  element.animate([
    { transform: 'translate(0,0)', 'z-index':-1 },
    { transform: `translate(${inline_start || 0}, ${block_start || 0})`, opacity: 0, 'z-index': -1 }
  ],{duration: 300, easing: 'ease'});
  //REFLECT:logical operator is required to take into account the falsy '' returned when the custom variable is not defined
  Promise.allSettled( element.getAnimations().map( animation => animation.finished ) )
    .then( () => element.remove() ).catch( console.error ); 
}
controls.detach_all = function retract_all(){
  const elements = Array.from(controls.querySelectorAll(':scope > :not([data-type="recorder_controller"])'));
  elements.forEach( element => this.detach_one( element ) );
  if(elements.length > 0 ){
    this.setAttribute('data-state', 'inactive');
    this.message_type = 'message';
  }
}

function template_content( parameter ) {
  return ['<button ', 
            'is="resettable-button" ', 
            `data-icon='${parameter.icon}' `, 
            `data-type='${parameter.type}' `, 
            'data-state="waiting" ', 
            'class="aesthetics_icon aesthetics_interaction"',
          '></button>'].join('');
}
controls.attach_all = function attach_all(){
  //TODO&REFLECT: subject to change in the future, cross and check are not always needed
  console.log('attach_all, controls');
  console.log(`${this.message_type}`);
  const allowed_controls = {
    answer : ['validator', 'rejector', 'sender', 'eraser'],
    message : ['sender', 'eraser']
  };
  const parameters = [
    {icon: 'check', type: 'validator'},
    {icon: 'cross', type: 'rejector'}, 
    {icon: 'send', type: 'sender'}, 
    {icon: 'bin', type: 'eraser'}, 
  ];
  parameters.filter( parameter =>  
     allowed_controls[this.message_type].find( control => control === parameter.type )
  ).forEach( parameter => {
    if( !controls.querySelector(`[data-type='${parameter.type}']`) ){
      controls.appendChild( 
        Object.assign(
          document.createElement('template'), 
          {innerHTML : template_content(parameter)}
        ).content
      );
    }
  });
  this.setAttribute('data-state', 'active');
}
controls.setAttribute('data-state', 'inactive');
controls.message_type = 'message';

const recording_states = [{
  value:'inactive',
  attribute:{type:'data-state', value:'inactive'},
  properties:{
    can_be_played_a: function(){return Promise.resolve( undefined );}
  },
  listen_to: [{
    event: 'activate',
    handler: function(event) { 
      console.log('got activate, recorder_controller');
      this.start_recording(); },
  }],
  transitions:[{event:'activate', target:'active'}]
},{
  value:'active',
  attribute:{type:'data-state', value:'active'},
  properties:{
    can_be_played_a: function(){
      const audio_transmission_executor = (resolve, reject) => {
        this.addEventListener('audio_transmitted',event => resolve(undefined), {once: true} );
      }
      const audio_loading_executor = (resolve, reject) => {
        this.addEventListener('audio_loaded',event => resolve(undefined), {once: true} );
      }
      return Promise.allSettled( [
        new Promise(audio_transmission_executor),
        new Promise(audio_loading_executor)
      ]);
    }
  },
  listen_to: [{
    event: 'stop_recording',
    handler: function(event) {
      console.log('got stop_recording, recorder_controller');
      this.stop_recording();},
  },{
    event: 'inactivate',
    handler: function(event) {
      console.log('got inactivate, recorder_controller'); 
      this.stop_recording(); },
  },{
    //REFLECT: needed in order to listen to this event only when currently recording
    event: 'increment_duration',
    handler: function(event){
      console.log('got increment_duration, recorder_controller');
      this.sink.increment_duration(); },
  }],
  transitions:[
    {event:'inactivate', target:'inactive'},
    {event:'stop_recording', target: 'inactive'}
  ]
}];

class recorder_controller extends utility_m.togglable_button{
  recording_states = new state_machine_c( ...recording_states );
  sink = {}; //will be set to last replay_track upon creation 
  recorder = recorder;
  constructor() {super();}

  stop_recording() {
    this.recorder.dispatchEvent( new CustomEvent( 'stop_recording',{detail: {emitter: this}}) );
  }
  start_recording() {
    this.recorder.dispatchEvent( new CustomEvent( 'start_recording',{detail: {emitter: this}}) );
  }
  //REFLECT: for now unprime can only happen if recorder has been primed before hand
  unprime() {this.recorder.dispatchEvent( new CustomEvent( 'unprime' ) );}
  connectedCallback() {
    super.connectedCallback();
    this.recording_states.bind_to(this);
    this.message_type = 'message';
  }
}
customElements.define('recorder-controller', recorder_controller, {extends: 'button'} );

observer_m.register_configurations( { 
  observable: 'controls',
  observer_type: 'child_addition'
},{
  observable: 'controls',
  observer_type: 'attribute', 
  dispatchers:[ 
    {active:['set_selectable'], inactive:['set_unselectable'],
      target: 'messages'},
  ],
},{
  observable: 'recorder_controller',
  observer_type: 'attribute', 
  dispatchers:[ 
    {inactive:['stop_playing'], target: 'messages'},
    {inactive:['check_selected'], target: 'messages', argument: {emitter:controls}},
    {inactive:['stop_playing', 'try_generation'], 
     target: 'replay_track_list'},
    {active:['load_audio'],target: 'replay_track_list', argument:{source:recorder}},
    //TODO&REFLECT: based on answer type do not attach same kind of buttons
    {inactive:['attach_all'], target: 'controls'}
  ],
},{
  observable: 'validator',
  observer_type: 'attribute', 
  dispatchers:[ 
    {waiting:['stop_recording'], target: 'recorder_controller', event:true},
    {waiting:['unprime'], target: 'recorder_controller'},
    {waiting:['stop_playing'], target: 'replay_track_list'},
    {waiting:['stop_playing', 'resume_selected'],target: 'messages'},
    {waiting:['mark_complete'],target: 'replay_track_list', argument : {source: recorder}},
    {waiting:['detach_one'], target: 'controls'},
  ],
},{
  observable: 'rejector',
  observer_type: 'attribute', 
  dispatchers:[ 
    {waiting:['stop_recording'], target: 'recorder_controller', event: true},
    {waiting:['unprime'], target: 'recorder_controller'},
    {waiting:['stop_playing', 'remove_last'], target: 'replay_track_list'},
    {waiting:['stop_playing'], target: 'messages'},
    {waiting:['mark_complete'],target: 'replay_track_list', argument : {source: recorder}},
  ],
},{
  observable: 'sender',
  observer_type: 'attribute', 
  //REFLECT: order of dispatchers may appear wrong, but is necessary because of asynchronous loading of audio by mark complete, and state transition of replay track
  dispatchers:[ 
    {waiting:['stop_recording'], target: 'recorder_controller', event: true},
    {waiting:['unprime'], target: 'recorder_controller'},
    {waiting:['stop_playing'], target: 'replay_track_list'},
    {waiting:['stop_playing', 'clear_selected'], target: 'messages'},
    {waiting:['send_and_remove'], target: 'replay_track_list'},
    {waiting:['mark_complete'],target: 'replay_track_list', argument : {source: recorder}},
    {waiting:['detach_all'], target: 'controls'},
  ],
},{
  observable: 'eraser',
  observer_type: 'attribute', 
  dispatchers:[ 
    {waiting:['stop_recording'], target: 'recorder_controller', event:true},
    {waiting:['unprime'], target: 'recorder_controller'},
    {waiting:['stop_playing'], target: 'replay_track_list'},
    {waiting:['stop_playing'], target: 'messages'},
    {waiting:['remove_all'], target: 'replay_track_list'},
    {waiting:['mark_complete'],target: 'replay_track_list', argument : {source: recorder}},
    {waiting:['detach_all'], target: 'controls'},
  ],
});
