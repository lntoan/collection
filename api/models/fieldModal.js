'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
  
var FieldSchema = new Schema({
  employee_id: {
    type: Number,
    default: 0
  },
  employee_name: {
    type: String,
    default: ''
  },
  customer_id: {
    type: Number,
    default: 0
  },
  customer_name:{
    type: String,
    default: ''
  },
  addres_from: {
    type: String,
    default: ''
  },
  addres_to: {
    type: String,
    default: ''
  },
  distance_value: {
    type: Number,
    default: 0
  },
  distance_text: {
    type: String,
    default: ''
  },
  orderBy: {
    type: Number,
    default: -1
  },
  field_date: {
    type: String,
    default: ''
  }
});

FieldSchema.methods.toJSON = function() {
 var obj = this.toObject();
 return obj;
}

module.exports = mongoose.model('Field', FieldSchema);
