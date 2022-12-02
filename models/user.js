const mongoose_m = require("mongoose");

const schema_c = mongoose_m.Schema;

const credential_record_schema = new schema_c({
  type: String,
  public_key: {
    key:{
      kty: String,
      crv: String,
      x: String,
      y: String
    },
    format: String
  },
  sign_count: Number, 
  transports: [String],
  user: {type: schema_c.Types.ObjectId, ref:'user'},
});
const credential_record_model = mongoose_m.model('credential_record', credential_record_schema); 

const user_schema = new schema_c({
  name: String,
  id: String,
  avatar: String,
  discussions: [{type:schema_c.Types.ObjectId, ref: 'discussion'}],
  credential_record: {type: schema_c.Types.ObjectId, ref: 'credential_record'},
});
const user_model = mongoose_m.model('user', user_schema); 

module.exports = {credential_record_model, user_model};
