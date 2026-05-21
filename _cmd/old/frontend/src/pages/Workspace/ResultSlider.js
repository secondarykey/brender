import React from "react";

import { Card, CardActionArea, CardMedia, Slider } from "@mui/material";
import API from "../../API";

class ResultSlider extends React.Component {

  constructor(props){
    super(props);
    this.state = {
      url : "",
      value : -1,
      auto : -1
    },

    this.step = 1;
    this.min = 0;
    this.max = 1;

    this.createURL = this.createURL.bind(this)
    this.parseNumber = this.parseNumber.bind(this)
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleDownload = this.handleDownload.bind(this)
  }

  parseNumber(fn) {
    return Number(fn.substring(0,fn.indexOf(".")));
  }

  handleUpdate(newValue) {
    var val = newValue;
    var rtn = true;
    if ( val > this.max ) {
      val = this.max;
      rtn = false;
    } else if ( val < this.min ) {
      val = this.min;
      rtn = false;
    }

    this.setState({
      url : this.createURL(val) ,
      value : val
    })
    return rtn;
  }

  handleDownload(e) {
    API.download(e.target.currentSrc);
  }

  createURL(val) {
    return this.props.base + "/" +( '00000000' + val ).slice(-8) + ".png"
  }

  play() {
    var self = this;
    var val = setInterval(function() {
      if ( !self.next() )  {
        self.setState({
          value : self.min
        });
      }
    },800);

    this.setState({
      auto : val
    });
  }

  stop() {

    var intId = this.state.auto;
    if ( intId !== -1 ) {
      clearInterval(intId);
    }

    this.setState({
      auto : -1
    });
  }

  next() {
    var val = this.state.value;
    if ( val === -1 ) {
      val = this.min;
    }
    return this.handleUpdate(val + this.step);
  }

  prev() {
    var val = this.state.value;
    if ( val === -1 ) {
      val = this.min;
    }
    return this.handleUpdate(val - this.step);
  }

  render() {

    var data = this.props.data;
    var value = this.state.value;

    var url = this.state.url;
    var prefix = "";

    if ( data === undefined || data === null )  {
      data = [];
    } else if ( data.length > 0 ) {
      this.min = this.parseNumber(data[0]);
      this.max = this.parseNumber(data[data.length - 1]);
      this.step = Math.ceil((this.max - this.min) / 10);
      if ( url === "" ) {
        url = this.createURL(this.min);
      }
    }

    var idx = 0;
    var marks = [];
    while ( true ) {
      var val = this.min + (this.step * idx);
      if ( val >= this.max ) {
        val = this.max;
      }

      marks.push({
        value : val, label : val + ""
      });

      if ( val === this.max ) {
        break;
      }
      idx++;
    }

    var disable = this.state.auto !== -1;

    return (<>

    <Card sx={{ minWidth : 180,maxWidth: 1280 , minHeight: 120,maxHeight: 720}}>
      <CardActionArea>
        <CardMedia component="img" image={url} alt={prefix} onClick={this.handleDownload}/>
      </CardActionArea>
    </Card>

    <Slider 
      disabled={disable}
      value={value}
      step={this.step}
      marks={marks}
      min={this.min}
      max={this.max}
      onChangeCommitted={(_,n) => this.handleUpdate(n)}
      aria-label="Default" valueLabelDisplay="auto" 
    />
    </>);
  }
}
export default ResultSlider;