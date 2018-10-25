'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var SeriesPeriod = new Schema({
  Amount:{
    type: Number,
    default: 0
  },
  Bank:{
    type: String,
    default: ''
  },
  DifferenceAmount:{
    type: Number,
    default: 0
  },
  InterestAmount:{
    type: Number,
    default: 0
  },
  KeyValue:{
    type: String,
    default: ''
  },
  OpeningAmount:{
    type: Number,
    default:0
  },
  OriginalAmount:{
    type: Number,
    default: 0
  },
  PaymentDate:{
    type: String,
    default: ''
  },
  PenaltyAmount:{
    type: Number,
    default:0
  },
  RealPaymentAmount:{
    type: Number,
    default:0
  },
  RealPaymentDate:{
    type: String,
    default: ''
  },
  isFull: {
    type: Number,
    default: 0
  },
  isSMS: {
    type: Number,
    default:0
  }
});
module.exports = mongoose.model('SeriesPeriod', SeriesPeriod);
