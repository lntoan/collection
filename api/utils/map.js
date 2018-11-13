var googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_KEY,
  Promise: Promise
});

const _ = require('lodash');

function suggestionRoute(arrAddress,fnccallback){

  let fieldsAddress = [];

  for (let i=0;i<arrAddress.length;i++){
    fieldsAddress.push(arrAddress[i].address);
  }

  googleMapsClient.distanceMatrix({
      origins: fieldsAddress,
      destinations: fieldsAddress
    })
    .asPromise()
    .then(function(response) {
      if (response.status === 200){
        let arrayIndex = [];
        let existsRoute = [];
        let orderBy = 0;
        existsRoute.push(0);

        while(existsRoute.length <= fieldsAddress.length-1){
          let min = 999999999;
          let index = arrayIndex.length === 0 ? 0 : arrayIndex[arrayIndex.length-1].route;
          let route = 0, text = '';
          for (let j=0;j<response.json.rows[index].elements.length;j++){
            if (response.json.rows[index].elements[j].status === 'OK' && response.json.rows[index].elements[j].distance.value >0
            && !existsRoute.includes(j)){
              if (min > response.json.rows[index].elements[j].distance.value){
                min = response.json.rows[index].elements[j].distance.value;
                text = response.json.rows[index].elements[j].distance.text;
                route = j;
              }
            }
          }
          arrayIndex.push({
            from:fieldsAddress[index],
            to: fieldsAddress[route],
            text: text,
            value: min,
            route: route,
            orderBy:orderBy++
          });
          arrAddress[route]['from'] = arrayIndex[arrayIndex.length-1].from;
          arrAddress[route]['to'] = arrayIndex[arrayIndex.length-1].to;
          arrAddress[route]['orderBy'] = arrayIndex[arrayIndex.length-1].orderBy;
          arrAddress[route]['distance_value'] = arrayIndex[arrayIndex.length-1].value;
          arrAddress[route]['distance_text'] = arrayIndex[arrayIndex.length-1].text;
          existsRoute.push(route);
        }
        arrAddress = _.orderBy(arrAddress, ['orderBy'],['asc']);
        let temp = [];
        let totalkm = 0;
        for (let i=0;i<arrAddress.length;i++){
          if (arrAddress[i].orderBy !== -1){
            temp.push(arrAddress[i]);
            totalkm+=arrAddress[i].distance_value;
          }
        }
        console.log('xxxxxxxx');
        console.log(temp);
        return fnccallback(temp,totalkm);
      }else{
        return fnccallback(arrAddress);
      }
    })
    .catch((err) => {
      console.log(err);
      return fnccallback(arrAddress);
    });
}

// function suggestionRoute1(arrAddress,fnccallback){
//
//   let
//   googleMapsClient.distanceMatrix({
//       origins: arrAddress,
//       destinations: arrAddress
//     })
//     .asPromise()
//     .then(function(response) {
//       if (response.status === 200){
//         let arrayIndex = [];
//         let existsRoute = [];
//         existsRoute.push(0);
//         while(existsRoute.length <= arrAddress.length-1){
//           let min = 999999999;
//           let index = arrayIndex.length === 0 ? 0 : arrayIndex[arrayIndex.length-1].route;
//           let route = 0, text = '';
//           for (let j=0;j<response.json.rows[index].elements.length;j++){
//             if (response.json.rows[index].elements[j].status === 'OK' && response.json.rows[index].elements[j].distance.value >0 && !existsRoute.includes(j)){
//               if (min > response.json.rows[index].elements[j].distance.value){
//                 min = response.json.rows[index].elements[j].distance.value;
//                 text = response.json.rows[index].elements[j].distance.text;
//                 route = j;
//               }
//             }
//           }
//           arrayIndex.push({
//             address: arrAddress[route],
//             text: text,
//             value: min,
//             route: route
//           });
//           existsRoute.push(route);
//         }
//         return fnccallback(arrayIndex);
//       }else{
//         return fnccallback([]);
//       }
//     })
//     .catch((err) => {
//       console.log(err);
//       return fnccallback([]);
//     });
// }


module.exports.suggestionRoute = suggestionRoute;
