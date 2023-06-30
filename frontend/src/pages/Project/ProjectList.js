import React from "react";
import { Navigate } from "react-router-dom";

import Paging from "../Paging";
import TextField from '@mui/material/TextField';
import Util from "../../Util";

import {
  Grid,Button, Card, CardMedia, CardActionArea, CardActions, CardContent
} from '@mui/material';

import FlexTable from "../../components/FlexTable";
import InputDialog from "../../components/InputDialog";
import { callPatchAPI, callPostAPI } from "../Layout";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

library.add(faPlus);

class ProjectList extends React.Component {
  
  constructor(props) {
    super(props);

    this.state = {
      data : [],
      showProjectThumb : [],
      navigate:"",
      paging : Paging.create()
    }

    this.columns = [
      { id: 'name', label: 'Name', minWidth: 100,
        format: (val, row) => this.projectLink(val, row) },
      { id: 'created_at', label: 'Created At', minWidth: 80,
        format: (value) => Util.formatDate(value) },
      { id: 'updated_at', label: 'Updated At', minWidth: 80,
        format: (value) => Util.formatDate(value) },
    ];

    this.table = React.createRef();
    this.registerDialog = React.createRef();
    this.nameTxt = React.createRef();
    this.fileTxt = React.createRef();

    this.handleOpenRegister = this.handleOpenRegister.bind(this);
    this.handleRegister = this.handleRegister.bind(this);
  }

  componentDidMount() {
    //プロジェクトの一覧を取得
    var paging = this.state.paging;
    this.view(paging);
  }

  view(paging) {
    var args = {
      paging : paging
    }

    callPostAPI("/api/v1/project/list", args).then( (res) => {

      var data = res.data
      var thumbs = [];

      data.projects.map((v,idx) => {
        thumbs[idx] = false;
        const img = new Image();
        img.src = "/thumb/" + v.id;
        img.onload = () => {
          thumbs[idx] = true
          this.setState({
            showProjectThumbs : thumbs
          })
        }
        img.onerror = (e) => {
        }
      });

      //this.table.current.set(data.projects,data.paging);
      this.setState({
        data:data.projects,
        showProjectThumb:thumbs,
        paging: data.paging
      });
    }).catch((err) => {
      console.log(err)
    });
  }

  projectLink(val, row) {
    return <a href={"/project/view/" + row["id"]}>{val}</a>;
  }

  handleOpenRegister() {
    this.registerDialog.current.open();
  }

  handleRegister() {
    let args = {
      name : this.nameTxt.current.value,
      file : this.fileTxt.current.value
    }
    callPatchAPI("/api/v1/project/register",args).then( (res) => {
      this.view(this.state.paging);
      this.registerDialog.current.close();
    }).catch( (err) => {
      console.log(err);
    });
  }

  handleClick(project) {
    this.setState({
      navigate : "/project/view/" + project.id
    })
  }

  render() {

     if ( this.state.navigate !== "" ) {
       return <Navigate to={this.state.navigate} />;
     }

    var paging = this.state.paging;
    var base = "/thumb/";
    return (<>

      <InputDialog ref={this.registerDialog} title="Project Register" calcel="Cancel" commit="Register" onCommit={this.handleRegister}>
        <TextField autoFocus margin="dense" id="name" type="text" label="Name" variant="standard"
                   inputRef={this.nameTxt} fullWidth />
        <TextField margin="dense" id="name" type="text" label="Blender File" variant="standard"
                   inputRef={this.fileTxt} fullWidth />
      </InputDialog>

{/** 一覧表示 */}
<Grid container spacing={2}>
{this.state.data.map((v,idx) => {
  var show = this.state.showProjectThumb[idx];

  return (<>
  <Grid item xs={3} key={idx}>
    <Card sx={{ minWidth : 180,maxWidth: 360 , minHeight: 120,maxHeight: 240}} onClick={() => this.handleClick(v)} key={v.id}>
      <CardActionArea>
{show &&
        <CardMedia component="img" image={base + v.id}/>
} 
{!show &&
        <CardMedia style={{display:"flex",justifyContent:"center"}}>
          <FontAwesomeIcon style={{minWidth:180,minHeight:100,maxWidth:320,maxHeight:200}} icon="video-slash" size="4x"/>
        </CardMedia>
}
      <CardContent className="cardText">
        {v.name}
      </CardContent>
      </CardActionArea>
    </Card>
  </Grid>
  </>);
})}

</Grid>

{/** 新規追加ボタン */}
<Button variant="contained" className="float-button" onClick={this.handleOpenRegister}>
  <FontAwesomeIcon icon="plus" size="2x"/>
</Button>

        {/**
      <Container className="rel">
        <FlexTable className="blenderColor" columns={this.columns} paging={paging} ref={this.table}/>
      </Container>
         */}

    </>);
  }
}

export default ProjectList;
