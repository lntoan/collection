'use strict';
var mongoose = require('mongoose');
var SeriesPeriod = require('./seriodModel');
var RawData = require('./rawModel');
var Schema = mongoose.Schema;

var ContractSchema = new Schema({
  ChangeDueDateAmount: {
    type: Number,
    default: 0
  },
  ChangeDueDate: {
    type: String,
    default: ''
  },
  ChangeDueDatePaid: {
    type: String,
    default: ''
  },
  isChangeDueDatePaid: {
    type: Number,
    default: 0
  },
  ChangeDueDateCount: {
    type: Number,
    default: 0
  },
  CompanyAddress: {
    type: String,
    default: ''
  },
  CompanyAddress_district_id: {
    type: Number,
    default: 0
  },
  CompanyName:{
    type: String,
    default: ''
  },
  ContractAmount:{
    type: Number,
    default: 0
  },
  ContractDate:{
    type: String,
    default: ''
  },
  ContractId: {
    type: String,
    default: ''
  },
  ContractInvoiceAmount:{
    type: Number,
    default: 0
  },
  ContractLiquidationAmount:{
    type: Number,
    default: 0
  },
  ContractRemainAmount:{
    type: Number,
    default: 0
  },
  ContractRemainAmountDelayDate:{
    type: Number,
    default: 0
  },
  Crm_Contract_Id:{
    type: Number,
    default: 0
  },
  CurrentPeriodCount:{
    type: Number,
    default: 0
  },
  CustomerAddress:{
    type: String,
    default: ''
  },
  CustomerNotes:{
    type: String,
    default: ''
  },
  CustomerAddress_district_id:{
    type: Number,
    default: ''
  },
  CustomerCCCD:{
    type: String,
    default: ''
  },
  CustomerCMND:{
    type: String,
    default: ''
  },
  CustomerId:{
    type: String,
    default: ''
  },
  CustomerName:{
    type: String,
    default: ''
  },
  CustomerName1:{
    type: String,
    default: ''
  },
  CustomerPhone:{
    type: String,
    default: ''
  },
  CustomerTempAddress_district_id:{
    type: Number,
    default: ''
  },
  CustomerTempAddress:{
    type: String,
    default: ''
  },
  Dayschange:{
    type: Number,
    default: ''
  },
  DepositAmount:{
    type: Number,
    default: ''
  },
  Descripttion:{
    type: String,
    default: ''
  },
  DifferenceAmount:{
    type: Number,
    default: 0
  },
  ExpectedAmount:{
    type: Number,
    default: 0
  },
  ExpireDate:{
    type: String,
    default: ''
  },
  FininshAmount:{
    type: Number,
    default: 0
  },
  InvoiceAmountDelayDate:{
    type: String,
    default: ''
  },
  LastPaymentDate:{
    type: String,
    default: ''
  },
  LoanAmount:{
    type: Number,
    default: 0
  },
  NextPayment:{
    type: Number,
    default: 0
  },
  NextPaymentDate:{
    type: String,
    default: ''
  },
  OrgContractDate:{
    type: String,
    default: ''
  },
  OverDueDate:{
    type: Number,
    default: 0
  },
  PaymentPeriodCount:{
    type: Number,
    default: 0
  },
  PaymentRemainPeriodCount:{
    type: Number,
    default: 0
  },
  PenaltyAmount:{
    type: Number,
    default: 0
  },
  Period:{
    type: Number,
    default: 0
  },
  PeriodAmount:{
    type: Number,
    default: 0
  },
  ProductName:{
    type: String,
    default: ''
  },
  Rate:{
    type: Number,
    default: 0
  },
  RefName:{
    type: String,
    default: ''
  },
  RefPhone:{
    type: String,
    default: ''
  },
  RevenueDate:{
    type: String,
    default: ''
  },
  RunningTotal:{
    type: Number,
    default: 0
  },
  Status:{
    type: Number,
    default: 0
  },
  isChangeDueDate:{
    type: Number,
    default: 0
  },
  isInvoiced:{
    type: Number,
    default: 0
  },
  isPhone:{
    type: Number,
    default:0
  },
  isSMS1:{
    type: Number,
    default:0
  },
  SeriesPeriod: {
    type: {SeriesPeriod}
  },
  RawData:{
    type: {RawData}
  }
});

ContractSchema.methods.toJSON = function() {
 var obj = this.toObject();
 return obj;
}

module.exports = mongoose.model('Contract', ContractSchema);
