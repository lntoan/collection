'use strict';

require('dotenv').config();
var Json2csvParser = require('json2csv').Parser;
var base64Img = require('base64-img');
var mongoose = require('mongoose'),
  Field = mongoose.model('Field'),
  DocumentCode = mongoose.model('DocumentCode'),
  User = mongoose.model('User'),
  Contract = mongoose.model('Contract');
const _ = require('lodash');
const secureCompare = require('secure-compare');
const moment = require('moment');
const xoa_dau = require('../utils/xoa_dau');
const ContractById = require('../utils/contract');
const map = require('../utils/map');
const fetch = require('node-fetch');
const os = require('os');

var googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_KEY,
  Promise: Promise
});

exports.GetListDocumentsByUserId = function(req, res) {

  if (!secureCompare(req.params.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: []});
  }

  DocumentCode.find({UserId_Created:req.params.userid}, function(err, documents) {
    if (err)
      return res.status(200).json({result: false, message: 'Không lấy được data', data: []});

    let objData = [];
    for (let i =0;i<documents.length;i++){
      let objImage = [];
      Object.keys(documents[i].Images).forEach(function(key) {
        objImage.push(process.env.HOST_NAME + '/upload/documents/' + documents[i].Images[key].imageUrl.split('/')[4] + '/' + documents[i].Images[key].imageUrl.split('/')[5]);
      })
      objData.push({DocumentCode: documents[i].DocumentCode,
        CustomerName: documents[i].CustomerName,
        DocumentStatus: documents[i].DocumentStatus === 0 ? 'Chưa xử lý' : documents[i].DocumentStatus === 1 ? 'Approved' : documents[i].DocumentStatus === 2 ? 'Từ chối' : 'Pending',
        DocumentNote: documents[i].DocumentNote,
        CreatedDate: documents[i].CreatedDate,
        Images: objImage
      })
    }
    return res.status(200).json({result: true, message: 'Danh sách documents', data: objData});
  });
};

exports.GetDocumentImages = function(req, res) {

  if (!secureCompare(req.params.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: [], status: ''});
  }

  DocumentCode.find({DocumentCode:req.params.documentCode}, function(err, documents) {
    if (err)
      return res.status(200).json({result: false, message: 'Không lấy được data', data: [],status: ''});

    let objData = [];

    if (documents[0].Images === undefined){
      return res.status(200).json({result: false, message: 'DocumentCode không có hình ảnh ', data: [],status: ''});
    }

    Object.keys(documents[0].Images).forEach(function(key) {
      objData.push(process.env.HOST_NAME + '/upload/documents/' + documents[0].Images[key].imageUrl.split('/')[4] + '/' + documents[0].Images[key].imageUrl.split('/')[5]);
    })

    let status = '';// 0: chua xu ly, 1: approve, 2: tu choi,3: pending
    switch (documents[0].DocumentStatus) {
      case 0:
        status = 'Chưa xử lý';
      case 1:
        status = 'Đã xác nhận';
        break;
      case 2:
        status = 'Đã từ chối';
        break;
      default:
        status = 'Pending';
    }
    return res.status(200).json({result: true, message: 'Danh sách hình ảnh', data:objData,status:status});
  });
};

exports.UploadImage = function(req, res) {

  let objData = req.body;
  if (!secureCompare(objData.key, process.env.KEY)) {
    console.log('Security key not match');
    return res.status(200).json({result: false, message: 'Security key not match', data: objData.fieldsAddress});
  }

  let foldername = '../images/upload/documents/' + moment(Date.now()).format('YYYYMM');
  base64Img.img(objData.data[0].base64, foldername, objData.data[0].filename, function(err, filepath) {

    if (err){
      console.log(err);
      return res.status(200).json({result: false, message: 'Upload hình ảnh thất bại: ' + documentCode, data: []});
    }

    DocumentCode.findOne().and([{DocumentCode: objData.documentCode}])
    .then(objDoc => {

      if (objDoc === null){
        // create new_contract
        console.log('objDoc is null');
        console.log(filepath);
        let objUpdate = {};
        let periodObj = {imageUrl: ''};

        objUpdate['Images'] = {};
        periodObj.imageUrl = filepath;
        objUpdate.Images['Images_01'] = periodObj;
        objUpdate['DocumentCode'] = objData.documentCode;
        objUpdate['UserId_Created'] = objData.userid
        objUpdate['CustomerName'] = '';
        objUpdate['DocumentNote'] = '',
        objUpdate['DocumentStatus'] = 0;
        objUpdate['CreatedDate'] = moment(Date.now()).format('DD/MM/YYYY');

        var new_document = new DocumentCode(objUpdate);
        new_document.save(function(err, documentCode) {
          if (err){
            console.log(err);
            console.log('Upload hình ảnh thất bại 1');
            return res.status(200).json({result: false, message: 'Upload hình ảnh thất bại: ' + documentCode, data: []});
          }
          return res.status(200).json({result: true, message: 'upload image thành công', data: filepath});
        });

      }else{
        console.log('objDoc is not null');
        console.log(filepath);
        let length = 1;
        if (objDoc.Images !== undefined){
          Object.keys(objDoc.Images).forEach(function(key) {
            length++;
          });
        }

        let ImamgePeriod = 'Images_' + _.padStart(length,2,'0');
        let periodObj = {imageUrl: ''};
        periodObj.imageUrl = filepath;

        objDoc.Images[ImamgePeriod] = periodObj;

        objDoc.markModified('Images');
        objDoc.save(function(err,documentcode) {
          if(!err) {
            console.log('Upload hình ảnh thành công');
            return res.status(200).json({result: true, message: 'upload image thành công', data: filepath});
          }
          else {
            console.log('Upload hình ảnh thất bại 2');
            console.log(err);
            return res.status(200).json({result: false, message: 'Upload hình ảnh thất bại', data: []});
          }
        })
      }
    })
    .catch(error => {
      console.log(error.message);
      console.log('Upload hình ảnh thất bại 3');
      console.log(err);
      return res.status(200).json({result: false, message: 'Upload hình ảnh thất bại', data: []});
    });

  });

};

exports.UpdateDocument = function(req, res) {

  let objData = req.body;
  if (!secureCompare(objData.key, process.env.KEY)) {
    console.log('Security key not match');
    return res.status(200).json({result: false, message: 'Security key not match', data: objData.fieldsAddress});
  }

  console.log(objData);
  DocumentCode.findOne().and([{DocumentCode: objData.documentCode}])
  .then(objDoc => {
    if (objDoc !== null){
      objDoc['DocumentNote'] = objData.DocumentNote;
      objDoc['DocumentStatus'] = objData.DocumentStatus;
      objDoc['UserId_Updated'] = objData.UserId_Updated;
      objDoc['UpdatedDate'] = objData.UpdatedDate;
      objDoc.save(function(err,documentcode) {
        if(!err) {
          console.log('Cập nhật thành công');
          return res.status(200).json({result: true, message: 'Cập nhật thành công'});
        }
        else {
          console.log('Cập nhật thất bại');
          console.log(err);
          return res.status(200).json({result: false, message: 'Cập nhật thất bại'});
        }
      })
    }else{
      console.log('Cập nhật thất bại');
      return res.status(200).json({result: false, message: 'Không tìm thấy documentCode: ' + objData.documentCode});
    }
  })
};

exports.SaveContact = function(req, res) {

  let objData = req.body;
  console.log('xxxxxxx');
  console.log(objData);
  if (!secureCompare(objData.key, process.env.KEY)) {
    console.log('Security key not match');
    return res.status(200).json({result: false, message: 'Security key not match', data: []});
  }

  if (objData.data === undefined) {
    console.log('Security key not match');
    return res.status(200).json({result: false, message: 'Vui lòng cung cấp data', data: []});
  }

  let user = new User;
  let data = [];
  user.set('PhoneNumber', objData.data.PhoneNumber);
  user.set('ContractId', objData.data.ContractId);
  user.set('ContactList',objData.data.ContactList);
  user.set('Calllog',objData.data.Calllog);
  user.save(function(err,user) {
    if(!err) {
      console.log('Cập nhật thông tin khách hàng thành cồng');
      data.push(user);
      return res.status(200).json({result: true, message: 'ok', data: user});
    }
    else {
      console.log('Cập nhật thông tin khách hàng thất bại');
      console.log(err);
      return res.status(200).json({result: false, message: 'has error', data: []});
    }
  })

};

exports.ExportAddress = function(req, res) {

  Contract.find({}, function(err, contracts) {
    if (err)
      res.send(err);

    let objData = [];
    for(let i=0;i<contracts.length;i++){
      let objContract = contracts[i];
      if (objContract.ContractId !== 'B8888YYYY' && objContract.ContractId !== 'B9999XXXX' && objContract.ContractId !== 'XXXXX'
      && objContract.ContractId !== 'B3393SZEX' && objContract.ContractId !== 'B9939AFUS'){

        let RunningTotal = objContract.RunningTotal;
        if (objContract.RawData !== undefined){

          console.log('Start: ' + RunningTotal);
          Object.keys(objContract.RawData).forEach(function(key) {
            if (parseInt(moment(objContract.RawData[key].RealPaymentAmount.split('***')[0],'DD-MM-YYYY').format('YYYYMMDD')) > 20181031){
              RunningTotal -=  Number(objContract.RawData[key].RealPaymentAmount.split('***')[1]);
              console.log('tung cai ngay: ' + objContract.RawData[key].RealPaymentAmount.split('***')[0]);
              console.log('tung cai:' + Number(objContract.RawData[key].RealPaymentAmount.split('***')[1]));
            }
          })
          // if (isChangeDueDatePaid === 1 && parseInt(moment(objContract.ChangeDueDatePaid,'DD-MM-YYYY').format('YYYYMMDD')) > 20181031){
          //   RunningTotal -= objContract.ChangeDueDateAmount;
          // }
          console.log('End: ' + RunningTotal);
        }
        objData.push({Ma_Hop_Dong: objContract.ContractId,
                     Ngay_Ky: "'" + objContract.ContractDate,
                     Tien_Vay_Goc: objContract.LoanAmount,
                     Tien_Tra_Truoc: objContract.DepositAmount,
                     Tien_Thuc_Thu: RunningTotal,
                     Tien_Phai_Tra_Moi_Ky: objContract.PeriodAmount,
                     Tien_Phat: objContract.PenaltyAmount,
                     Ngay_Thanh_Toan_Tiep_Theo: "'" + objContract.NextPaymentDate,
                     Tien_Doi_Ngay: objContract.ChangeDueDateCount >= 1 ? objContract.ChangeDueDateAmount : 0
          });

      }
    }
    res.json(objData);
  });
};

exports.getTest1 = function(req, res) {
  // if (!secureCompare(req.params.key, process.env.KEY)) {
  //   return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  // }

  Contract.find().and([{Period:{$gt:0} },{Status:1}])
  .then(contracts => {
    let updates = [];
    for (let i=0;i<contracts.length;i++){
      if (contracts[i].ContractId === 'B3906JHMF'){
        console.log('vao day');
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
                // if (OverDueDate > 4 && (objContract.SeriesPeriod[key].DifferenceAmount !== 0 ? objContract.SeriesPeriod[key].DifferenceAmount : objContract.SeriesPeriod[key].Amount) > PaymentAmount05){

                if (OverDueDate > 4){
                  // objContract.SeriesPeriod[key].PenaltyAmount = 0.08 * (objContract.SeriesPeriod[key].DifferenceAmount);
                  // if (key === 'Period_04'){
                  //   console.log('kkaaka');
                  //   console.log(PaymentDate);
                  //   console.log(OverDueDate);
                  // }

                  console.log('du dieu kien tinh tien phat');
                  console.log(objContract.ContractId);
                  objContract.SeriesPeriod[key].PenaltyAmount = 0.08 * objContract.SeriesPeriod[key].Amount;
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
          // let updatePromise = Contract.updateOne({"_id": objContract._id}, {"$set": objContract});
          updates.push(objContract);
        }
      }
    } // end for

    return res.status(200).json({result: true,data: updates});

  })
  .catch(error => {
    console.log(error.message);
    return res.status(200).json({result: false});
  });
};

exports.AllContract = function(req, res) {

  if (!secureCompare(req.params.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: []});
  }

  Contract.find({Status:req.params.isActive}, function(err, contracts) {
    if (err)
      res.send(err);

    let objData = [];
    for(let i=0;i<contracts.length;i++){
      let objContract = contracts[i];
      if (objContract.ContractId !== 'B8888YYYY' && objContract.ContractId !== 'B9999XXXX' && objContract.ContractId !== 'XXXXX'
      && objContract.ContractId !== 'B3393SZEX' && objContract.ContractId !== 'B9939AFUS'){
        let key = 'Period_' + _.padStart(objContract.PaymentPeriodCount,2,'0');
        let isSpecial = objContract['isSpecial'] === undefined ? 0 : objContract['isSpecial'];
        let OpeningAmount = 0;
        if (isSpecial === 1){
          OpeningAmount = objContract.PaymentPeriodCount === 0 ? objContract.LoanAmount_Org : objContract.SeriesPeriod[key].OpeningAmount_Org;
        }else{
          OpeningAmount = objContract.PaymentPeriodCount === 0 ? objContract.LoanAmount : objContract.SeriesPeriod[key].OpeningAmount;
        }

        let objRawData = [];let RawAmount = 0;
        if (objContract.RawData !== undefined){
          let j = 1;
          Object.keys(objContract.RawData).forEach(function(key) {
            let obj = {};
            let fieldname = 'Tien_' + _.padStart(j,2,'0');
            let fieldname1 = 'Ky_' + _.padStart(j++,2,'0');
            // let fieldname = objContract.RawData[key].RealPaymentAmount.split('***')[0];
            if (parseInt(moment(objContract.RawData[key].RealPaymentAmount.split('***')[0],'DD-MM-YYYY').format('YYYYMMDD')) <= 20181031){
              obj[fieldname1] = objContract.RawData[key].RealPaymentAmount.split('***')[0];
              obj[fieldname] = Number(objContract.RawData[key].RealPaymentAmount.split('***')[1]);
              RawAmount+=Number(objContract.RawData[key].RealPaymentAmount.split('***')[1]);
              objRawData.push(obj);
            }
          })
        }

        objData.push({Ma_Hop_Dong: objContract.ContractId,
                     // Phone: objContract.CustomerPhone,
                     // Ngay_Hop_Dong: objContract.ContractDate,
                     // Ngay_Qua_Han: objContract.OverDueDate,
                     // Tong_So_Ky: objContract.Period,
                     So_Tien_Moi_Ky: objContract.PeriodAmount,
                     // Vay_Goc: objContract.LoanAmount.toFixed(1),
                     // Du_No_Goc_Con_Lai: OpeningAmount.toFixed(1),
                     // Trang_Thai: objContract.Status === 1 ? 'Đang hoạt động' : 'Đã tất toán',
                     // Loai_Hop_Dong: isSpecial === 1 ? 'Tính lại theo hệ thống' : 'Tính theo hợp đồng giấy',
                     Da_Thu_RawAmount_Den_31102018: RawAmount,
                     RunningTotal: objContract.RunningTotal,
                     Tra_Truoc: objContract.DepositAmount,
                     RawAmount:RawAmount

          });
          if (objRawData.length > 0){
            for (let i=0;i<objRawData.length;i++){
             Object.assign(objData[objData.length-1], objRawData[i]);
            }
          }
      }
    }
    res.json(objData);
  });
};


exports.suggestionRoute = function(req, res) {

  let objData = req.body;

  if (!secureCompare(objData.key, process.env.KEY)) {
    console.log('Security key not match');
    return res.status(200).json({result: false, message: 'Security key not match', data: objData.fieldsAddress});
  }

  if (objData.fieldsAddress === undefined || objData.fieldsAddress.length === 0) {
    console.log('Please input objData');
    return res.status(200).json({result: false, message: 'Please input objData', data: objData.fieldsAddress});
  }

  if (objData.LatLong === 'undefined') {
    console.log('objData.LatLong');
    return res.status(200).json({result: false, message: 'Please input objData', data: objData.fieldsAddress});
  }

  // googleMapsClient.reverseGeocode ({latlng: [10.783171,106.701244]})

  googleMapsClient.reverseGeocode ({latlng: [objData.LatLong.latitude,objData.LatLong.longitude]})
    .asPromise()
    .then((response) => {
      if (response.json.results[0].formatted_address !== undefined){
        let currentAddress = response.json.results[0].formatted_address;
        let fieldsAddress = objData.fieldsAddress;
        let finalRoute = [];
        let totalkm = 0;
        map.suggestionRoute1(currentAddress,fieldsAddress,fieldsAddress.length,finalRoute,function(result,totalkm){
          if (result.length === 0){
            return res.status(200).json({result: true, message: 'Không lấy được lộ trình đi', data: objData.fieldsAddress});
          }
          let fields  = [];
          for (let i=0;i<result.length;i++){
            fields.push({
              employee_id: result[i].employee_id,
              employee_name: result[i].account,
              customer_id: result[i].customer_id,
              customer_name: result[i].customer_name,
              addres_from: result[i].from,
              addres_to: result[i].to,
              distance_value: result[i].value,
              distance_text: result[i].text,
              orderBy: result[i].orderBy,
              field_date: Date.now().toString(),
              field_id: result[i].id
            });
            totalkm += result[i].value;
          }

          let updates = [];
          for (let i=0;i<fields.length;i++){
            let updatePromise = Field.updateOne({'field_id': fields[i].field_id},
                      {$set:fields[i]},
                      {upsert: true, new: true, runValidators: true});
            updates.push(updatePromise);
          }

          Promise.all(updates).then(function(results){
            console.log(results);
            for (let i=0;i<result.length;i++){
              for (let j=0;j<results.length;j++){
                if (result[i].customer_id === results[j].customer_id){
                  result[i]['_id'] = results[j]._id;
                  break;
                }
              }
            }
            return res.status(200).json({result: true, message: 'Lộ Trình Đi', data: result,totalkm: totalkm});
          });
          // Field.insertMany(fields)
          //   .then(function (docs) {
          //     for (let i=0;i<result.length;i++){
          //       for (let j=0;j<docs.length;j++){
          //         if (result[i].customer_id === docs[j].customer_id){
          //           result[i]['_id'] = docs[j]._id;
          //           break;
          //         }
          //       }
          //     }
          //     return res.status(200).json({result: true, message: 'Lộ Trình Đi', data: result,totalkm: totalkm});
          //   })
          //   .catch(function (err) {
          //     console.log(err.message);
          //     return res.status(200).json({result: true, message: 'Không lưu được lộ trình đi', data: objData.fieldsAddress});
          //   });

        });
      }else{
        return res.status(200).json({result: true, message: 'Lộ Trình Đi', data: objData.fieldsAddress});
      }
    })
    .catch((err) => {
      console.log(err);
      return res.status(200).json({result: true, message: 'Không lấy được lộ trình đi', data: objData.fieldsAddress});
    });

};


exports.getpaymentlist = function(req, res) {

  if (!secureCompare(req.params.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: []});
  }
  //
  if (req.params.fromdate === undefined || req.params.fromdate === '' ||
      req.params.todate === undefined || req.params.todate === '') {
    return res.status(200).json({result: false, message: 'Vui lòng chọn ngày xem báo cáo', data: []});
  }
  //
  let data = [];

  let fromdate = parseInt(req.params.fromdate);
  let todate = parseInt(req.params.todate);


  Contract.find({}, function(err, contracts) {
    for (let i=0;i<contracts.length;i++){
      let contract = contracts[i];

      if (contract.RawData !== undefined){
        Object.keys(contract.RawData).forEach(function(key) {
          let period = key;
          let paymentDate = parseInt(moment(contract.RawData[period].RealPaymentAmount.split('***')[0],'DD-MM-YYYY').format('YYYYMMDD'));
          if (fromdate <= paymentDate && paymentDate <=todate){
            let amount = contract.RawData[period].RealPaymentAmount.split('***')[1];
            let paymentPeriod = 'Period_' + _.padStart(contract.PaymentPeriodCount === 0 ? 1 : contract.PaymentPeriodCount,2,'0');
            if (contract.isChangeDueDatePaid === 1){
              let changeDatePaid = parseInt(moment(contract.ChangeDueDatePaid,'DD-MM-YYYY').format('YYYYMMDD'));
              if (changeDatePaid === paymentDate){
                amount -= contract.ChangeDueDateAmount;
                data.push({
                  'hien_thi_tren_so': '',
                  'ngay_chung_tu': contract.RawData[period].RealPaymentAmount.split('***')[0],
                  'ngay_hach_toan': '',
                  'so_chung_tu': '',
                  'ma_khach_hang': contract.CustomerId,
                  'ten_khach_hang': contract.CustomerName,
                  'dia_chi': contract.CustomerAddress,
                  'nop_vao_tai_khoan': contract.SeriesPeriod[paymentPeriod].Bank === 'ACB' ? '30970978' : '0721000618486',
                  'mo_tai_ngan_hang': contract.SeriesPeriod[paymentPeriod].Bank === 'ACB' ? 'Ngân hàng Á Châu' : 'Ngân hàng TMCP Ngoại thương Việt Nam',
                  'dien_giai': 'Phí dời ngày khách hàng ' + contract.CustomerName,
                  'nhan_vien': '',
                  'loai_tien': 'VND',
                  'ty_gia': '',
                  'dien_giai_chi_tiet' : '',
                  'tk_no': '',
                  'tk_co': '',
                  'nguyen_te': '',
                  'so_tien': contract.ChangeDueDateAmount.toFixed(0),
                  'doi_tuong': '',
                  'so_hop_dong': contract.ContractId
                });
              }
            }

            data.push({
              'hien_thi_tren_so': '',
              'ngay_chung_tu': contract.RawData[period].RealPaymentAmount.split('***')[0],
              'ngay_hach_toan': '',
              'so_chung_tu': '',
              'ma_khach_hang': contract.CustomerId,
              'ten_khach_hang': contract.CustomerName,
              'dia_chi': contract.CustomerAddress,
              'nop_vao_tai_khoan': contract.SeriesPeriod[paymentPeriod].Bank === 'ACB' ? '30970978' : '0721000618486',
              'mo_tai_ngan_hang': contract.SeriesPeriod[paymentPeriod].Bank === 'ACB' ? 'Ngân hàng Á Châu' : 'Ngân hàng TMCP Ngoại thương Việt Nam',
              'dien_giai': 'Thu tiền khách hàng ' + contract.CustomerName,
              'nhan_vien': '',
              'loai_tien': 'VND',
              'ty_gia': '',
              'dien_giai_chi_tiet' : '',
              'tk_no': '',
              'tk_co': '',
              'nguyen_te': '',
              'so_tien': Number(amount).toFixed(0),
              'doi_tuong': '',
              'so_hop_dong': contract.ContractId
            });
          }
        });
      }
    }
    return res.status(200).json({result: true, data: data});
  });
};

exports.list_all_contracts = function(req, res) {
  return;
  Contract.find({}, function(err, contract) {
    if (err)
      res.send(err);
    console.log(contract);
    res.json(contract);
  });
};

exports.ReceivedAmountContract = function(req, res) {

  console.log('lengoctoan');
  let objData = req.body;
  console.log('lengoctoan111');
  console.log(objData);
  if (!secureCompare(objData.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  }

  if (objData.ContractId === undefined || objData.ContractId === '') {
    return res.status(200).json({result: false, message: 'Please input objData', data: []});
  }

  Contract.findOne().and([{ContractId: objData.ContractId},{Status:1}])
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
          objCus.ChangeDueDatePaid = objData.PaymentDate;
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

        // console.log('chet o day ah');
        if (objCus.RawData !== undefined){
          Object.keys(objCus.RawData).forEach(function(key) {
            length++;
          });
        }else{
          objCus['RawData'] = {};
        }

        let RawPeriod = 'Period_' + _.padStart(length,2,'0');

        // objCus.RawData[RawPeriod] = {
        //   RealPaymentDate: 'Amount_' + objData.PaymentDate,
        //   RealPaymentAmount: objData.PaymentDate + '***' + RawAmount
        // };
        //
        // objCus.markModified('RawData');

        objCus.markModified('SeriesPeriod');

        //return res.status(200).json({result: true, message: 'ok', data: objCus});

        objCus.save(function(err,contract) {
          if(!err) {
            console.log('Cập nhật thanh toán thành cồng cho hợp đồng: ' + objCus.ContractId + ' với số tiền: ' + objData.Amount);
            data.push(contract);
            return res.status(200).json({result: true, message: 'ok', data: data});
          }
          else {
            console.log('Cập nhật thanh toán thất bại cho hợp đồng: ' + objCus.ContractId + ' với số tiền: ' + objData.Amount);
            console.log(err);
            return res.status(200).json({result: false, message: 'has error', data: data});
          }
        })
      }
    })
  .catch(error => {
    console.log(error.message);
    console.log('không tìm thấy mã hợp đồng: ' + objData.ContractId);
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

  // objUpdate.contract['RawData'] = {};
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

  if (!secureCompare(req.params.key, process.env.KEY)) {
    return res.status(200).json({result: false, message: 'Security key not match', data: ''});
  }

  Contract.find().and([{Period:{$gt:0} },{Status:1}])
  .then(contracts => {
    let updates = [];
    for (let i=0;i<contracts.length;i++){
      if (contract[i].contractId === 'B3906JHMF'){
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

  console.log(objUpdate);
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

  console.log('xxxxxx');
  console.log(req.params.id);
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
    console.log(error);
    console.log('không tìm thấy khách hàng');
    res.status(200).json([]);
  });

};

exports.check_no_xau = function(req, res) {

  //check_no_xau/:CustomerCCCD/:CustomerCMND/:CustomerPhone/:RefPhone/:key
  if (!secureCompare(req.params.key, process.env.KEY)) {
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
        console.log('co vao day ko CustomerCCCD');
        objCus = childSnapshot;
      }

      if (objUpdate.CustomerCMND !== '' && childSnapshot.CustomerCMND === objUpdate.CustomerCMND){
        console.log('co vao day ko CustomerCMND');
        objCus = childSnapshot;
      }

      if (objUpdate.CustomerPhone !== '' && childSnapshot.CustomerPhone === objUpdate.CustomerPhone){
        console.log('co vao day ko CustomerPhone');
        objCus = childSnapshot;
      }

      if (objUpdate.RefPhone !== '' && childSnapshot.CustomerPhone === objUpdate.RefPhone){
        console.log('co vao day ko RefPhone');
        objCus = childSnapshot;
      }

      if (objUpdate.RefPhone !== '' && childSnapshot.RefPhone === objUpdate.RefPhone){
        console.log('co vao day ko RefPhone 1');
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
                        { CustomerName: searchID },{ CustomerName1: searchID }, ])
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

        // if (total > 0 && OverDueDate <= days && (type === 1 ? objCus.OverDueDate > 0 : objCus.OverDueDate <0) && objCus.Status === 1 && objCus.PaymentPeriodCount < objCus.Period){
        if (total > 0 && OverDueDate <= days && objCus.OverDueDate > -3 && objCus.Status === 1 && objCus.PaymentPeriodCount < objCus.Period){
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
