'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var RawData = new Schema({
  RealPaymentDate:{
    type: String,
    default: ''
  },
  RealPaymentAmount:{
    type: String,
    default: ''
  }
});
module.exports = mongoose.model('RawData', RawData);
