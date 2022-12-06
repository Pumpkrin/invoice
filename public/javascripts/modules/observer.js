let observers = [];
const dispatcher_targets = [];

//REFLECT: the aim was to not duplicate mutation observer unnecessarily, but because of this binding must be done that way for now
//the problem is that a mutation observer for each configuration can grow large
//might be premature optimization though
const mutation_observers = [{
  type: 'attribute',
  value: function(mutations, observer)  { 
    const dispatchers = this.configuration.dispatchers;
    for( const mutation of mutations ){
      dispatchers.forEach( dispatcher => {
        const target = 
          dispatcher_targets.find( target => target.type === dispatcher.target ).value;
//        console.log(mutation.oldValue);
//        console.log(this.configuration);
//        console.log(dispatcher);
        dispatcher[mutation.oldValue]?.forEach(
          action => {
            const argument = dispatcher.argument ?? {emitter: mutation.target};
            console.log(`${dispatcher.target}, ${action}`);
            dispatcher.event ?
              target.dispatchEvent( new CustomEvent( action, {detail:argument} ) ):
              target[action](argument);
          });
      });
    }
  }
},{
  type: 'child_addition',
  value: function(mutations, observer)  { 
    for( const mutation of mutations ){
      mutation.addedNodes.forEach( node => {
        const type = node.getAttribute('data-type');
        observers
          .filter( observer => observer.configuration.observable === type )
          .forEach( entry => entry.observer.observe(node, entry.configuration.options)); 
      });
    }
  }
},{
  type: 'child_removal',
  value: function(mutations, observer)  { 
    const dispatchers = this.configuration.dispatchers;
    for( const mutation of mutations ){
      if(!mutation.target.firstChild){
        dispatchers.forEach( dispatcher => {
          const target = 
            dispatcher_targets.find( target => target.type === dispatcher.target ).value;
          dispatcher.actions.forEach( action => {
            const argument = dispatcher.argument ?? {emitter: mutation.target};
            target[action](argument);
          });
        });
      }
    }
  }
}];
function create_observer(configuration){ return new observer_c(configuration); }
function observer_c(configuration) {
  this.configuration = configuration;

  const callback = mutation_observers.find( observer => observer.type === configuration.observer_type );
  this.observer = new MutationObserver( callback.value.bind(this) ); 
}

const observer_configurations = [];
const registered_options = [{
  observer_types: ['attribute'],
  value: {
    attributeFilter: ['data-state'],
    attributeOldValue: true
  }
},{
  observer_types: ['child_addition','child_removal'],
  value: { childList: true }
}];
function register_configurations( ...configurations ){ 
  configurations.forEach( configuration => {
    const options = registered_options.find( options => {
      return options.observer_types.some( type => type ===  configuration.observer_type );
    });
    configuration.options = options?.value ?? {};
    observer_configurations.push( configuration );  
  });
}
function register_dispatcher_targets( ...elements ){
  elements.forEach( element => {
    dispatcher_targets.push({
      type: element.getAttribute?.('data-type') ?? element['data-type'],
      value: element
    })
  });
}
function generate_observers(){ 
  observers = observer_configurations.map( create_observer );
  const linker = {
    attach_observers( ...elements) {
      elements.forEach( element => {
        const type = element.getAttribute?.('data-type') ?? element['data-type'];
        observers
          .filter( entry => entry.configuration.observable === type )
          .forEach( entry => entry.observer.observe( element, entry.configuration.options));
      })
    }
  };
  return linker;
}

export { register_configurations, register_dispatcher_targets, generate_observers };
