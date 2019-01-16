var googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_KEY,
  Promise: Promise
});

const utils = require('./xoa_dau');
var OneSignal = require('onesignal-node');
const _ = require('lodash');
// let finalRoute = [];
// let totalkm = 0;

function sendNotiMessage(message,filter){

  var myClient = new OneSignal.Client({
      userAuthKey: process.env.ONE_SIGNAL_AUTH_KEY,
      app: { appAuthKey: process.env.ONE_SIGNAL_COLLECTION_KEY, appId: process.env.ONESIGNAL_APP_ID }
  });

  // we need to create a notification to send
  var firstNotification = new OneSignal.Notification({
      contents: {
          en: message,
      }
  });

    // set target users
  let Usertags = [];
  Usertags.push(filter);
  // Usertags.push({key:'uid',relation:'=',value:contractId});
  // firstNotification.postBody["tags"] = [{key:'uid',relation:'=',value:contractId}];
  firstNotification.postBody["tags"] = Usertags;
  // firstNotification.postBody["data"] = {"abc": "123", "foo": "bar"};

  // send this notification to All Users except Inactive ones
  myClient.sendNotification(firstNotification, function (err, httpResponse,data) {
     if (err) {
         console.log('Something went wrong...');
     } else {
         console.log(data, httpResponse.statusCode);
     }
  });
}

module.exports.sendNotiMessage = sendNotiMessage;
