import React from "react";

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Container from '@mui/material/Container';

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Alert from '@mui/material/Alert';
import Drawer from '@mui/material/Drawer';

import API from "../API.js";
import Pages from "./Pages.js";
import Dialog from "./LayoutDialog.js";

import "../css/Layout.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core'
import { faBars} from '@fortawesome/free-solid-svg-icons'

library.add(faBars);


var inst;

class Layout extends React.Component {

  constructor(props) {
    super(props);
    inst = this;

    this.globalDialog = React.createRef();
    this.showDialog = this.showDialog.bind(this);
    this.toggleDrawer = this.toggleDrawer.bind(this);

    this.state = {
      openDrawer : false,
      messageType : "success",
      messages: []
    }
  }

  handleListItemClick(e,name) {
    location.href="/" + name;
  }

  getLocation() {
    var url = location.href;
    if ( url.indexOf("/setting") !== -1 ) {
      return "setting";
    } else if ( url.indexOf("/project") !== -1 ) {
      return "project";
    }
    return "index";
  }

  showDialog(title,msg,type,func) {
    this.globalDialog.current.show(title,msg,type,func);
  }

  clearMessage() {
  }

  setMessages(typ ,msgs) {
    if ( msgs === undefined || msgs === null ) {
      return;
    }

    this.setState({
      messageType : typ,
      messages : msgs
    });
  }

  errorMessage(err) {
  }

  toggleDrawer() {
    this.setState({
      openDrawer : !this.state.openDrawer
    })
  }

  render() {

    var selected = this.getLocation();
    var t = this.state.messageType;
    var msgs = this.state.messages;

    var msgFlag = ( msgs !== undefined && msgs !== null && msgs.length > 0 );

    const menu = <>
    <List component="nav">

      <ListItemButton selected={selected === "project"}
                      key="project"
                      onClick={(event) => this.handleListItemClick(event, "project")}>
        <ListItemIcon>
        </ListItemIcon>
          <ListItemText primary="Project" />
        </ListItemButton>

      <ListItemButton selected={selected === "setting"}
                      key="setting"
                      onClick={(event) => this.handleListItemClick(event, "setting")}>
        <ListItemIcon>
        </ListItemIcon>
        <ListItemText primary="Setting" />
      </ListItemButton>

    </List> 
    </>

    return (
      <>
      <Dialog ref={this.globalDialog} />

{msgFlag &&
      <Alert severity={t}>
        <ul>
          {msgs.map((msg,idx) => {
            return (<li key={idx}>{msg}</li>);
          })}
        </ul>
      </Alert>
}

      <AppBar position="static" className="menuMar">
        <Toolbar>
          <a href="#">
            <FontAwesomeIcon icon="bars" size="2x" onClick={this.toggleDrawer}/>
          </a>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }} style={{marginLeft:"10px"}}>
            <a href="/project" className="rootMenu">Brender</a>
          </Typography>

        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={this.state.openDrawer} onClose={this.toggleDrawer}>
        {menu}
      </Drawer>

      <Container style={{marginTop:"10px"}}>
        <Pages />
      </Container>

    </>);
  }
}

export function Information(title,msg,func) {
  inst.showDialog(title,msg,"alert",func);
}

export function Confirm(title,msg,func) {
  inst.showDialog(title,msg,"confirm",func);
}

export function callPostAPI(url,args) {
  return callAPI(API.post,url,args);
}
export function callPatchAPI(url,args) {
  return callAPI(API.patch,url,args);
}
export function callPutAPI(url,args) {
  return callAPI(API.put,url,args);
}

function callAPI(func,url,args) {

  inst.clearMessage();
  let rtn = new Promise( (resolv,reject) => {

    var result = {};
    result.ok = false;
    result.data = null;
    result.messages = [];

    func(url,args).then( (res) => {

      result.ok = true;
      let data = res.data;
      if ( data === undefined ) {
        return;
      }

      //メッセージがある場合は表示する
      var msgs = data.messages;
      if ( msgs !== null ) {
        result.messages = msgs;
      }

      if ( data.success ) {
        result.data = data.result;
        resolv(result);
      } else {
        console.log(data);
        reject(result);
      }
    }).catch( (err) => {

      console.log(err)
      inst.errorMessage(err);
      result.ok = false;

      reject(result);
    }); 

  });

  return rtn;
}

export function SetError(msg) {
  inst.setMessages("error",msg);
}

export function SetWarning(msg) {
  inst.setMessages("warning",msg);
}

export function SetInfo(msg) {
  inst.setMessages("info",msg);
}

export function SetSuccess(msg) {
  inst.setMessages("success",msg);
}

export default Layout;

