import React from "react"

import API from "../../API.js"
import Paging from "../Paging.js";

import {withParams} from "../Pages.js"
import {Paper,TableContainer,Table,TableHead,TableRow,TableCell,TableBody,TablePagination} from '@mui/material';

class JobList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      data : [],
      paging : Paging.create()
    }
  }

  componentDidMount() {
    var paging = this.state.paging;
    this.view(paging);
  }

  /**
   * 一覧の更新
   * @param {*} paging 
   */
  view(paging) {

    /*
    var args = {
      paging : paging
    }

    API.post("/api/v1/groups/contents",args).then( (res) => {
      var result = res.data;
      this.setState({
        data:result.groups,
        paging:result.paging
      });
    }).catch( (err) => {
      console.log(err)
    });
    */
  }

  render() {

    var data = this.state.data;
    var paging = this.state.paging;

    return (<>
    </>);
  }

}

export default JobList;
