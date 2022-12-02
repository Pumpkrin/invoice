const mongoose_m = require("mongoose");

const schema_c = mongoose_m.Schema;

const message_schema = new schema_c({
  mimetype: String,
  discussion: {type: schema_c.Types.ObjectId, ref:'discussion'}, 
  type: String,
  author: {type: schema_c.Types.ObjectId, ref:'user'}, 
  visualisation: [Number], 
  track_counter: Number,
});

message_schema.virtual('paths').get( function() {
  let index = 0 ;
  const extension = this.mimetype.split('/')[1];
  return [...Array(this.track_counter)].map(
    () => `.${this.url}${index++}.${extension}`
  );
});
message_schema.virtual('url').get( function() {
  return `/media/${this.discussion}/${this._id}/`;
});
//TODO: receiver is virtual: composed from discussion and author ? but if in alphabetical order? you can find in string, no matter the position

module.exports = mongoose_m.model("message", message_schema);
