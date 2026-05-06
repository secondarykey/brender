import React from "react";

class Paging {
  static create() {
    return {
      current:1,
      count:0,
      limit:10
    }
  }
}

export default Paging;