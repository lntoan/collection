const moment = require('moment');
const _ = require('lodash');

function getContractById (objCus,isPlus){
  try {
    //DateFrom,To is moment
    let total = 0, delayperiod = '';
    delayperiod = objCus.PaymentPeriodCount;
    // total = objCus.PeriodAmount; //+ (objCus.DifferenceAmount * -1);

    if (objCus.PaymentPeriodCount < objCus.CurrentPeriodCount){ // tinh tien tre cua cac ky truoc cho den ky hien tai
      for (let i = objCus.PaymentPeriodCount+1;i<=objCus.CurrentPeriodCount;i++){
        let key = 'Period_' + _.padStart(i,2,'0');
        // console.log(key);
        total += (objCus.SeriesPeriod[key].Amount - objCus.SeriesPeriod[key].RealPaymentAmount);
      }
    }else{
      // khach hang dung han thi phai +- so tien thua thieu
      if (delayperiod + 1 <= objCus.Period){
        let Period = 'Period_' + _.padStart(delayperiod + 1,2,'0');
        objCus.NextPaymentDate = objCus.SeriesPeriod[Period].PaymentDate;
        total = objCus.SeriesPeriod[Period].Amount;
      }
    }

    // total += (objCus.DifferenceAmount * -1);

    if (isPlus === true){
      total += ((objCus.isChangeDueDate === 1 && objCus.isChangeDueDatePaid === 0) ? objCus.ChangeDueDateAmount : 0);
    }

    if ((delayperiod + 1) === objCus.Period){
      // ky cuoi nen so tien thanh toan ky tiep theo phai cong luon PenaltyAmount
      total += objCus.PenaltyAmount;
    }
    objCus.NextPayment = total;
    return objCus;
  }
  catch(err) {
    console.log(err);
    return null;
  }
}
function getFinishContract(objCus){

  try {

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
    total = total.toFixed(0);
    return total;

  } catch (e) {
    return 0;
  }
}

module.exports.getContractById = getContractById;
module.exports.getFinishContract = getFinishContract;
