'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
  PhoneNumber: {
    type: String,
    default: ''
  },
  ContractId: {
    type: String,
    default: ''
  },
  ContactList:[Schema.Types.Mixed],
  Calllog: [Schema.Types.Mixed]
},{strict: false});

UserSchema.methods.toJSON = function() {
 var obj = this.toObject();
 return obj;
}

module.exports = mongoose.model('User', UserSchema);
