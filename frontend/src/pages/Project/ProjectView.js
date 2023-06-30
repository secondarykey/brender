import React from "react"
import Paging from "../Paging";
import Util from "../../Util";

import TextField from '@mui/material/TextField';
import Collapse from "@mui/material/Collapse";

import {
  Button, Card, CardActionArea, CardContent, CardMedia, Container, FormControl, FormGroup, Grid, Tab, Tabs
} from '@mui/material';

import FlexTable from "../../components/FlexTable";
import InputDialog from "../../components/InputDialog";
import { callPostAPI,callPatchAPI, Confirm ,SetWarning} from "../Layout";
import { withParams } from "../Pages";
import ProjectTree from "./ProjectTree";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core'
import { faEdit,faSave,faPlus } from "@fortawesome/free-solid-svg-icons";
library.add(faEdit,faSave,faPlus);

import Thumbnail from "../Thumbnail";
import { Navigate } from "react-router-dom";

class ProjectView extends React.Component {
  
  constructor(props) {
    super(props);

    var p = {}
    p.name = "";
    p.blender_file = "";
    p.scene = "";
    p.frame = "";

    this.state = {
      project : p,
      tree : null,
      navigate : "",
      editable : false,
      workspaces:[],
      tab:"workspace",
      paging : Paging.create()
    }

    this.columns = [
      { id: 'name', label: 'Name', minWidth: 100,
        format: (val, row) => this.workspaceLink(val, row) },
      { id: 'created_at', label: 'Created At', minWidth: 80,
        format: (value) => Util.formatDate(value) },
      { id: 'updated_at', label: 'Updated At', minWidth: 80,
        format: (value) => Util.formatDate(value) },
    ];

    this.table = React.createRef();
    this.registerDialog = React.createRef();

    this.workspaceNameTxt = React.createRef();

    this.view = this.view.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleOpenRegister = this.handleOpenRegister.bind(this);
    this.handleRegister = this.handleRegister.bind(this);
    this.handleEditable = this.handleEditable.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
    this.handleArchive = this.handleArchive.bind(this);
    this.handleChangeTab = this.handleChangeTab.bind(this);
    this.onChangeTree = this.onChangeTree.bind(this);
  }

  componentDidMount() {
    //プロジェクトの一覧を取得
    var paging = this.state.paging;
    this.view(paging);
  }

  view(paging) {

    var args = {
      projectId : this.props.params.id,
      paging : paging
    }

    callPostAPI("/api/v1/project/view", args).then((res) => {

      var result = res.data;
      //this.table.current.set(result.projects,result.paging);
      SetWarning(res.messages);

      let pro = result.project;
      let wk = result.workspaces;
      let paging = result.paging;

      //this.table.current.set(wk,paging);
      this.setState({
        dbName : pro.name,
        workspaces:wk,
        project : pro
      });
    }).catch((err) => {
      console.log(err)
    });
  }

  workspaceLink(val, row) {
    return <a href={"/project/" + row["project_id"] + "/workspace/" + row["id"]} >{row["name"]}</a>;
  }

  handleOpenRegister() {
    this.registerDialog.current.open();
  }

  handleRegister() {

    let args = {
      name : this.workspaceNameTxt.current.value,
      projectId : this.props.params.id
    }

    callPatchAPI("/api/v1/workspace/register",args).then( (res) => {
      this.registerDialog.current.close();
    }).catch( (err) => {
      console.log(err);
    });
  }

  handleEditable() {
    this.setState({
      editable:!this.state.editable
    });
  }

  handleEdit() {

    var p = this.state.project;
    var args = {
      projectId : p.id,
      name : p.name,
      blenderFile : p.blender_file,
      scene : p.scene,
      frame : Number(p.frame)
    }

    Confirm("Edit Project","Update?", () => {
      callPatchAPI("/api/v1/project/edit",args).then( (res) => {
      }).catch( (err) => {
        console.log(err);
      });
    });
  }

  handleArchive() {

    var p = this.state.project;
    var args = {
      projectId : p.id,
    }

    Confirm("Archive Project","After archiving, it can be sent to the server, but it cannot be edited directly.Also, since the file path does not exist after archiving, rendering may not work as expected. Check your Blender file configuration for errors.", () => {
      callPatchAPI("/api/v1/project/archive",args).then( (res) => {
      }).catch( (err) => {
        console.log(err);
      });
    }) 
  }

  handleClick(w) {
    this.setState({
      navigate : "/project/" + this.props.params.id + "/workspace/" + w.id
    })
  }

  handleTextChange(e,name) {
    var p = this.state.project;
    p[name] = e.value;
    this.setState({project:p});
  }

  handleChangeTab(e,tab) {
    this.setState({
      tab:tab
    })
  }

  onChangeTree(tree) {
    this.setState({
      tree:tree
    })
  }

  render() {

    if ( this.state.navigate !== "" ) {
       return <Navigate to={this.state.navigate} />;
    }

    var base = "/thumb/";
    var size = 0;
    var tree = this.state.tree;
    if ( tree !== null ) {
      size = tree.size;
    }

    var disable = false;
    if (this.state.project.archive) {
      disable = true;
    }

    return (<>
    <Grid container>
      <Grid item xs={8}>

        <span>{this.state.dbName}</span>

        <Button onClick={this.handleEditable}>
          <FontAwesomeIcon icon="edit" size="lg"/>
        </Button>

        <Collapse in={this.state.editable} collapsedSize={0}>

          <FormGroup>

            <FormControl>
              <TextField label="Name" 
                         value={ this.state.project.name } 
                         onChange={(e) => this.handleTextChange(e.target,"name")}/>
            </FormControl>
    
            <FormControl>
              <TextField label="Blender file"
                         value={this.state.project.blender_file} 
                         inputProps={{readOnly:disable}}
                         onChange={(e) => this.handleTextChange(e.target,"blender_file")}/>
            </FormControl>

            <FormControl>
              <TextField label="Thumbnail Scene" value={this.state.project.scene} 
                         onChange={(e) => this.handleTextChange(e.target,"scene")}/>
            </FormControl>

            <FormControl>
              <TextField label="Thumbnail Frame" value={this.state.project.frame}  
                         onChange={(e) => this.handleTextChange(e.target,"frame")}/>
            </FormControl>

            <FormControl>
              <Button variant="contained" onClick={this.handleEdit}>
                <FontAwesomeIcon icon="save" />
              </Button>
            </FormControl>
  
          </FormGroup>
        </Collapse>
      </Grid>
      <Grid item xs={4}>
        <Thumbnail project={this.props.params.id} />
      </Grid>
    </Grid>

    {/** Workspace register dialog */}
    <InputDialog ref={this.registerDialog} title="Workspace Register" calcel="Cancel" commit="Register" onCommit={this.handleRegister}>
      <FormGroup>
        <FormControl>
          <TextField autoFocus label="Name" variant="standard"
                     inputRef={this.workspaceNameTxt} fullWidth />
        </FormControl>
      </FormGroup>
    </InputDialog>

    {/** workspace table */}
    <Container style={{marginTop:"10px"}}>

      <Tabs value={this.state.tab} onChange={this.handleChangeTab} aria-label="Project Works">
        <Tab label="Workspace" value="workspace"/>
        <Tab label="Archive" value="archive"/>
      </Tabs>


{this.state.tab === "workspace" &&
<>
      <Button className="float-button" variant="contained" onClick={this.handleOpenRegister}>
        <FontAwesomeIcon icon="plus" size="lg"/>
      </Button>

      <Grid container spacing={2} className="fadeIn">
{this.state.workspaces.map((w,idx) => {
      var imageUrl = base +  this.props.params.id + "/" + w.id;
      return (<>
      <Grid item xs={4} key={idx}>
        <Card sx={{ minWidth : 180,maxWidth: 360 , minHeight: 120,maxHeight: 240}} onClick={() => this.handleClick(w)} key={w.id}>
            <CardActionArea>
              <CardMedia component="img" image={imageUrl}/>
              <CardContent className="cardText">
                {w.name}
              </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
      </>);
})}
      </Grid>
</>
}

{this.state.tab === "archive" &&
<>
<Grid container className="fadeIn">

  <Grid item xs={4}>
    <Button variant="contained" onClick={this.handleArchive}>Archive</Button>
    Size : {Util.kibi(size,2)}B
  </Grid>

  <Grid item xs={8}>
    <ProjectTree id={this.props.params.id} onChange={this.onChangeTree}/>
  </Grid>

</Grid>
</>
}

{/**
      <FlexTable className="blenderColor" columns={this.columns} paging={this.state.paging} ref={this.table}/>
 */}

    </Container>
    </>);
  }
}

export default withParams(ProjectView);
