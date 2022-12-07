import {state_machine_c} from './state_machine.js';

const available_states = [{
  value: 'microphone',
  transitions: [{event: 'toggle', target: 'pause'}],
  properties: {
    emits: ['activate'],
    template: Object.assign( document.createElement('template'), {
      innerHTML : [
        '<svg viewBox="0 0 12 22">', 
          '<path d="M3,4A3,3 0 0 1 9,4v7A3,3 0 0 1 3,11z"/>',
          '<path fill="none" d="M1,10v1A5,5 0 0 0 11,11v-1 M6,16v4 M2,20h8"/>', 
        '</svg>'
      ].join(''),
    })
  }
},{
  value: 'pause',
  transitions: [
    {event: 'toggle', target: 'play'},
    {event: 'toggle', target: 'microphone'}
  ], 
  properties: {
    emits: ['inactivate'],
    template: Object.assign(
      document.createElement('template'), 
      {innerHTML : '<svg viewBox="0 0 4 5"><path d="M1,1v3m2,-3v3"/></svg>'}
     ), 
  }
},{
  value: 'play',
  transitions: [{event:'toggle', target:'pause'}], 
  properties: {
    emits: ['activate'],
    template: Object.assign(
      document.createElement('template'),  
      {innerHTML:'<svg viewBox="0 0 24 24"><path d="M4,4l16,8l-16,8z"/></svg>'}
    ),
  }
}
];
class togglable_button extends HTMLButtonElement {
  states;
  constructor() {
    const self = super();
    const required_states = self.getAttribute('data-states').split(',');
    this.states = new state_machine_c( 
      ...required_states.map( state => 
        available_states.find( available_state => available_state.value === state )
      )
    );
  }
  connectedCallback() {
    this.addEventListener('click', event => {
      console.log( 'got click, togglable_button');
      for( const event of this.emits ){
        this.dispatchEvent( new CustomEvent(event, {bubbles: true}) );
      }
    });
    this.addEventListener('toggle', event => {
      console.log( 'got toggle, togglable_button');
      setTimeout(() => this.setup_icon());
    });
    this.states.bind_to(this);
    this.setup_icon();
  }
  setup_icon(){
    const old_icon = this.querySelector('svg'); 
    const new_icon = this.template.content.cloneNode(true);
    old_icon ?
      old_icon.replaceWith( new_icon ):
      this.insertBefore( new_icon, this.firstChild ); 
  }
}
customElements.define('togglable-button', togglable_button, {extends: 'button'});

const icons = [{
  type:'send',
  template: Object.assign( document.createElement('template'), {
    innerHTML : `
      <svg stroke-linejoin='miter' viewBox='0 0 14 12'>
        <path d='M1,1l12,5l-12,5l1,-4l4,-1l-4,-1z'/>
      </svg>`
  })
}, {
  type:'check',
  template: Object.assign( document.createElement('template'), {
    innerHTML : `
      <svg viewBox='0 0 8 6'>
        <path fill='none' d='M1,3l2,2l4,-4'/>
      </svg>`
  })
}, {
  type:'cross',
  template: Object.assign( document.createElement('template'), {
    innerHTML : `
      <svg viewBox='0 0 5 5'>
        <path d='M1,1l3,3m-3,0l3,-3'/>
      </svg>`
  })
}, {
  type:'bin',
  template: Object.assign( document.createElement('template'), {
    innerHTML : `
      <svg viewBox='0 0 10 10'>
        <path fill='none' d='M2,3v5q0,1 1,1h4q1,0 1,-1v-5m1,0h-8'/>
        <path fill='none' d='M3,3v-1q0,-1 1,-1h2q1,0 1,1v1'/>
        <path fill='none' d='M4,4v4m2,0v-4'/>
      </svg>`
  })
}];
class resettable_button extends HTMLButtonElement {
  icon;
  constructor(){
    const self = super();
    this.icon = icons.find( icon => icon.type === self.getAttribute('data-icon') ).template;
  }
  connectedCallback() {
    this.appendChild( this.icon.content.cloneNode(true) );
    this.addEventListener('click', event => {
      console.log( 'got click, resettable_button');
      this.setAttribute('data-state', 'triggered');
      //TODO: might need to reassess following line, but seems to work in conjunction with observer for now
      setTimeout( () => this.setAttribute('data-state', 'waiting') ); 
    });
    this.removeAttribute('disabled');
  }
}
customElements.define('resettable-button', resettable_button, {extends: 'button'});


function playable_track_c() {
  Object.assign(this, new state_machine_c({
    value:'inactive',
    attribute: {type: 'data-state',value:'inactive'},
    listen_to: [{
      event: 'activate',
      handler: function(event) { 
        console.log('got activate, playable_track');
        this.start_playing();
        this.toggle();
      }  
    }],
    transitions:[{event:'activate', target:'active'}],
    },{
    value:'active',
    attribute: {type: 'data-state',value:'active'},
    listen_to:[{
      event: 'stop_playing',
      handler: function(event) {
        console.log('got stop_playing, playable_track');
        this.stop_playing();
        this.toggle();
      }
    },{
      event: 'inactivate',
      handler: function(event) {
        console.log('got inactivate, playable_track'); 
        this.stop_playing();
        this.toggle();
      }
    }],
    transitions: [
      {event:'stop_playing', target:'inactive'},
      {event:'inactivate', target:'inactive'}
    ],
  }));
  Object.defineProperty( this, 'state', {
    get(){ return this.states[0]; }
  });
}

function zip(...iterables) {
  let iterators = iterables.map( iterable => iterable[Symbol.iterator]() );
  return {
    next() {
      let results = iterators.map( iterator => iterator.next() );
      if( results.some( result => result.done ) ){ return {done: true}; }
      return {value: results.map( result => result.value ), done: false};
    },
    [Symbol.iterator] () {
      return this;
    }
  };
}

function format_duration( duration ){
  let seconds = Math.floor(duration%60); 
  seconds = seconds < 10 ? `0${seconds}` : seconds;
  const minutes = Math.floor(duration/60);
  return `${minutes}:${seconds}`;
}
function update_display(element, duration){
  console.log(`update_display, replay_track: ${duration}`);
  if(Number.isFinite(duration)){element.textContent = format_duration( duration );}
}

function encode_base64( buffer ) {
  return btoa( String.fromCharCode(... new Uint8Array(buffer)));
}

const application_formatters = [
  { 
    format: 'attestation',
    user(target, property){ return {property: 'user', value: target.user}; },
    type(target, property){ return {property: 'type', value: target.type}; },
    rawId(target, property){ 
      return { property: 'raw_id', value: encode_base64(target[property]) };
    },
    response(target, property){ 
      return {property: 'authenticator_response', value: {
        transports: target[property].getTransports(),
        client_data: encode_base64( target[property].clientDataJSON ),
        attestation: encode_base64( target[property].attestationObject )
      }};
    }
  },
  {
    format: 'assertion',
    user(target, property){ return {property: 'user', value: target.user}; },
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
  }
];

function apply_format( target, format ) {
  const formatter = application_formatters.find( formatter => formatter.format === format );
  const object = {};
  for( const property in target ){
    if( property in formatter ){ 
      const result = formatter[property]( target, property );  
      object[ result.property ] = result.value;
    }
  }
  return object;
}

async function fulfillment_chain_a( promise, chain ) {
  let result = await promise;
  for( const fn of chain ){
    result = await fn( result );
  }
  return result;
}

function reset_session( response ){
  if(response.status !== 401){ throw response; }
  document.querySelector('[data-type="connection_dialog"]').showModal();
}

export { togglable_button, playable_track_c, zip, update_display, apply_format, fulfillment_chain_a, reset_session };
