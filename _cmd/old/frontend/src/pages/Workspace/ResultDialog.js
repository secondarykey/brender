import React from "react";

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress } from "@mui/material";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";

import ResultSlider from "./ResultSlider";
import API from "../../API";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core'
import { faPlay,faPause,faBackward,faForward,faDownload,faWindowClose} from '@fortawesome/free-solid-svg-icons'

library.add(faPlay,faPause,faBackward,faForward,faDownload,faWindowClose);

class ResultDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      show : false,
      play : false,
      results : [],
      width : 600,
      height : 600
    }

    this.slider = React.createRef();

    this.handleClose = this.handleClose.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleDownload = this.handleDownload.bind(this);
    this.handlePlay = this.handlePlay.bind(this);
    this.handlePause = this.handlePause.bind(this);
    this.handleForward = this.handleForward.bind(this);
    this.handleBackward = this.handleBackward.bind(this);
  }

  show(result) {

    this.setState({
      show:true,
      files : result.files,
      size : result.size,
      downloaded : 0
    });
  }

  handleClose() {
    this.setState({
      show : false
    })
  }

  handleResize(e) {
    this.setState({
      width : e.movementX + this.state.width,
      height : e.movementY + this.state.height
    });
  }

  handleDownload() {
    var url = "/download/zip/" + this.props.project + "/" + this.props.workspace;
    var size = this.state.size;
    var self = this;
    API.download(url,"result.zip",function(e) {
      if ( e.complated !== undefined ) {
        self.setState({
          downloaded:0
        });
      } else {
        self.setState({
          downloaded:e.loaded
        });
      }
    });
  }

  handlePlay() {
    this.setState({
      play : true
    })
    this.slider.current.play();
  }

  handlePause() {
    this.setState({
      play : false
    })
    this.slider.current.stop();
  }

  handleForward() {
    this.slider.current.next();
  }

  handleBackward() {
    this.slider.current.prev();
  }

  render() {

    var width = this.state.width;
    var height = this.state.height;

    var nowButton = (<>
    <Button onClick={this.handlePlay}> 
      <FontAwesomeIcon icon="play" size="2x"/>
    </Button>
    </>)
    if ( this.state.play ) {
    var nowButton = (<>
      <Button onClick={this.handlePause}> 
        <FontAwesomeIcon icon="pause" size="2x"/>
      </Button>
    </>)
    }

    return (<>
    <Dialog open={this.state.show} onClose={this.handleClose}>
      <Resizable height={height} width={width}
                 onResize={(e, data) => { this.handleResize(e); }}>
        <>
          <DialogTitle> 
            Result 
            <Button autoFocus onClick={this.handleClose} className="right"> 
              <FontAwesomeIcon icon="window-close" size="lg"/>
            </Button>
          </DialogTitle>

          <DialogContent>
            <ResultSlider height={height} width={width} base={this.props.base} data={this.state.files} ref={this.slider}/>
          </DialogContent>

          <DialogActions>
{this.state.downloaded > 0 &&
<>
  <Box sx={{ width: '100%' }}>
    <LinearProgress variant="determinate" value={this.state.downloaded/this.state.size * 100} />
  </Box>
</>
}

{this.state.downloaded <= 0 &&
<>
<div className="player">

            <Button onClick={this.handleBackward} disabled={this.state.play}> 
              <FontAwesomeIcon icon="backward" size="2x"/>
            </Button>

            { nowButton }

            <Button onClick={this.handleForward} disabled={this.state.play}> 
              <FontAwesomeIcon icon="forward" size="2x"/>
            </Button>

</div>

            <Button onClick={this.handleDownload}> 
              <FontAwesomeIcon icon="download" size="2x"/>
            </Button>
</>
}
          </DialogActions>
        </>
      </Resizable>
    </Dialog>
    </>);
  }
}
export default ResultDialog;