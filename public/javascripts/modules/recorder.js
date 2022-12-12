import {state_machine_c} from './state_machine.js';

const media_stream_p = navigator.mediaDevices.getUserMedia({audio:true});

let sample_rate;
let channel_count;
const recorder = await media_stream_p.then( function stream_handler(stream) {
  const settings = stream.getAudioTracks()[0].getSettings(); 
  ({sampleRate: sample_rate = 44100, channelCount: channel_count = 1} = settings); 
  return new MediaRecorder( stream );
}).catch( () => alert("Most functionalities of invoice are unavalaible if you don't allow the browser to capture sound") );

//only one recorder, event_handlers can directly be stored in states
const primed_states = [{
  value: 'unprimed',
  transitions: [{event: 'start_recording', target: 'primed'}],
  listen_to:[{
    event: 'start_recording',
    handler: function(event) {
      this.start(1000);
      this.controller = event.detail.emitter;
      this.controller.dispatchEvent( new Event('toggle') );
    },
  }],
  properties: {
    retrieve_audio_a: function() {
      const executor = ( resolve, reject ) => {
      this.addEventListener(
        'stop',
         event => resolve(chunks.splice(0)), 
        {once: true}
      );
      }
      return new Promise( executor );
    }
  }
},{
  value: 'primed',
  transitions: [{event:'unprime', target: 'unprimed'}],
  listen_to:[{
    event: 'start_recording',
    handler: function(event) { 
      this.resume();
      this.controller.dispatchEvent( new CustomEvent('toggle') );
    },  
  },{
    event: 'stop_recording',
    handler: function(event) { 
      this.pause();
      setTimeout(() => this.controller.dispatchEvent( new CustomEvent('toggle') ));
    },  
  },{
    event: 'unprime',
    handler: function(event) { 
      this.stop();
    },  
  }],
  properties: {
    retrieve_audio_a: function() {
      const executor = ( resolve, reject ) => {
      this.addEventListener(
        'data_available',
         event => resolve(chunks.splice(0)), 
        {once: true}
      );
      //REFLECT: can only be used if recorder is active
      this.requestData();
      }
      return new Promise( executor );
    }
  }
}];

recorder.primed_states = new state_machine_c(...primed_states);
recorder.primed_states.bind_to( recorder );

let chunks = [];
recorder.addEventListener( 
  'dataavailable',
  function (event) { 
    chunks.push(event.data);
    this.dispatchEvent( new Event('data_available') );
    //REFLECT: because dispatch is synchronous, audio_loaded need to be sent here, for correct order in micro task queue
    this.controller.dispatchEvent( new Event('audio_transmitted') );
    //REFLECT: need to be un event so that the controller doesn't listen do this request if it is not in a recording state
    this.controller.dispatchEvent( new CustomEvent('increment_duration') );
  }
);

recorder['data-type'] = 'media_recorder';

export { recorder, sample_rate, channel_count };
