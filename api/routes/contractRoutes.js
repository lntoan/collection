'use strict';
module.exports = function(app) {
  var contracList = require('../controllers/contractController');

  // todoList Routes
  app.route('/contracts')
    .get(contracList.list_all_contracts)
    .post(contracList.create_a_contract);

  app.route('/contracts/getContractById/:id/:type')
    .get(contracList.getContractById);
    // .put(contracList.update_a_contract)
    // .delete(contracList.delete_a_contract);
  app.route('/contracts/getOverDueContracts/:days/:type/:districts')
    .get(contracList.getOverDueContracts);

  app.route('/contracts/check_no_xau/:CustomerCCCD/:CustomerCMND/:CustomerPhone/:RefPhone/:key')
    .get(contracList.check_no_xau);

  app.route('/contracts/calculateDelayContract/:id/:delayDate')
    .get(contracList.calculateDelayContract);

  app.route('/contracts/calculateFinishContract/:id')
    .get(contracList.finishContract);

  app.route('/contracts/updateComment')
    .put(contracList.updateComment);

  app.route('/contracts/UpdateDelayContract')
    .put(contracList.UpdateDelayContract);

  app.route('/contracts/UpdateSMSPayment')
    .put(contracList.UpdateSMSPayment);

  app.route('/contracts/updateOverDueDate/:key')
    .put(contracList.updateOverDueDate);

  app.route('/contracts/CreateContract')
    .post(contracList.CreateContract);

  app.route('/contracts/ReceivedAmountContract')
    .post(contracList.ReceivedAmountContract);

  app.route('/contracts/getpaymentlist/:fromdate/:todate/:key')
    .get(contracList.getpaymentlist);

  app.route('/contracts/getTest')
    .get(contracList.getTest);

  app.route('/contracts/AllContract/:isActive/:key')
    .get(contracList.AllContract);

  app.route('/contracts/suggestionRoute')
    .post(contracList.suggestionRoute);

  app.route('/contracts/UploadImage/')
    .post(contracList.UploadImage);

  app.route('/contracts/UpdateDocument/')
    .post(contracList.UpdateDocument);

  app.route('/contracts/GetDocumentImages/:documentCode/:key')
    .get(contracList.GetDocumentImages);

  app.route('/contracts/GetListDocumentsByUserId/:userid/:key')
    .get(contracList.GetListDocumentsByUserId);

  app.route('/contracts/SaveContact')
    .post(contracList.SaveContact);

  app.route('/contracts/GetUserFromPhone/:phoneNumber/:key')
  .get(contracList.GetUserFromPhone);

  app.route('/contracts/GetCallLogFromPhone/:phoneNumber/:key')
  .get(contracList.GetCallLog);

  app.route('/contracts/updateCRMContractId')
    .post(contracList.updateCRMContractId);
};
