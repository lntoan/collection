var googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_KEY,
  Promise: Promise
});

const _ = require('lodash');
// let finalRoute = [];
// let totalkm = 0;

function suggestionRoute1(arrAddress,destinations,length,finalRoute,fncallback){

  findNearestPlace(arrAddress,destinations,function(result){
    if (destinations.length > 0  && result.length > 0){
      let temp = [];
      for (let i=0;i<destinations.length;i++){
        if (result[0].to !== destinations[i].address){
          temp.push(destinations[i]);
        }else{
          finalRoute.push(destinations[i]);
          finalRoute[finalRoute.length-1]['from'] = result[0].from;
          finalRoute[finalRoute.length-1]['to'] = result[0].to;
          finalRoute[finalRoute.length-1]['text'] = result[0].text;
          finalRoute[finalRoute.length-1]['value'] = result[0].value;
          if (finalRoute.length === length){
            return fncallback(finalRoute);
          }
        }
      }
      destinations = temp;
      if(destinations.length > 0){
        suggestionRoute1(finalRoute[finalRoute.length-1].to,destinations,length,finalRoute,fncallback);
      }else{
        return fncallback(finalRoute);
      }
    }else{
      return fncallback(finalRoute);
    }
  });
}

function findNearestPlace(origins,destinations,fncallback){

  let fieldsAddress = [];

  for (let i=0;i<destinations.length;i++){
    fieldsAddress.push(destinations[i].address);
  }

  googleMapsClient.distanceMatrix({
      origins: origins,
      destinations: fieldsAddress
    })
    .asPromise()
    .then(function(response) {
      if (response.status === 200){
        console.log('co vao day ko 1');
        console.log(response);
        let min = -1;
        let index = 0, text = '';
        
        if (response.json.rows[0].elements[0].status === 'OK'){
          min = response.json.rows[0].elements[0].distance.value;
          text = response.json.rows[0].elements[0].distance.text;
        }

        for (let i=1;i<response.json.rows[0].elements.length;i++){
          if (response.json.rows[0].elements[i].status === 'OK'){
            if (response.json.rows[0].elements[i].distance.value < min){
              min = response.json.rows[0].elements[i].distance.value;
              text = response.json.rows[0].elements[i].distance.text;
              index = i;
            }
          }
        }
        return fncallback([{
          from:response.json.origin_addresses[0],
          to: fieldsAddress[index],
          text: text,
          value: min
        }]);
      }else{
        console.log('loi tai sao loi');
        return fncallback([]);
      }
    })
    .catch((err) => {
      console.log('loi ah');
      console.log(err);
      return fncallback([]);
    });
}

function suggestionRoute(arrAddress,fncallback){

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
        return fncallback(temp,totalkm);
      }else{
        return fncallback(arrAddress);
      }
    })
    .catch((err) => {
      console.log(err);
      return fncallback(arrAddress);
    });

}

module.exports.suggestionRoute1 = suggestionRoute1;
module.exports.suggestionRoute = suggestionRoute;
