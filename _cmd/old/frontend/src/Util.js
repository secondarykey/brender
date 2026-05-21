import React from "react";

class Util {

  static convertDate(date, format) {
    format = format.replace(/yyyy/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
    return format;
  };

  static formatDate(val) {
    var date = new Date(val);
    return Util.convertDate(date, "yyyy/MM/dd HH:mm:ss");
  }

  static kibiUnit = ["K","M","G","T"];
  static kibiByte = 1024;
  static kibi(val,digit) {
    var rtn = val;
    var unit = "";
    for ( let idx = 0; idx < this.kibiUnit.length; ++idx ) {
      if ( rtn < this.kibiByte  ) {
        break;
      }
      rtn = rtn / this.kibiByte;
      unit = this.kibiUnit[idx];
    }

    if ( unit !== "" && digit !== undefined ) {
      rtn = rtn.toFixed(digit);
    }
    return rtn + unit;
  }
}

export default Util;