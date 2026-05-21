import React from "react";

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import API from "../API";

class InputDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      view : false
    }
    this.handleClose = this.handleClose.bind(this);
  }

  open = () => {
    this.setState({
      view:true
    });
  };

  close = () => {
    this.setState({
      view:false
    });
  };

  handleClose = () => {
    this.close();
  };

  render () {

    var commit = this.props.commit;
    var cancel = this.props.cancel;
    if ( commit === undefined ) {
      commit = "Commit";
    }
    if ( cancel === undefined ) {
      cancel = "Cancel";
    }

    return (<>
      <Dialog open={this.state.view}>
        <DialogTitle>{this.props.title}</DialogTitle>
        <DialogContent>

          <DialogContentText>
          </DialogContentText>

          { this.props.children }

        </DialogContent>

        <DialogActions>
          <Button onClick={this.handleClose}>{cancel}</Button>
          <Button variant="contained" onClick={this.props.onCommit}>{commit}</Button>
        </DialogActions>
      </Dialog>
    </>);
  }
}

export default InputDialog;
