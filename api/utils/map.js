var googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_KEY,
  Promise: Promise
});

function suggestionRoute(arrAddress,fnccallback){

  googleMapsClient.distanceMatrix({
      origins: arrAddress,
      destinations: arrAddress
    })
    .asPromise()
    .then(function(response) {
      if (response.status === 200){
        let arrayIndex = [];
        let existsRoute = [];
        existsRoute.push(0);
        while(existsRoute.length <= arrAddress.length-1){
          let min = 999999999;
          let index = arrayIndex.length === 0 ? 0 : arrayIndex[arrayIndex.length-1].route;
          let route = 0, text = '';
          for (let j=0;j<response.json.rows[index].elements.length;j++){
            if (response.json.rows[index].elements[j].status === 'OK' && response.json.rows[index].elements[j].distance.value >0 && !existsRoute.includes(j)){
              if (min > response.json.rows[index].elements[j].distance.value){
                min = response.json.rows[index].elements[j].distance.value;
                text = response.json.rows[index].elements[j].distance.text;
                route = j;
              }
            }
          }
          arrayIndex.push({
            address: arrAddress[route],
            text: text,
            value: min,
            route: route
          });
          existsRoute.push(route);
        }
        return fnccallback(arrayIndex);
      }else{
        return fnccallback([]);
      }
    })
    .catch((err) => {
      console.log(err);
      return fnccallback([]);
    });
}

module.exports.suggestionRoute = suggestionRoute;
