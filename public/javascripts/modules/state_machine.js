//state{
// value:,
// attribute: {type,value},
// properties: {type: value, ...},
// listen_to : [{event, handler}, ...],
// transitions: [{event, target}, ...]
//}
function state_machine_c( ...states ){
  //REFLECT: required in order to excluded possible transition where the target is not part of the considered states
  const state_values = states.map( state => state.value );
  this.states = states.map( state => {
    const result = Object.assign({}, state);
    result.transitions = result.transitions.filter(
      transition => state_values.some( value => value === transition.target )
    );
    return result;
  });

  this.setup_object = function setup_object(){
    const state = this.state; 
    if(state.attribute){
      this.bound_object.setAttribute( state.attribute.type, state.attribute.value);
    }
    if(state.properties) {Object.assign( this.bound_object, state.properties );}
    if(state.listen_to) {
      state.listen_to.forEach( listener => {
        this.bound_object.addEventListener( listener.event, listener.handler );
      });
    }
    state.transitions.forEach( transition => {
      const listener = {
        event: transition.event,
        handler: apply_transition.bind(this, transition.target)
      }
      this.listeners.push( listener );
      this.bound_object.addEventListener( listener.event, listener.handler );
    });
  }
  function apply_transition(target) {
    if(this.state.listen_to){
      this.state.listen_to.forEach(
        listener => this.bound_object.removeEventListener( listener.event, listener.handler )
      );
    }
    this.listeners.forEach(
      listener => this.bound_object.removeEventListener( listener.event, listener.handler )
    );
    this.listeners = [] ;

    const index = this.states.findIndex( state => state.value === target);
    [this.states[0], this.states[index]] = [this.states[index], this.states[0]];

    this.setup_object();
  }
  function bind_to( object ){
    this.bound_object = object;
    this.listeners = [];
    this.setup_object();
  }
  this.bind_to = bind_to;
  
  Object.defineProperty( this, 'state', { get(){ return this.states[0]; } } );
}
export {state_machine_c};
