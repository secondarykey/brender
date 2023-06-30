import React from "react";

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

class LayoutDialog extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      view:false,
      type:"alert",
      title:"",
      message:""
    }

    this.handleYes = this.handleYes.bind(this);
    this.handleNo = this.handleNo.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.close = this.close.bind(this);
  }

  handleClose() {
    this.close();
    if ( this.onCommit ) {
      this.onCommit();
    }
  }

  handleYes() {
    this.close();
    if ( this.onCommit ) {
      this.onCommit();
    }
  }

  handleNo() {
    this.close();
  }

  close() {
    this.setState({
      view:false
    });
  }

  show(title,msg,type,func) {

    this.setState({
      view:true,
      title:title,
      message:msg,
      type : type
    });

    this.onCommit = func;
    return;
  }

  render() {
    return (<>
      <Dialog open={this.state.view}>
        <DialogTitle>{this.state.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{this.state.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
{this.state.type === "alert" &&
<>
          <Button onClick={this.handleClose}>Close</Button>
</>
}
{this.state.type === "confirm" &&
<>
          <Button onClick={this.handleNo}>No</Button>
          <Button color="success" variant="contained" onClick={this.handleYes}>Yes</Button>
</>
}
        </DialogActions>
      </Dialog>
    </>);
  }
}


export default LayoutDialog;