import * as utility_m from './utility.js';
import {state_machine_c} from './state_machine.js';
import * as observer_m from './observer.js';
import {channel_count, sample_rate} from './recorder.js';

const stored_urled_blobs = [];
let current_urled_blob;

const track_list = document.querySelector('div[data-type="replay_track_list"');
track_list.stop_playing = function stop_playing( options ) {
  console.log('stop_playing, replay_track_list');
  for( const track of track_list.childNodes ){
    track.dispatchEvent( new CustomEvent('stop_playing') );
  }
};
track_list.try_generation = function try_generation(options) {
  console.log('try_generation, replay_track_list');
  let track = track_list.lastChild;
  if( !track || track.getAttribute('data-status') === 'complete' ) {
    track = track_list.appendChild( document.createElement('replay-track') );
    track.classList.add('current');
    track.source = options.emitter;
    options.emitter.sink = track;
  }
};
track_list.load_audio = function load_audio(options) {
  console.log('load_audio, replay_track_list');
  track_list.lastChild?.dispatchEvent(new CustomEvent('load_audio', {detail:options}) );
};
track_list.mark_complete = function mark_complete(options) {
  console.log('mark_complete, replay_track_list');
  if(track_list.lastChild?.getAttribute('data-status') !== 'complete'){
    this.lastChild.dispatchEvent(new CustomEvent('mark_complete', {detail:options}) );
  }
};
track_list.stop_others = function stop_others(options) {
  console.log('stop_others, replay_track_list');
  const index = Array.from(this.childNodes).indexOf(options.emitter);
  this.querySelectorAll( `:not(replay-track:nth-child(${index+1}))` ).forEach(
    track => track.dispatchEvent( new CustomEvent('stop_playing') )
  );
};

track_list.remove_one = function remove_one(element) {
  console.log('remove_one, replay_track_list');
  const remove_current = () => {
    URL.revokeObjectURL(current_urled_blob.url);
    current_urled_blob = undefined; 
  }
  current_urled_blob ?
    remove_current() :
    URL.revokeObjectURL( stored_urled_blobs.pop().url );

  const inline_start = getComputedStyle(element).getPropertyValue('--inline-start-a'); 
  const block_start = getComputedStyle(element).getPropertyValue('--block-start-a'); 
  element.animate([
    {transform:'translate(0,0)', 'z-index':-1 },
    {
      transform:`translate(${inline_start || 0}, ${block_start || 0})`, 
      opacity: 0, 
      'z-index': -1 
    }
  ],{duration: 300, easing: 'ease'});
  Promise.allSettled( element.getAnimations().map( animation => animation.finished ) )
    .then( () => element.remove() ).catch( console.error ); 
}
track_list.remove_last = function remove_last() {
  this.lastChild.can_be_processed_a().then( timeout_id => {
    console.log('remove_last, replay_track_list');
    clearTimeout(timeout_id);
    this.remove_one(this.lastChild);
  }).catch(console.error);
}
track_list.remove_all = function remove_all() {
  this.lastChild.can_be_processed_a().then( timeout_id => {
    console.log('remove_all, replay_track_list'); 
    clearTimeout(timeout_id);
    Array.from(this.childNodes).reverse().forEach( child => this.remove_one(child) );
  }).catch(console.error);
}

track_list.send = function send() {
  console.log('send, replay_track_list');
  const blobs = current_urled_blob ?
    (stored_urled_blobs.length > 0 ? 
      [...stored_urled_blobs.map( urled_blob => urled_blob.blob), current_urled_blob.blob] :
      [current_urled_blob.blob]) :
    stored_urled_blobs.map( urled_blob => urled_blob.blob);
  console.log( blobs );
  //TODO: retrieve duration of longuest track, insert it in offline context
  const offline_context = new OfflineAudioContext(channel_count, sample_rate * 600, sample_rate);
  Promise.allSettled( blobs.map( blob => blob.arrayBuffer() ) ) 
  //TODO: add some way to handle error ? 
    .then( audio_tracks => {
      return Promise.allSettled( audio_tracks.map( audio_track => 
        offline_context.decodeAudioData( audio_track.value )
      ));
    }).then( audio_buffers => {
      const bucket_count = 25;
      const buffers = audio_buffers.map( audio_buffer => audio_buffer.value.getChannelData(0) );
      console.log(buffers);
      const ratio = buffers.reduce( (a,b) => a.length ?? a + b.length, 0 ) / bucket_count;
      console.log( ratio );
      const bucket_counts = buffers.map( buffer => Math.round(buffer.length/ratio) );
      console.log( bucket_counts );
      let buckets = [];
      for( const [buffer, bucket_count] of utility_m.zip(buffers, bucket_counts) ){
        console.log(buffer.length);
        console.log(bucket_count);
        for(let i = 0; i < bucket_count ; i++ ){
          const sub_buffer = buffer.subarray(i*ratio, (i+1)*ratio).map(Math.abs);
          buckets.push( sub_buffer.reduce( (a,b) => a+b )/sub_buffer.length );
        }
      }
      //TODO: for now, enforce size at bucket_count, but should not be this way
      buckets.length = bucket_count;
      const max = Math.max( ...buckets ); 
      buckets = buckets.map( value => Math.round(value * 6 / max) ); 

      console.log(buckets);
      const data = new FormData();
      data.append('visualisation', JSON.stringify(buckets));
      data.append('discussion', document.querySelector('[data-type="discussion"]').current );
      blobs.forEach( blob => data.append('audio', blob) );
      return fetch('./discussion/message', {
        method: 'POST',
        body: data 
      });
    }).catch( console.error );
}

track_list.send_and_remove = function send_and_remove() {
  this.lastChild.can_be_processed_a().then( timeout_id => {
    console.log('send_and_remove, replay_track_list');
    clearTimeout(timeout_id);
    this.send();
    this.remove_all();
  }).catch(console.error);
}

class replay_track extends HTMLElement {
  //those fields should be proivates but then can't  be accessed through this[#expression]
  //TODO: move th object declaration outside of class, then just have reference to it
  playback_states = new utility_m.playable_track_c(); 
  completion_states = new state_machine_c({
    value: 'incomplete',
    attribute: {type: 'data-status',value: 'incomplete'}, 
    listen_to: [{
      event: 'load_audio',
      handler: function(event) {
        console.log('got load_audio, replay_track');
        this.load_audio( event.detail.source ); 
      }  
    },{
      event: 'mark_complete',
      handler: function(event) {
        console.log( 'got mark_complete, replay_track');
        this.load_audio(event.detail.source);
        this.mark_complete();
      },
    }],
    properties: {
      //REFLECT: works because of the arrow function, no strong identity -> a different promise for each caller, with a different listener
      //maybe should just load a new promise rather than a function generating a promise ?
      //because based on the completion state of the track
      can_be_processed_a: function(){
        const executor = ( resolve, reject ) => {
          this.addEventListener('can_be_processed', event => resolve(event.detail), {once: true});
        }
        return new Promise( executor );
      }
    },
    transitions:[{event: 'mark_complete', target:'complete'}] 
  },{
    value: 'complete',
    attribute:{type: 'data-status', value: 'complete'}, 
    properties:{
      can_be_processed_a: function(){ return Promise.resolve(undefined); }
    },
    transitions:[]
  });
  duration_counter = 0;

  constructor() {super(); console.log(this.playback_states); }
  toggle() {
    this.querySelector('button').dispatchEvent( new Event('toggle') );
  }
  load_audio( source ) {
    const urled_blob = current_urled_blob ?? {};
    if(urled_blob.url){URL.revokeObjectURL(urled_blob.url);}
    source.retrieve_audio_a()
      .then( chunks => {
        console.log('audio_retrieved');
        console.log(chunks);
        urled_blob.blob = urled_blob.blob ?
          new Blob([urled_blob.blob, ...chunks], {type:urled_blob.blob.type}):
          new Blob([...chunks], {type: chunks[0].type} ); 
        urled_blob.url = URL.createObjectURL( urled_blob.blob );
        const audio = this.querySelector('audio');
        audio.firstChild ? 
          audio.firstChild.setAttribute('src', urled_blob.url) :
          audio.appendChild( Object.assign (
            document.createElement('source'),
            {type: urled_blob.blob.type, src: urled_blob.url}
          ));
        current_urled_blob = urled_blob;
        //REFLECT: setTimeout here required in case the audio is sent to server before load is handled: need to be cancelled by the sending call
        const timeout_id = setTimeout( () => { 
          audio.load(); 
          this.source.dispatchEvent?.( new CustomEvent('audio_loaded') );
          console.log('audio.load, replay_track');
        });
        console.log('audio loaded, replay_track');
        this.dispatchEvent( new CustomEvent('audio_loaded', {detail: timeout_id}) );
        //TODO: call to finalize_display when audio_loaded
      }).catch( console.error ); //TODO: how to properly handle error here ? 
  }
  start_playing() {
    const audio = this.querySelector('audio');
    const span = this.querySelector('span:nth-of-type(1)');
    //REFLECT: all of this might be a bit heavy computation wise, but should be more reliable than a simple setInterval
    this.done_updating = false;
    let starting_time;
    const updater = () => {
      starting_time = starting_time ?? audio.currentTime;  
      if(audio.currentTime - starting_time > 1){
        utility_m.update_display(span, audio.currentTime);
        starting_time = audio.currentTime;
      }
      if(!this.done_updating){requestAnimationFrame( updater );}
    };
    requestAnimationFrame( updater );

    this.source.can_be_played_a().then( () => audio.play() ).catch( console.errors );
  }
  stop_playing() {
    const audio = this.querySelector('audio');
    audio.pause();
    this.done_updating = true;
  }

  audio_loaded_a() {
    const executor = ( resolve, reject ) => {
      this.addEventListener(
        'audio_loaded',
        event => resolve( {audio:this.querySelector('audio'), timeout_id: event.detail }), 
        {once: true}
      );
    }
    return new Promise( executor );
  }
  mark_complete() {
    this.audio_loaded_a().then( ({audio, timeout_id}) => {
      console.log('mark_complete');
      this.source = {can_be_played_a(){ return Promise.resolve( undefined ); }}
      stored_urled_blobs.push( current_urled_blob );
      current_urled_blob = undefined; 
      //REFLECT: timeout is required in order to cancel load in case the audio is sent to server
      this.duration_counter = undefined; 
      this.dispatchEvent( new CustomEvent('can_be_processed', {detail:timeout_id}) );
    }).catch(console.error);
  }

  increment_duration(){
    const span = this.querySelector('span:nth-of-type(2)');
    utility_m.update_display(span, ++this.duration_counter );  
  }
  finalize_display() {
    const button = this.querySelector('button');
    const duration = this.querySelector('audio').duration;
    utility_m.update_display(this.querySelector('span:nth-of-type(2)'), duration);
  }

  connectedCallback() {
    const template = Object.assign(
      document.createElement('template'), {
      innerHTML : [ 
      '<button is="togglable-button" data-states="play,pause" class="aesthetics_interaction flow_flex">',
        '<span>0:00</span>|<span>0:00</span>', 
      '</button>',  
      '<audio preload="none"></audio>', 
      ].join('')
    });
    this.appendChild( template.content );
    this.playback_states.bind_to(this);
    this.completion_states.bind_to( this );
    this.setAttribute('data-type', 'replay_track');
    const audio = this.querySelector('audio');
    audio.addEventListener( 
      'ended',
      event => {
        console.log('got ended, audio');
        const span = this.querySelector('span:nth-of-type(1)');
        utility_m.update_display( span, 0 ); 
        audio.currentTime = 0 ;
        this.dispatchEvent( new CustomEvent('inactivate') );
      }
    );
    const update_duration = () => { 
      console.log(`update_duration, replay_track: ${audio.duration}`);
      this.finalize_display();
      if(Number.isFinite(audio.duration)){this.duration_counter = Math.floor(audio.duration); }
    }
    audio.addEventListener('loadeddata', update_duration );
    audio.addEventListener('loadedmetadata', update_duration );
    audio.addEventListener('durationchange', update_duration );
  }
}
customElements.define('replay-track', replay_track);

observer_m.register_configurations( {
  observable: 'replay_track_list',
  observer_type: 'child_addition'
},{
  observable: 'replay_track_list',
  observer_type: 'child_removal',
  dispatchers: [
    {actions:['detach_all'], target: 'controls'}, 
  ]
},{
  observable: 'replay_track',
  observer_type: 'attribute',
  dispatchers:[
    {inactive:['stop_recording'], target: 'recorder_controller', event: true},
    {inactive:['stop_others'], target: 'replay_track_list'},
    {inactive:['stop_playing'], target: 'messages'}
  ],
  //TODO: also stop_recording is required and in turn stop_playing for messages
} );
