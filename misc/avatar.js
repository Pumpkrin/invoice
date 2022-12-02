const angles =[];
for(let i=0; i<360; i+=15){angles.push(i);}
const shapes=[{
  name: 'square',
  upper_angle: 75
},{
  name: 'rectangle',
  upper_angle: 165
},{
  name: 'rhombus',
  upper_angle: 165
},{
  name: 'parallelogram',
  upper_angle: 345
},{
  name: 'trapezoid',
  upper_angle: 345
},{
  name: 'kite',
  upper_angle: 345
}];

function generate_avatar(){
  const shape = shapes[Math.floor(Math.random()*shapes.length)];
  const angle_range = angles.indexOf(shape.upper_angle)+1;
  const angle = angles[Math.floor(Math.random()*angle_range)];
  const size = Math.random()*2 > 1 ? 12:10;
  return `${shape.name};${angle};${size}`; 
}
module.exports = {generate_avatar};
