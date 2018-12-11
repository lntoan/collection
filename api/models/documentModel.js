'use strict';
var mongoose = require('mongoose');
var ImageModel = require('./imageModel');
var Schema = mongoose.Schema;

var DocumentCodeSchema = new Schema({
  DocumentCode: {
    type: String,
    default: ''
  },
  CustomerName: {
    type: String,
    default: ''
  },
  CreatedDate: {
    type: String,
    default: ''
  },
  UpdatedDate: {
    type: String,
    default: ''
  },
  Images: {
    type: {ImageModel}
  },
  DocumentNote:{
    type: String,
    default: ''
  },
  DocumentStatus:{
    type: Number,
    default: 0 // 0: chua xu ly, 1: approve, 2: tu choi,3: pending
  },
  UserId_Created: {
    type: Number,
    default: -1
  },
  UserId_Updated: {
    type: Number,
    default: -1
  }
});

DocumentCodeSchema.methods.toJSON = function() {
 var obj = this.toObject();
 return obj;
}

module.exports = mongoose.model('DocumentCode', DocumentCodeSchema);
