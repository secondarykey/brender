import React,{useState,useEffect} from "react"

import {
  Button, FormControl, FormGroup, TextField
} from '@mui/material';
import { Confirm, callPatchAPI, callPostAPI } from "./Layout";

class Setting extends React.Component {
  
  constructor(props) {
    super(props);

    this.state = {
      command : "",
      projectRoot : ""
    }

    this.handleClickSave = this.handleClickSave.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
  }

  componentDidMount() {
    this.view();
  }

  view() {

    var args = {
    }

    callPostAPI("/api/v1/setting",args).then( (result) => {
      var data = result.data;
      this.setState({
        command : data.command,
        projectRoot : data.root
      })
    }).catch( (err) => {
      console.log(err);
    });

  }

  handleClickSave() {

    //let cmd = this.cmd.current.value;
    //let root = this.root.current.value;
    let cmd = this.state.command;
    let root = this.state.projectRoot;

    var args = {
      cmd : cmd,
      root : root
    }
    console.log(args);

    Confirm("Confirm","Save?",() => {
      callPatchAPI("/api/v1/setting/edit", args).then( (res) => {
      }).catch((err) => {
        console.log(err)
      });
    }); 
  }

  handleEdit(elm,name) {
    var s = this.state;
    if ( name === "cmd" ) {
      s.command = elm.value;
    } else if ( name === "projectRoot" ) {
      s.projectRoot = elm.value;
    }
    this.setState(s);
  }

  render() {

    var file = this.state.command;
    var root = this.state.projectRoot;

    return (<>
    <FormGroup>

      <FormControl>
        <TextField label="Blender executable file" 
                   onChange={(e) => this.handleEdit(e.target,"cmd")}
                   value={file} />
      </FormControl>

      <FormControl>
        <TextField label="Project Root Path" 
                   onChange={(e) => this.handleEdit(e.target,"projectRoot")}
                   value={root} />
      </FormControl>

      <FormControl>
        <Button variant="contained" onClick={this.handleClickSave}>Save</Button>
      </FormControl>

    </FormGroup>
    </>);
  }
}

export default Setting;