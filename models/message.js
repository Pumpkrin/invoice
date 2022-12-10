const mongoose_m = require("mongoose");

const schema_c = mongoose_m.Schema;

const message_schema = new schema_c({
  discussion: String, 
  author: String, 
  mimetype: String,
  visualisation: [Number], 
  track_counter: Number,
  file_ids: [schema_c.Types.ObjectId]
});

message_schema.method( 'url', 
function ( index ) {
  return `/discussion/${this.discussion}/${index}/`;
});
message_schema.method( 'update_discussion_a', 
function() {
  mongoose_m.model('discussion').findOne({users: this.discussion.split('+')})
    .then( discussion => discussion.update_a(this) )
});

module.exports = mongoose_m.model("message", message_schema);
