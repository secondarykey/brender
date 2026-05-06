import React from "react";

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';


/**
 * ボタンを押した時にdisable
 * 
 */
class LoadingButton extends React.Component {

  constructor(props) {
    super(props);

    this.children = props.children;
    this.onClick = this.props.onClick;

    this.state = {
      loading : false
    }

    this.handleButtonClick = this.handleButtonClick.bind(this);
  }

  handleButtonClick() {

    let p = undefined;
    if ( this.onClick !== undefined ) {
      p = this.onClick();
    } else {
      console.log("Undefined LoadingButton onClick");
      return;
    }

    this.setState({
      loading:true
    });


    if ( p instanceof Promise ) {
      p.finally(() => {
        this.setState({
          loading:false
        });
      });
    } else {
      console.log("Not Promise LoadingButton onClick returns");
    }
  }

  render() {
    return (<>
      <Box sx={{ m: 1, position: 'relative' }}>
        <Button
          color="success" 
          variant="contained"
          disabled={this.state.loading}
          onClick={this.handleButtonClick}
        >
          {this.children}
        </Button>

        {this.state.loading && (
          <CircularProgress
            size={24}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px',
            }}
          />
        )}
      </Box>
    </>);
  }

}

export default LoadingButton;