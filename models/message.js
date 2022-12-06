const mongoose_m = require("mongoose");

const schema_c = mongoose_m.Schema;

const message_schema = new schema_c({
  mimetype: String,
  discussion: String, 
  author: String, 
  visualisation: [Number], 
  track_counter: Number,
});

message_schema.virtual('paths').get( function() {
  let index = 0 ;
  const extension = this.mimetype.split('/')[1];
  return [...Array(this.track_counter)].map(
    () => `.${this.local_url}${index++}.${extension}`
  );
});
message_schema.virtual('local_url').get( function() {
  return `/discussion/${this.discussion}/${this._id}/`;
});
message_schema.method( 'url', 
function ( index ) {
  console.log(`message_model.url -> ${this.discussion}`);
  console.log(`this is: ${this}`);
  return `/discussion/${this.discussion}/${index}/`;
});
message_schema.method( 'update_discussion_a', 
function() {
  mongoose_m.model('discussion').findOne({users: this.discussion.split('+')})
    .then( discussion => {
      discussion.messages.push( this._id );
      console.log(discussion);
      if(discussion.messages.length > 10){ discussion.messages.shift() }
      //TODO: should also erase corresponding audio files
      return discussion.save();
    });
});

//TODO: receiver is virtual: composed from discussion and author ? but if in alphabetical order? you can find in string, no matter the position

module.exports = mongoose_m.model("message", message_schema);
