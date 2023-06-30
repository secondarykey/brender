import React from "react";

import { Card, CardActionArea, CardMedia } from "@mui/material";
import { Confirm, callPatchAPI } from "./Layout";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core'
import { faVideoSlash} from '@fortawesome/free-solid-svg-icons'

library.add(faVideoSlash);

class Thumbnail extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      show : false
    }
    this.handleClick = this.handleClick.bind(this);
    this.init = false;
  }
  
  handleClick() {
    var projectId = this.props.project;
    var workspaceId = this.props.workspace;
    var target = "project";

    var args = {
      projectId : projectId
    }

    if ( workspaceId !== undefined ) {
      target = "workspace";
      args["workspaceId"] = Number(workspaceId);
    }

    var api = "/api/v1/" + target + "/thumb/generate";

    Confirm("Thumbnail generate?","generate?",() =>{
      callPatchAPI(api,args).then( (res) => {

      }).catch( (err) => {
        console.log(err);
      })
    });
  }

  render() {

    var projectId = this.props.project;
    var workspaceId = this.props.workspace;

    var url = "/thumb/";
    if ( workspaceId === undefined ) {
      url += projectId;
    } else {
      url += (projectId + "/" + workspaceId);
    }

    if ( url !== "" && !this.init ) {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        this.setState({
          show : true
        })
      }
      img.onerror = (e) => {
      }
      this.init = true;
    }

    var show = this.state.show;
    var alt = this.props.alt;

    return (<>
    <Card sx={{ minWidth : 180,maxWidth: 360 , minHeight: 120,maxHeight: 240}}>
      <CardActionArea style={{ display:'flex',justifyContent:'center'}} onClick={this.handleClick}>
{show &&
        <CardMedia component="img" image={url} alt={alt} />
} 
{!show &&
        <CardMedia style={{display:"flex",justifyContent:"center"}}>
          <FontAwesomeIcon style={{maxWidth:320,maxHeight:240}} icon="video-slash" size="4x"/>
        </CardMedia>
}
     </CardActionArea>
    </Card>
    </>);

  }
}

export default Thumbnail;