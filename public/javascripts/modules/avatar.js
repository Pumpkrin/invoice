const shapes = [{
  name: 'square',
  template: Object.assign(
    document.createElement('template'),
    {innerHTML : '<svg viewBox="0 0 2 2"><polygon vector-effect="non-scaling-stroke" points="0,0 0,2 2,2 2,0"></svg>'}
  )
},{
  name: 'rectangle',
  template: Object.assign(
    document.createElement('template'),
    {innerHTML : '<svg viewBox="0 0 3 1"><polygon vector-effect="non-scaling-stroke" points="0,0 0,3 1,3 1,0"></svg>'}
  )
},{
  name: 'rhombus',
  template: Object.assign(
    document.createElement('template'),
    {innerHTML : '<svg viewBox="0 0 4 2"><polygon vector-effect="non-scaling-stroke" points="0,1 2,0 4,1 2,2"></svg>'}
  )
},{
  name: 'parallelogram',
  template: Object.assign(
    document.createElement('template'),
    {innerHTML : '<svg viewBox="0 0 3 2"><polygon vector-effect="non-scaling-stroke" points="0,0 2,0 3,2 1,2"></svg>'}
  )
},{
  name: 'trapezoid',
  template: Object.assign(
    document.createElement('template'),
    {innerHTML : '<svg viewBox="0 0 4 4"><polygon vector-effect="non-scaling-stroke" points="1,0 3,0 4,4 0,4"></svg>'}
  )
},{
  name: 'kite',
  template: Object.assign(
    document.createElement('template'),
    {innerHTML : '<svg viewBox="0 0 2 3"><polygon vector-effect="non-scaling-stroke" points="1,0 2,1 1,3 0,1"></svg>'}
  )
}];

class avatar_icon extends HTMLElement {
  parameters;
  constructor(){super()}
  set_configuration(configuration){this.parameters=configuration.split(';')}
  connectedCallback() {if(this.parameters){this.apply_configuration();}}
  apply_configuration(){
    this.style.setProperty('--counter', Number(this.parameters[2]));
    this.style.setProperty('--self_rotation', `${this.parameters[1]}deg`);
    const shape = shapes.find( shape => shape.name === this.parameters[0] );
    for( let i=0; i<Number(this.parameters[2]); i++){
      this.appendChild( shape.template.content.cloneNode(true) ); 
    }
  }
}
customElements.define('avatar-icon', avatar_icon);
