import {state_machine_c} from './state_machine.js'
import * as utility_m from './utility.js'
import * as observer_m from './observer.js'
const messages = document.querySelector('[data-type="messages"');
messages.stop_playing = function stop_playing(options) {
  Array.from(this.childNodes).forEach(
    message_track => message_track.dispatchEvent(new CustomEvent('stop_playing'))
  );
}
messages.stop_others = function stop_others(options) {
  const index = Array.from(this.childNodes).indexOf(options.emitter);
  this.querySelectorAll( `:not(message-track:nth-child(${index+1}))` ).forEach(
    track => track.dispatchEvent( new CustomEvent('stop_playing') )
  );
};
messages.set_selectable = function set_selectable() {
  Array.from(this.childNodes).filter(
    message_track => !message_track.classList.contains('user_authored')
  ).forEach(
    message_track => message_track.dispatchEvent( new CustomEvent('set_selectable') )
  );
}
messages.set_unselectable = function set_unselectable() {
  Array.from(this.childNodes).filter(
    message_track => !message_track.classList.contains('user_authored')
  ).forEach(
    message_track => message_track.dispatchEvent( new CustomEvent('set_unselectable') )
  );
}
messages.unset_others = function unset_others(options) {
  const index = Array.from(this.childNodes).indexOf(options.emitter);
  Array.from(this.querySelectorAll( `:not(message-track:nth-child(${index+1}))` )).filter(
    message_track => !message_track.classList.contains('user_authored')
  ).forEach(
    track => track.dispatchEvent( new CustomEvent('unset') )
  );
};
messages.check_selected = function check_selected(options) {
  const message_track = Array.from(this.childNodes).find( 
    message_track => message_track.querySelector('input').checked 
  );
  if(message_track){
    options.emitter.message_type = 'answer';
    this.selection = {
     message : message_track,
     track : message_track.current_track,
     time : message_track.current_track?.currentTime
    }
  }
}
messages.resume_selected = function resume_selected() {
  if( this.selection.track ){
    this.selection.message.current_track = this.selection.track;
    this.selection.message.current_track.currentTime = this.selection.time;
    setTimeout(
      () => this.selection.message.dispatchEvent( new CustomEvent('activate') ),
      300
    );
  }
}
messages.clear_selected = function clear_selected() {
  if(this.selection){
    this.selection.message.checked = false;
    this.selection = undefined;
  }
}

function sound_bar_template(index){
  return Object.assign(
    document.createElement('template'), {
    innerHTML : `<svg viewBox ='0 0 4 16'><path d='
      M1,8v${index}a1,1 0 0 0 2,0v${-index * 2}a1,1 0 0 0 -2,0z'/></svg>`
  });
}
const sound_bars = [...Array(7).keys()].map(sound_bar_template);

class message_track extends HTMLElement {
  states = new utility_m.playable_track_c();
  selection_states = new state_machine_c({
    value: 'selectable',
    attribute: {type: 'data-status',value: 'selectable'}, 
    listen_to: [{
      event: 'unset',
      handler: function(event) {
        this.querySelector('input').checked = false; 
      }  
    }],
    transitions:[{event: 'set_unselectable', target:'unselectable'}] 
  },{
    value: 'unselectable',
    attribute: {type: 'data-status',value: 'unselectable'}, 
    transitions:[{event: 'set_selectable', target:'selectable'}] 
  });
  constructor(){super()} 

  set_configuration(configuration) {this.configuration = configuration}
  toggle() {
    this.querySelector('button').dispatchEvent( new Event('toggle') );
  }
  connectedCallback() {
    const selection = Object.assign(
      document.createElement('input'),
      {type:'checkbox', name:'message', classList:'flow_absolute aesthetics_interaction animate_popup'}
    );
    this.appendChild( selection );
    
    const visualisation = Object.assign(
      document.createElement('div'),
      {classList: 'flow_flex'}
    );
    visualisation.setAttribute('data-type','sound_track');
    this.configuration.visualisation.forEach( intensity => {
      visualisation.appendChild( sound_bars[intensity].content.cloneNode(true) );      
    });
    visualisation.appendChild( Object.assign( 
      document.createElement('input'),
      {type:'range', value:'0', step: 'any'}
    ));
    this.appendChild( visualisation );

    const template = Object.assign(
      document.createElement('template'), {
      innerHTML : [
        '<button',
          ' is="togglable-button"',
          ' class="aesthetics_icon aesthetics_interaction flow_center"',
          ' data-states="play,pause"',
        '></button>',
        '<div data-type="timeline" class="animate_popup"><span>0:00</span> | <span>?:??</span></div>'
      ].join('')
    });
    this.appendChild( template.content );

    this.setAttribute( 'data-type', 'message_track' );
    this.states.bind_to(this);
    this.selection_states.bind_to(this);

    this.audio_tracks = [...Array(this.configuration.track_counter).keys()].map( index => {
      return Object.assign(
        document.createElement('audio'),
        {preload:'none', type: `${this.configuration.mimetype}`, src: `${this.configuration.url}${index++}`}
      );
    });
    //REFLECT: loading proper duration is an ongoing issue in chrome: https://stackoverflow.com/questions/38443084/how-can-i-add-predefined-length-to-audio-recorded-from-mediarecorder-in-chrome
    const compute_total_duration = splits => {
      this.total_duration = splits.reduce(
        (a,b) => a.duration ?? a.value?.duration ?? a + b.duration ?? b.value?.duration, 0 
      );
      utility_m.update_display(this.querySelector('span:nth-of-type(2)'), this.total_duration);
    }
    this.audio_tracks.forEach( audio => audio.addEventListener(
      'durationchange',
      () => compute_total_duration(this.audio_tracks)
    ));
    this.audio_tracks.forEach( audio => audio.load() );

    //TODO: reset currentTime, displayed time and cursor position
    for(let i=0; i < this.audio_tracks.length -1 ; i++ ){
      this.audio_tracks[i].addEventListener(
        'ended',
        event => {
          this.audio_tracks[i+1].play().catch(console.error);
          this.current_track = this.audio_tracks[i+1];
        }
      );
    }
    this.audio_tracks[this.audio_tracks.length-1].addEventListener(
      'ended',
      event => {
        this.dispatchEvent( new Event('inactivate') )
        this.current_track = undefined;
      }
    );

    selection.addEventListener(
      'change',
      event => {if(selection.checked){ messages.unset_others({emitter:this});}} 
    );
    const slider = this.querySelector('input[type="range"]');
    slider.addEventListener(
      'input',
      event => {
        if(this.getAttribute('data-state') === 'active'){
          cancelAnimationFrame(this.request_id);
          this.current_track.pause();
        }
        if(this.current_track){this.current_track.currentTime = 0 ;}
      }
    );
    slider.addEventListener(
      'change',
      event => {
        const selected_time = slider.value/100 * this.total_duration;
        const time_display = this.querySelector('span:nth-of-type(1)');
        utility_m.update_display( time_display, selected_time );
        let time_offset = 0;
        this.current_track = this.audio_tracks.find( track => {
          time_offset += track.duration;
          return time_offset > selected_time;
        });
        if(this.current_track){
          this.current_track.currentTime = selected_time -
            (time_offset - this.current_track.duration); 
          if(this.getAttribute('data-state') === 'active'){
            this.current_track.play().catch(console.error);
            this.launch_visual_update();
          }
        }
      }
    );
  }

  launch_visual_update(){
    let starting_time;
    let last_track;
    let time_offset = 0;
    const time_display = this.querySelector('span:nth-of-type(1)');
    const slider = this.querySelector('input[type="range"]');
    const updater = () => {
      const current_time = this.current_track.currentTime;
      if( last_track !== this.current_track ){ 
        const index = this.audio_tracks.indexOf(this.current_track);
        time_offset = this.audio_tracks.slice(0, index).reduce( 
          (a,b) => a.duration ?? a + b.duration, 0 
        );
        starting_time = current_time;  
        last_track = this.current_track;
      }
      if(current_time - starting_time > 1){
        utility_m.update_display( time_display, current_time + time_offset );
        starting_time = current_time;
      }
      slider.value = (current_time + time_offset)/this.total_duration * 100;
      this.request_id = requestAnimationFrame( updater );
    };
    this.request_id = requestAnimationFrame( updater );
  }
  start_playing(){
    this.current_track = this.current_track ?? this.audio_tracks[0];
    this.current_track.play().catch(console.error);;
    this.launch_visual_update();
  }
  stop_playing(){
    this.current_track.pause();
    cancelAnimationFrame(this.request_id);
  }
}
customElements.define('message-track', message_track);

observer_m.register_configurations( {
  observable: 'messages',
  observer_type: 'child_addition'
},{
  observable: 'message_track',
  observer_type: 'attribute',
  dispatchers:[
    {inactive:['stop_recording'], target: 'recorder_controller', event: true},
    {inactive:['stop_playing'], target: 'replay_track_list'},
    {inactive:['stop_others'], target: 'messages'}
  ],
  //TODO: also stop_recording is required and in turn stop_playing for messages
} );
