'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ImageData = new Schema({
  imageUrl:{
    type: String,
    default: ''
  }
});
module.exports = mongoose.model('ImageData', ImageData);
