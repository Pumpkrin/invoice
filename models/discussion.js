const mongoose_m = require("mongoose");

const schema_c = mongoose_m.Schema;

const discussion_schema = new schema_c({
  users: [String], 
  messages: [{type: schema_c.Types.ObjectId, ref:'message'}], 
});
discussion_schema.method( 'update_users_a', 
function () {
  return Promise.allSettled( 
    this.users.map( user => {  
      mongoose_m.model('user').findOne({'name': `${user}`})
        .then( user => {
          user.discussions.push( this._id );
          return user.save();
        });
      })
  );
});
discussion_schema.method( 'update_a', 
function (message) {
  this.messages.push(message);
  const message_removal = this.messages > 10 ? 
    mongoose_m.model('message').findByIdAndDelete( this.messages.shift() ): 
    Promise.resolve(undefined);
  return message_removal.then( () => this.save() );
});

discussion_schema.virtual('name').get( function() {
  return `${this.users[0]}+${this.users[1]}`;
});
module.exports = mongoose_m.model("discussion", discussion_schema);
