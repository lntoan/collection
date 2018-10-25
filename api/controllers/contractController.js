'use strict';

require('dotenv').config();
var mongoose = require('mongoose'),
  Contract = mongoose.model('Contract');
const _ = require('lodash');
const secureCompare = require('secure-compare');
const moment = require('moment');
const xoa_dau = require('../utils/xoa_dau');
const ContractById = require('../utils/contract');

exports.list_all_contracts = function(req, res) {
  Contract.find({}, function(err, contract) {
    if (err)
      res.send(err);
    console.log(contract);
    res.json(contract);
  });
};

exports.ReceivedAmountContract = function(req, res) {

  let objData = req.body;

  if (!secureCompare(objData.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  }

  if (objData.contractId === undefined || objData.contractId === '') {
    return res.status(200).json({result: false, message: 'Please input objData', data: []});
  }

  Contract.findOne().and([{ContractId: objData.contractId},{Status:1}])
  .then(objCus => {

      console.log('Bắt đầu cập nhật thanh toán cho hợp đồng: ' + objCus.ContractId + ' với số tiền: ' + objData.Amount);
      // console.log('RunningTotal');
      let data = [];
      let TempDifferenceAmount = 0;
      objData.Amount = parseFloat(objData.Amount);
      objCus.RunningTotal += objData.Amount;
      const RawAmount = objData.Amount;

      if (objCus['isChangeDueDatePaid'] !== undefined){
        if (objCus.isChangeDueDate === 1 && objCus.isChangeDueDatePaid === 0){
          objCus.isChangeDueDatePaid =1;
          objData.Amount -= objCus.ChangeDueDateAmount;
          if (objCus.SeriesPeriod !== undefined){
            for (let i = objCus.PaymentPeriodCount+1;i<=objCus.Period;i++){
              let key = 'Period_' + _.padStart(i,2,'0');
              objCus.SeriesPeriod[key].KeyValue = moment(moment(objCus.SeriesPeriod[key].KeyValue,'DD-MM-YYYY').add(objCus.Dayschange,'days')).format('DD-MM-YYYY');
              objCus.SeriesPeriod[key].PaymentDate = moment(moment(objCus.SeriesPeriod[key].PaymentDate,'DD-MM-YYYY').add(objCus.Dayschange,'days')).format('DD-MM-YYYY');
            }
          }
        }
      }

      objCus.PaymentPeriodCount += 1;
      objCus.PaymentRemainPeriodCount -=1;
      let PaymentPeriodCountTemp = objCus.PaymentPeriodCount;

      if (objCus.SeriesPeriod !== undefined){
        while (objData.Amount > 0 && PaymentPeriodCountTemp <= objCus.Period) {
          let key = 'Period_' + _.padStart(PaymentPeriodCountTemp,2,'0');
          if (parseFloat(objData.Amount) >= parseFloat(objCus.SeriesPeriod[key].Amount)){
            // console.log('vao so tien lon hon hoac bang');
            objCus.SeriesPeriod[key].RealPaymentAmount += objCus.SeriesPeriod[key].Amount;//objData.Amount - objCus.SeriesPeriod[key].Amount;
            objData.Amount -= objCus.SeriesPeriod[key].Amount;
            objCus.ContractRemainAmount -= objCus.SeriesPeriod[key].Amount;
            objCus.SeriesPeriod[key].DifferenceAmount = 0;
            objCus.SeriesPeriod[key].isFull = 1;
            // objCus.SeriesPeriod[key].Amount = objCus.PeriodAmount;
            PaymentPeriodCountTemp += 1;

            // console.log(objCus.SeriesPeriod[key]);
          }else{
            // console.log('vao so tien nho hon');
            objCus.SeriesPeriod[key].RealPaymentAmount += objData.Amount;
            objCus.ContractRemainAmount -= objData.Amount;//objCus.SeriesPeriod[key].OriginalAmount; // dang tinh sai can phai tinh lai
            objCus.SeriesPeriod[key].isFull = 0;

            if (objCus.SeriesPeriod[key].DifferenceAmount === 0){
              // objCus.SeriesPeriod[key].DifferenceAmount  = objCus.PeriodAmount - objCus.SeriesPeriod[key].RealPaymentAmount; // duong ng
              objCus.SeriesPeriod[key].DifferenceAmount  = objCus.SeriesPeriod[key].Amount - objCus.SeriesPeriod[key].RealPaymentAmount; // duong ng
            }else{
              objCus.SeriesPeriod[key].DifferenceAmount  = objCus.SeriesPeriod[key].Amount - objData.Amount; // duong ng
            }

            // objCus.SeriesPeriod[key].DifferenceAmount  = objCus.PeriodAmount - objCus.SeriesPeriod[key].RealPaymentAmount; // duong ng
            if (objCus.SeriesPeriod[key].RealPaymentAmount >= (0.8*objCus.SeriesPeriod[key].Amount)){
              TempDifferenceAmount = objCus.SeriesPeriod[key].DifferenceAmount; // so tien thieu
              PaymentPeriodCountTemp += 1;
            }else{
              // trong truong hop neu khong du 80%
              objCus.SeriesPeriod[key].Amount = objCus.SeriesPeriod[key].Amount - objData.Amount;
            }
            objData.Amount = 0;
            // console.log(objCus.SeriesPeriod[key]);
          }

          objCus.SeriesPeriod[key].RealPaymentDate = objData.PaymentDate; //format('DD-MM-YYYY');
          objCus.SeriesPeriod[key].isSMS = 0;
          objCus.SeriesPeriod[key]['Bank'] = objData.Bank; // moi them de xac dinh tien nhan tu bank hay cash (cash se di tu app collection)

        } // end while

        PaymentPeriodCountTemp -=1;

        let key = 'Period_' + _.padStart(PaymentPeriodCountTemp ,2,'0');

        if (PaymentPeriodCountTemp >= objCus.Period){
          objCus.NextPayment += objCus.PenaltyAmount;
          PaymentPeriodCountTemp = objCus.Period;
          key = 'Period_' + _.padStart(PaymentPeriodCountTemp,2,'0');
          objCus.Status = 0;
          objCus.PaymentPeriodCount = PaymentPeriodCountTemp;
          objCus.PaymentRemainPeriodCount = objCus.Period - objCus.PaymentPeriodCount;
        }else{
          objCus.PaymentPeriodCount = PaymentPeriodCountTemp;
          objCus.PaymentRemainPeriodCount = objCus.Period - objCus.PaymentPeriodCount;
        }

        // update thong tin chinh cua Contracts
        if ((objCus.RunningTotal + objCus.ContractRemainAmount) !== objCus.ContractAmount){
          // cheat code de chay cho dung
          objCus.ContractRemainAmount = objCus.ContractAmount - objCus.RunningTotal;
        }

        if (PaymentPeriodCountTemp !== 0){
          if ((PaymentPeriodCountTemp+1) >= objCus.Period){
            key = 'Period_' + _.padStart(objCus.Period,2,'0');
          }else{
            key = 'Period_' + _.padStart(PaymentPeriodCountTemp+1,2,'0');
          }
          objCus.NextPayment = objCus.SeriesPeriod[key].Amount + TempDifferenceAmount;
          objCus.SeriesPeriod[key].Amount = objCus.NextPayment; // tinh lai so tien thanh toan cho ky tiep theo
          objCus.NextPaymentDate = objCus.SeriesPeriod[key].PaymentDate;
        }else{
          objCus.NextPayment = objCus.SeriesPeriod['Period_01'].Amount + TempDifferenceAmount;
          objCus.SeriesPeriod['Period_01'].Amount = objCus.NextPayment; // tinh lai so tien thanh toan cho ky tiep theo
          objCus.NextPaymentDate = objCus.SeriesPeriod['Period_01'].PaymentDate;
        }

        // update OverDueDate

        let objTemp = null;

        if ((PaymentPeriodCountTemp+1) >= objCus.Period){
          key = 'Period_' + _.padStart(objCus.Period,2,'0');
        }else{
          key = 'Period_' + _.padStart(PaymentPeriodCountTemp+1,2,'0');
        }

        objTemp = objCus.SeriesPeriod[key];
        let currentDate = moment(Date.now()).format('YYYYMMDD');
        currentDate = moment(currentDate,'YYYYMMDD');

        let PaymentDate = moment(objTemp.PaymentDate,'DD-MM-YYYY');
        let OverDueDate = currentDate.diff(PaymentDate,'days') + 1;
        objCus.OverDueDate = OverDueDate; // tinh lai overdue

        let length = 1;
        Object.keys(objCus.RawData).forEach(function(key) {
          console.log('yyyyy');
          console.log(key);
          length++;
        });

        // length++;
        let RawPeriod = 'Period_' + _.padStart(length,2,'0');

        objCus.RawData[RawPeriod] = {
          RealPaymentDate: 'Amount_' + objData.PaymentDate,
          RealPaymentAmount: objData.PaymentDate + '***' + RawAmount
        };

        objCus.markModified('RawData');
        objCus.markModified('SeriesPeriod');

        objCus.save(function(err,contract) {
          if(!err) {
            console.log('Cập nhật thanh toán thành cồng cho hợp đồng: ' + objCus.ContractId + ' với số tiền: ' + objData.Amount);
            data.push(contract);
            return res.status(200).json({result: true, message: 'ok', data: data});
          }
          else {
            console.log('Cập nhật thanh toán thất bại cho hợp đồng: ' + objCus.ContractId + ' với số tiền: ' + objData.Amount);
            console.log(error);
            return res.status(200).json({result: false, message: 'has error', data: data});
          }
        })
      }
    })
  .catch(error => {
    console.log('không tìm thấy mã hợp đồng: ' + objData.contractId);
    console.log('objData không tìm thấy: ' + objData.Amount + '.CMND: ' + objData.cmndCode);
    return res.status(200).json({result: false, message: 'Không tìm thấy hợp đồng', data: []});
  });

};

exports.CreateContract = function(req, res) {

  let objUpdate = req.body;

  if (!secureCompare(objUpdate.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  }

  if (objUpdate.contract.ContractId === undefined || objUpdate.contract.ContractId === '') {
    return res.status(200).json({result: false, message: 'Please input objData', data: []});
  }

  objUpdate.contract['SeriesPeriod'] = {};
  let OpeningAmount = objUpdate.contract.LoanAmount;
  for (let i = 1 ; i<=objUpdate.contract.Period; i++){
    let tempPeriod = 'Period_' + _.padStart(i,2,'0');
    let periodObj = {OpeningAmount: 0,Amount: objUpdate.contract.NextPayment,KeyValue: 1,
      PaymentDate: 0,PenaltyAmount: 0,RealPaymentDate: '',isSMS: 0,RealPaymentAmount:0,
      DifferenceAmount:0, InterestAmount:0,isFull: 0,OriginalAmount:0}
    periodObj.KeyValue = moment(objUpdate.contract.ContractDate, 'DD/MM/YYYY').add(i,"months").format("DD-MM-YYYY");
    periodObj.PaymentDate = periodObj.KeyValue;
    objUpdate.contract.SeriesPeriod[tempPeriod] = periodObj;
    objUpdate.contract.SeriesPeriod[tempPeriod].Amount = objUpdate.contract.PeriodAmount;
    objUpdate.contract.SeriesPeriod[tempPeriod].InterestAmount = OpeningAmount * parseFloat(objUpdate.contract.Rate); // tieenf lai
    objUpdate.contract.SeriesPeriod[tempPeriod].OriginalAmount = objUpdate.contract.PeriodAmount - objUpdate.contract.SeriesPeriod[tempPeriod].InterestAmount; //giam goc,
    objUpdate.contract.SeriesPeriod[tempPeriod].OpeningAmount = OpeningAmount - objUpdate.contract.SeriesPeriod[tempPeriod].OriginalAmount;
    OpeningAmount = objUpdate.contract.SeriesPeriod[tempPeriod].OpeningAmount;
  }

  var new_contract = new Contract(objUpdate.contract);
  new_contract.save(function(err, contract) {
    if (err){
      console.log(err);
      console.log('Tạo hợp đồng thất bại: ' + contract.ContractId);
      return res.status(200).json({result: false, message: error, contract: {}});
    }
    console.log('Tạo thành công hợp đồng: ' + contract.ContractId);
    return res.status(200).json({result: true,message: 'success', contract: contract});
  });
};


exports.updateOverDueDate = function(req, res) {

  let objUpdate = req.body;

  if (!secureCompare(objUpdate.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  }

  Contract.find().and([{Period:{$gt:0} },{Status:1}])
  .then(contracts => {
    let updates = [];
    for (let i=0;i<contracts.length;i++){

      let objContract = contracts[i];
      let currentDate = moment(Date.now()).format('YYYYMMDD');
      currentDate = moment(currentDate,'YYYYMMDD');
      let currentPeriodCount = parseInt(moment(Date.now()).format('YYYYMM'));
      let isFlag = false;

      if ((objContract.PaymentPeriodCount + 1) <= objContract.Period && objContract.SeriesPeriod !== undefined && parseInt(objContract.Status) === 1){
        let NextPaymentPeriodCount = (objContract.PaymentPeriodCount + 1);
        let PenaltyAmount = 0, TotalNextPayment = 0;
        Object.keys(objContract.SeriesPeriod).forEach(function(key) {

          let tempKey = parseInt(key.substring(7,9)); // convert qua so
          let PaymentDate = moment(objContract.SeriesPeriod[key].PaymentDate,'DD-MM-YYYY');
          let OverDueDate = currentDate.diff(PaymentDate,'days') ; //+ 1;
          let tempCurrentPeriodCount = parseInt(moment(moment(objContract.SeriesPeriod[key].KeyValue,'DD-MM-YYYY')).format('YYYYMM'));
          // if (key === NextPaymentPeriodCount){

          if (tempKey === NextPaymentPeriodCount){
            objContract.OverDueDate = OverDueDate;
            objContract.NextPaymentDate = objContract.SeriesPeriod[key].PaymentDate;
          }

          if (currentPeriodCount === tempCurrentPeriodCount){
            isFlag = true;
            currentPeriodCount = tempKey;
          }

          if (PaymentDate <= currentDate){ // loop qua tinh tien phat moi ky

            // tinh lai PenaltyAmount cho mỗi kỳ
            let PaymentAmount05 = 0.05 * objContract.SeriesPeriod[key].Amount;
            let PaymentAmount50 = 0.5 * objContract.SeriesPeriod[key].Amount;
            let PaymentDate = moment(objContract.SeriesPeriod[key].PaymentDate,'DD-MM-YYYY');
            let RealPaymentDate = moment(objContract.SeriesPeriod[key].RealPaymentDate,'DD-MM-YYYY');
            objContract.SeriesPeriod[key].PenaltyAmount = 0;
            OverDueDate = 0;

            if (objContract.SeriesPeriod[key].RealPaymentDate === '' || objContract.SeriesPeriod[key].RealPaymentDate === 0){
              let currentDate = moment(moment(Date.now()).format('DD-MM-YYYYMM'),'DD-MM-YYYY');
              OverDueDate = currentDate.diff(PaymentDate,'days') ; //+ 1;
            }else{
              OverDueDate = RealPaymentDate.diff(PaymentDate,'days') ; //+ 1;
            }

            // neu lon hon 80% thi ko tinh phat,nho hon 80% va so ngay cham thanh toan lon hon 5 va chua dong du tien thi tinh phat
            // if (objContract.SeriesPeriod[key].RealPaymentAmount < (0.8*objContract.SeriesPeriod[key].Amount)){
              // if (OverDueDate > 4 && (objContract.SeriesPeriod[key].DifferenceAmount !== 0 ? objContract.SeriesPeriod[key].DifferenceAmount : objContract.SeriesPeriod[key].Amount) > PaymentAmount05){
              if (OverDueDate > 4 && (objContract.SeriesPeriod[key].DifferenceAmount !== 0 ? objContract.SeriesPeriod[key].DifferenceAmount : objContract.SeriesPeriod[key].Amount) > PaymentAmount05){
                // objContract.SeriesPeriod[key].PenaltyAmount = 0.08 * (objContract.SeriesPeriod[key].DifferenceAmount);
                console.log('du dieu kien tinh tien phat');
                console.log(objContract.ContractId);
                objContract.SeriesPeriod[key].PenaltyAmount = 0.08 * (objContract.SeriesPeriod[key].DifferenceAmount !== 0 ? objContract.SeriesPeriod[key].DifferenceAmount : objContract.SeriesPeriod[key].Amount);
                PenaltyAmount += objContract.SeriesPeriod[key].PenaltyAmount;
              }else{
                if (objContract.SeriesPeriod[key].DifferenceAmount > PaymentAmount05){
                  console.log('du dieu kien tinh tien phat');
                  console.log(objContract.ContractId);
                  objContract.SeriesPeriod[key].PenaltyAmount = 0.08 * objContract.SeriesPeriod[key].DifferenceAmount;
                  PenaltyAmount += objContract.SeriesPeriod[key].PenaltyAmount;
                }
              }
            // }
          }
        }); // end of loop

        objContract.PenaltyAmount = PenaltyAmount;
        if (isFlag === false){
          // currentPeriodCount = 0;
          // currentPeriodCount = objContract.Period;
          currentPeriodCount = 1; // neu YYYYMM khong trung voi ky thanh toan nao thi no la 0
        }
        objContract['CustomerName1'] = xoa_dau.xoa_dau(objContract.CustomerName);
        objContract['FininshAmount'] = ContractById.getFinishContract(objContract);
        objContract['CurrentPeriodCount'] = currentPeriodCount; // so ky hien tai phai thanh toan
        let updatePromise = Contract.updateOne({"_id": objContract._id}, {"$set": objContract});
        updates.push(updatePromise);
      }
    } // end for
    Promise.all(updates).then(function(results){
      console.log(results);
      return res.status(200).json({result: true});
    });
  })
  .catch(error => {
    console.log(error.message);
    return res.status(200).json({result: false});
  });
};

exports.updateComment = function(req, res) {

  let objUpdate = req.body;

  if (!secureCompare(objUpdate.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  }

  if (objUpdate.contractId === undefined || objUpdate.contractId === '' || objUpdate.CustomerNotes.trim() === '') {
    return res.status(200).json({result: false, message: 'Please input objData', data: ''});
  }

  Contract.findOne({ContractId: objUpdate.contractId})
  .then(contract => {
    let currentDate = moment(Date.now()).format('DD/MM/YYYY');
    let message = currentDate + ': ' + objUpdate.CustomerNotes;
    contract['CustomerNotes'] = ((contract['CustomerNotes'] === undefined  || contract['CustomerNotes'] === '') ? '' : (contract['CustomerNotes'] + '-----' )) +  message; //objUpdate.CustomerNotes;
    contract.isPhone = 1;
    contract.save(function(err,updatedobj) {
      if(!err){
        console.log("Cập nhật thành công notes cho hợp đồng: " + updatedobj.ContractId);
        res.status(200).json(updatedobj);
      }
      else {
        console.log("Error: could not save contact " + objUpdate.contractId);
        res.status(200).json([]);
      }
    });
  })
  .catch(error => {
    console.log(error.message);
    console.log('không tìm thấy khách hàng');
    res.status(200).json([]);
  });
};

exports.UpdateDelayContract = function(req, res) {

  let objUpdate = req.body;

  if (!secureCompare(objUpdate.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: []});
  }

  if (objUpdate.contractId === undefined || objUpdate.contractId === '') {
    return res.status(200).json({result: false, message: 'Please input objData', data: []});
  }

  Contract.findOne({ContractId: objUpdate.contractId})
  .then(contract => {

    contract['ChangeDueDateAmount'] = objUpdate.Amount;
    contract['ChangeDueDate'] = objUpdate.NewPaymentDate;
    contract['isChangeDueDatePaid'] = 0;
    contract.isChangeDueDate = 1;
    contract.Dayschange = objUpdate.Dayschange;
    contract.ChangeDueDateCount = parseInt(contract.ChangeDueDateCount) + 1;

    contract.save(function(err,updatedobj) {
      if(!err) {
        console.log("Cập nhật dời ngày hợp đồng: " + objUpdate.contractId + " sang ngày " + objUpdate.NewPaymentDate + ". Số tiền: " + objUpdate.Amount);
        res.status(200).json(updatedobj);
      }
      else {
        console.log("Cập nhật dời ngày thất bại hợp đồng: " + objUpdate.contractId + " sang ngày " + objUpdate.NewPaymentDate + ". Số tiền: " + objUpdate.Amount);
        res.status(200).json([]);
      }
    });
  })
  .catch(error => {
    console.log(error.message);
    console.log('Cập nhật dời ngày thất bại: hợp đồng: ' + objUpdate.contractId);
    return res.status(200).json({result: false, message: 'Please input ContractId', data: []});
  });
};


exports.UpdateSMSPayment = function(req, res) {

  let objUpdate = req.body;

  if (!secureCompare(objUpdate.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: []});
  }

  if (objUpdate.contractId === undefined || objUpdate.contractId === '') {
    return res.status(200).json({result: false, message: 'Please input objData', data: []});
  }

  Contract.findOne({ContractId: objUpdate.contractId})
  .then(contract => {

    let Period = 'Period_' + _.padStart(contract.PaymentPeriodCount,2,'0');
    contract.SeriesPeriod[Period].isSMS = parseInt(objUpdate.isSMS);

    contract.save(function(err) {
      if(!err) {
        console.log("UpdateSMSPayment thành công hợp đồng: " + objUpdate.contractId);
        res.status(200).json(contract);
      }
      else {
        console.log("UpdateSMSPayment thất bại hợp đồng: " + objUpdate.contractId);
        res.status(200).json([]);
      }
    });
  })
  .catch(error => {
    console.log(error.message);
    console.log("UpdateSMSPayment thất bại hợp đồng: " + objUpdate.contractId);
    return res.status(200).json({result: false, message: 'Please input ContractId', data: []});
  });
};

exports.finishContract = function(req, res) {


  console.log('calculateFinishContract');
  console.log(req.params.id);

  // return res.status(200).json({result: false, message: 'Vui lòng cung cấp thông tin', data: []});

  if (req.params.id === undefined || req.params.id === '' || req.params.id === 0){
    console.log(req.params.id);
    return res.status(200).json({result: false, message: 'Vui lòng cung cấp thông tin', data: []});
  }

  Contract.find({ContractId: req.params.id})
  .then(contracts => {
    let data =[];
    let objCus = null;
    for (let i=0;i<contracts.length;i++){
      objCus = contracts[i];
      break;
    }

    if (objCus.CurrentPeriodCount >= objCus.Period)
      objCus.CurrentPeriodCount = objCus.Period;

    let tempX = 'Period_' + _.padStart(objCus.CurrentPeriodCount,2,'0');
    let currentDate = moment(Date.now()).format('YYYYMMDD');
    currentDate = moment(currentDate,'YYYYMMDD');

    let NextPaymentPeriodCount = String(objCus.CurrentPeriodCount + 1);

    if (moment(objCus.SeriesPeriod[tempX].PaymentDate,'DD-MM-YYYY') > currentDate){
      NextPaymentPeriodCount = objCus.CurrentPeriodCount;
    }

    let DifferenceAmount = 0,DifferenceAmount1 = 0;

    if (NextPaymentPeriodCount >= objCus.Period){
      NextPaymentPeriodCount = objCus.Period;
    }

    for (let i=1;i<=NextPaymentPeriodCount;i++){
      let key = 'Period_' + _.padStart(i,2,'0');
      if (objCus.SeriesPeriod[key].isFull === 0){
        DifferenceAmount += objCus.SeriesPeriod[key].Amount;
        DifferenceAmount1 += objCus.SeriesPeriod[key].RealPaymentAmount;
      }
    }

    let key = 'Period_' + _.padStart(NextPaymentPeriodCount,2,'0');
    let total = 0;
    total = (DifferenceAmount !== 0 ? DifferenceAmount :  objCus.PeriodAmount ) + objCus.PenaltyAmount + objCus.SeriesPeriod[key].OpeningAmount;
    // total = objCus.PenaltyAmount + objCus.SeriesPeriod[key].OpeningAmount;
    total = total.toFixed(0);
    objCus.SeriesPeriod[key].OpeningAmount = objCus.SeriesPeriod[key].OpeningAmount.toFixed(0);
    // changedayfee = changedayfee.toFixed(0).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    res.status(200).json({result: true,
                          message: 'ok',
                          CustomerName: objCus.CustomerName,
                          Total: total.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
                          OpeningAmount:objCus.SeriesPeriod[key].OpeningAmount.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
                          DifferenceAmount: DifferenceAmount.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
                          PenaltyAmount: objCus.PenaltyAmount.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
                          PaymentDate: objCus.SeriesPeriod[key].PaymentDate
                        });

  })
  .catch(error => {
    console.log(error.message);
    console.log('không tìm thấy khách hàng');
    res.status(200).json([]);
  });

};

exports.calculateDelayContract = function(req, res) {

  if (req.params.id === undefined || req.params.id === '' || req.params.id === 0){
    console.log(req.params.id);
    return res.status(200).json({result: false, message: 'Vui lòng cung cấp thông tin', data: []});
  }

  Contract.find({ContractId: req.params.id})
  .then(contracts => {
    let data =[];
    let objCus = null;
    for (let i=0;i<contracts.length;i++){
      objCus = contracts[i];
      break;
    }

    if (objCus === null || objCus === undefined){
      console.log('không tìm thấy khách hàng');
      return res.status(200).json([]);
    }

    if (objCus.ChangeDueDateCount >2){
      return res.status(200).json({result: false, message: 'khách hàng đã vượt quá số lần dời ngày cho phép: ' + objCus.ChangeDueDateCount});
    }else{

      let changedayfee = 0, numberofDays = 0;
      let changeDay = moment(req.params.delayDate, 'DDMMYYYY');
      // let numberofDays = 0;
      let NextPaymentPeriodCount = String(objCus.PaymentPeriodCount + 1);
      NextPaymentPeriodCount = 'Period_' + _.padStart(NextPaymentPeriodCount,2,'0');
      let CurrentPeriodCount = 'Period_' + _.padStart(objCus.PaymentPeriodCount,2,'0');

      if (objCus.SeriesPeriod[NextPaymentPeriodCount] !== undefined){
        numberofDays = changeDay.diff(moment(objCus.SeriesPeriod[NextPaymentPeriodCount].PaymentDate,'DD-MM-YYYY'),'days');// + 1;
      }

      if (Math.abs(numberofDays) > 15){
        return res.status(200).json({result: false, message: 'không thể dời quá 15 ngày'});
      }

      let OpeningAmount = 0;
      if (objCus.PaymentPeriodCount === 0){
        OpeningAmount = objCus.LoanAmount;
      }else {
        OpeningAmount = objCus.SeriesPeriod[CurrentPeriodCount].OpeningAmount;
      }

      if (numberofDays > 0){
        changedayfee = 0.04 * OpeningAmount * Math.abs(numberofDays)/365 * 12;
      }
      else if (numberofDays < 0){
        changedayfee = -0.02 * OpeningAmount * numberofDays/365 * 12;
      }

      let total = changedayfee + objCus.PeriodAmount + (objCus.DifferenceAmount * -1);
      total += (objCus.isChangeDueDate === 1 && objCus.isChangeDueDatePaid ===0) ? ChangeDueDateAmount : 0;
      if ((objCus.PaymentPeriodCount + 1) === objCus.Period){
        total += objCus.PenaltyAmount;
      }

      total = total.toFixed(0);
      changedayfee = changedayfee.toFixed(0).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
      res.status(200).json({result: true,
                            message: 'ok',
                            NextPaymentPeriodCount: objCus.PaymentPeriodCount + 1,
                            ChangeDueDateAmount:changedayfee,
                            PeriodAmount: objCus.PeriodAmount.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
                            TotalAmount: total.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
                            Dayschange: numberofDays,
                            OldPaymentDate: objCus.SeriesPeriod[NextPaymentPeriodCount].PaymentDate,
                            NewsPaymentDate: moment(req.params.delayDate, 'DD-MM-YYYY')
                          });
    }
  })
  .catch(error => {
    console.log(error.message);
    console.log('không tìm thấy khách hàng');
    res.status(200).json([]);
  });

};

exports.check_no_xau = function(req, res) {

  //check_no_xau/:CustomerCCCD/:CustomerCMND/:CustomerPhone/:RefPhone/:key
  if (!secureCompare(req.params.key, 'xxxxxx')) {
    console.log('check_no_xau key not found');
    return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  }

  let objUpdate ={
    CustomerCCCD: req.params.CustomerCCCD,
    CustomerCMND: req.params.CustomerCMND,
    CustomerPhone: req.params.CustomerPhone,
    RefPhone: req.params.RefPhone
  };

  if (objUpdate.CustomerCCCD === undefined || objUpdate.CustomerCMND === undefined
    || objUpdate.CustomerPhone === undefined || objUpdate.RefPhone === undefined) {
    return res.status(200).json({result: false, message: 'Vui lòng cung cấp thông tin', data: []});
  }

  Contract.find()
  .then(contracts => {

    let data =[];
    let isNoXau = false;

    for (let i=0;i<contracts.length;i++){
      const childSnapshot = contracts[i];
      let objCus = null;

      if (objUpdate.CustomerCCCD !== '' && childSnapshot.CustomerCCCD === objUpdate.CustomerCCCD){
        objCus = childSnapshot;
      }

      if (objUpdate.CustomerCMND !== '' && childSnapshot.CustomerCMND === objUpdate.CustomerCMND){
        objCus = childSnapshot;
      }

      if (objUpdate.CustomerPhone !== '' && childSnapshot.CustomerPhone === objUpdate.CustomerPhone){
        objCus = childSnapshot;
      }

      if (objUpdate.RefPhone !== '' && childSnapshot.CustomerPhone === objUpdate.RefPhone){
        objCus = childSnapshot;
      }

      if (objUpdate.RefPhone !== '' && childSnapshot.RefPhone === objUpdate.RefPhone){
        objCus = childSnapshot;
      }

      if (objCus !== null && objCus.OverDueDate >= 10){
        data.push(objCus.ContractId);
        isNoXau = true;
        break;
      }
    }

    if (isNoXau){
      console.log('check_no_xau is isFound');
      console.log(objUpdate);
      return res.status(200).json({result: true, message: 'khách hàng có nợ xấu', data: data});
    }else{
      console.log('check_no_xau is not found');
      console.log(objUpdate);
      return res.status(200).json({result: false, message: 'khách hàng không có nợ xấu', data: data});
    }

  })
  .catch(error => {
    console.log(error.message);
    console.log('không tìm thấy khách hàng');
    res.status(200).json([]);
  });

};

exports.getContractById = function(req, res) {

  let type = req.params.type !== undefined ? req.params.type : 'collection';
  if (req.params.id !== undefined && req.params.id !== '' && req.params.id.length !== 0){
    let searchID = new RegExp(req.params.id);
    let data = [];

    Contract.find().or([{ ContractId: searchID }, { CustomerId: searchID },{ CustomerCMND: searchID },{CustomerPhone: searchID},
                        { CustomerName: searchID },{ CustomerName1: searchID } ])
    .then(contracts => {

      for (let i=0;i<contracts.length;i++){
        let objCus = contracts[i];
        let total = 0, delayperiod = '';
        delayperiod = objCus.PaymentPeriodCount;

        if (objCus.PaymentPeriodCount < objCus.CurrentPeriodCount){ // tinh tien tre cua cac ky truoc cho den ky hien tai
          for (let i = objCus.PaymentPeriodCount+1;i<=objCus.CurrentPeriodCount;i++){
            let key = 'Period_' + _.padStart(i,2,'0');
            if (objCus.SeriesPeriod[key].Amount !== objCus.PeriodAmount && objCus.SeriesPeriod[key].RealPaymentAmount !== 0){
              total += (objCus.SeriesPeriod[key].Amount);
            }else{
              total += (objCus.SeriesPeriod[key].Amount - objCus.SeriesPeriod[key].RealPaymentAmount);
            }
          }
        }else{
            // khach hang dung han thi phai +- so tien thua thieu
            if (delayperiod + 1 <= objCus.Period){
              let Period = 'Period_' + _.padStart(delayperiod + 1,2,'0');
              objCus.NextPaymentDate = objCus.SeriesPeriod[Period].PaymentDate;
              total = objCus.SeriesPeriod[Period].Amount;
            }
        }

        total += ((objCus.isChangeDueDate === 1 && objCus.isChangeDueDatePaid === 0) ? objCus.ChangeDueDateAmount : 0);
        if ((delayperiod + 1) === objCus.Period){
          // ky cuoi nen so tien thanh toan ky tiep theo phai cong luon PenaltyAmount
          total += objCus.PenaltyAmount;
        }
        objCus.NextPayment = total;
        data.push(objCus);
      }
      res.status(200).json(data);
    })
    .catch(error => {
      console.log('không tìm thấy khách hàng');
      res.status(200).json([]);
    });
  }else{
    console.log('không có tham số đầu vào');
    res.status(200).json([]);
  }
};

exports.getOverDueContracts = function(req, res) {

  let type = req.params.type !== undefined ? parseInt(req.params.type) : 1; // 0: soon, 1: overdue
  if (req.params.days !== undefined && req.params.days !== '' && req.params.days !== 0 && isNaN(req.params.days) === false){

    let data = [];
    let days = req.params.days;
    let orderBy = '';

    Contract.find()
    .then(contracts => {

      for (let i=0;i<contracts.length;i++){
        let objCus = contracts[i];
        let OverDueDate = Math.abs(objCus.OverDueDate);
        let delayperiod = objCus.PaymentPeriodCount;
        // let total = 0;
        let total = objCus.PeriodAmount ; //+ (objCus.DifferenceAmount * -1); // 1 ky tiep theo

        if (objCus.PaymentPeriodCount < objCus.CurrentPeriodCount){ // tinh tien tre cua cac ky truoc cho den ky hien tai
          let temp = objCus.PaymentPeriodCount + 1;
          Object.keys(objCus.SeriesPeriod).forEach(function(key) {
            let tempKey = parseInt(key.substring(7,9)); // convert qua so
            if (temp < objCus.CurrentPeriodCount && tempKey < objCus.Period){
              total += objCus.SeriesPeriod[key].Amount;
              temp+=1;
            }
          })
        }else{
          // khach hang dung han thi phai +- so tien thua thieu
          // NextPaymentPeriodCount = 'Period_' + _.padStart(NextPaymentPeriodCount,2,'0');
          if (delayperiod + 1 <= objCus.Period){
            let Period = 'Period_' + _.padStart(delayperiod + 1,2,'0');
            objCus.NextPaymentDate = objCus.SeriesPeriod[Period].PaymentDate;
            if (objCus.SeriesPeriod[Period].RealPaymentAmount !==0){
                total = objCus.SeriesPeriod[Period].DifferenceAmount;
            }else{
                total = objCus.SeriesPeriod[Period].Amount;
            }
          }
        }

        if ((delayperiod + 1) === objCus.Period){
          // ky cuoi nen so tien thanh toan ky tiep theo phai cong luon PenaltyAmount
          total += objCus.PenaltyAmount;
        }

        if (type === 1){
            // tre han
          orderBy = 'desc';
          // cheat code
          days = 500;
        }else{
          orderBy = 'asc';
        }

        if (total > 0 && OverDueDate <= days && (type === 1 ? objCus.OverDueDate > 0 : objCus.OverDueDate <0) && objCus.Status === 1 && objCus.PaymentPeriodCount < objCus.Period){
          objCus['numberofDays'] = OverDueDate;
          objCus.NextPayment = total;
          let districts = req.params.districts.split(',');
          if (parseInt(districts[0]) === -999){
            data.push(objCus);
          }else{
            for (let j=0;j<districts.length;j++){
              if (objCus.CompanyAddress_district_id === parseInt(districts[j])
                || objCus.CustomerAddress_district_id === parseInt(districts[j])
                || objCus.CustomerTempAddress_district_id === parseInt(districts[j])){
                  data.push(objCus);
                  break;
                }
            }
          }
        }
      }
      res.status(200).json(data);
    })
    .catch(error => {
      console.log('Lỗi tìm không thấy dữ liệu');
      console.log(error.message);
      res.status(200).json([]);
    });
  }else{
    console.log('không có tham số đầu vào');
    res.status(200).json([]);
  }
};


exports.create_a_contract = function(req, res) {
  var new_contract = new Contract(req.body);
  new_contract.save(function(err, contract) {
    if (err)
      res.send(err);
    res.json(contract);
  });
};

exports.read_a_contract = function(req, res) {
  Contract.findById(req.params.contractId, function(err, contract) {
    if (err)
      res.send(err);
    res.json(contract);
  });
};


exports.update_a_task = function(req, res) {
  Contract.findOneAndUpdate({_id: req.params.contractId}, req.body, {new: true}, function(err, contract) {
    if (err)
      res.send(err);
    res.json(contract);
  });
};


exports.delete_a_task = function(req, res) {
  Contract.remove({
    _id: req.params.contractId
  }, function(err, contract) {
    if (err)
      res.send(err);
    res.json({ message: 'Contract successfully deleted' });
  });
};
