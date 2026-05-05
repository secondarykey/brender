import React, { createRef } from "react"

import Paging from "../Paging.js";

import {
  Collapse,Button, Container, FormControl,FormGroup,TextField, Grid

} from '@mui/material';

import { Confirm, callPostAPI,callPatchAPI } from "../Layout.js";
import { withParams } from "../Pages.js";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core'
import { faArrowUp,faFolderOpen,faEdit,faSave,faBlender,faFilm } from "@fortawesome/free-solid-svg-icons";
import Thumbnail from "../Thumbnail";
import ResultDialog from "./ResultDialog.js";
import FlexTable from "../../components/FlexTable.js";
import Util from "../../Util.js";
library.add(faEdit,faSave,faBlender,faFilm,faFolderOpen,faArrowUp);

class WorkspaceView extends React.Component {

  constructor(props) {
    super(props);

    var w = {};
    w.name = "";
    w.frame = "";
    w.scene = "";
    w.start = "";
    w.end = "";

    this.columns = [
      { id: 'complated', label: 'Complated', minWidth: 80,
        format: (value) => this.formatComplated(value) },
      { id: 'success', label: 'Success', minWidth: 80,
        format: (value) => this.formatSuccess(value) },
      { id: 'updated_at', label: 'Updated At', minWidth: 80,
        format: (value) => Util.formatDate(value) },
      { id: 'created_at', label: 'Created At', minWidth: 80,
        format: (value) => Util.formatDate(value) },
    ];

    this.table = React.createRef();

    this.state = {
      dbName : "",
      editable:false,
      workspace:w,
      paging:Paging.create()
    }
    this.dialog = React.createRef();

    this.handleTextChange = this.handleTextChange.bind(this);
    this.handleEditable = this.handleEditable.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
    this.handleRender = this.handleRender.bind(this);
    this.handleResult = this.handleResult.bind(this);

  }

  formatComplated(v) {
    return String(v);
  }

  formatSuccess(v) {
    return String(v);
  }

  componentDidMount() {
    this.view(this.state.paging);
  }

  /**
   * 一覧の更新
   * @param {*} paging 
   */
  view(paging) {

    var args = {
      projectId: this.props.params.id,
      workspaceId: Number(this.props.params.wId),
      paging: paging
    }

    callPostAPI("/api/v1/workspace/view", args).then((res) => {
      var result = res.data;

      this.table.current.set(result.jobs,result.paging);

      this.setState({
        dbName : result.workspace.name,
        workspace:result.workspace,
        paging:result.paging
      });
    }).catch((err) => {
      console.log(err)
    });
  }

  handleTextChange(val,name) {
    var w = this.state.workspace;
    w[name] = val.value;
    this.setState( {workspace:w} );
  }

  handleEditable() {
    this.setState({
      editable : !this.state.editable
    })
  }

  handleEdit() {

    var w = this.state.workspace;

    var args = {
      projectId: this.props.params.id,
      workspaceId: Number(this.props.params.wId),
      name: w.name,
      scene: w.scene,
      frame: Number(w.frame),
      start: Number(w.start),
      end: Number(w.end),
    }

    Confirm("Edit?","Edit workspace?",() => {
      callPatchAPI("/api/v1/workspace/edit", args).then((res) => {
        var result = res.data;
        //TODO 開始しましたのメッセージ
      }).catch((err) => {
        console.log(err)
      });
    });
  }


  handleRender() {

    //更新してない時
    var args = {
      projectId: this.props.params.id,
      workspaceId: Number(this.props.params.wId)
    }

    Confirm("Render?","Render this workspace?",() => {
      callPatchAPI("/api/v1/workspace/render", args).then((res) => {
        var result = res.data;
        //TODO 開始しましたのメッセージ
      }).catch((err) => {
        console.log(err)
      });
    });
  }

  handleResult() {
    var args = {
      projectId: this.props.params.id,
      workspaceId: Number(this.props.params.wId)
    }
    callPostAPI("/api/v1/workspace/result", args).then((res) => {
      this.dialog.current.show(res.data);
    }).catch((err) => {
      console.log(err)
    });
  }

  render() {

    var baseURL = "/thumb/" + 
            this.props.params.id + "/" + 
            this.props.params.wId;

    return (<>

<Grid container>

  {/** ワークスペース */}
  <Grid item xs={8}>

    {/** プロジェクトに戻る */}
    <a href="#" className='fa-layers fa-fw' onClick={() => global.history.back() } style={{marginRight:"10px"}}>
      <FontAwesomeIcon icon='folder-open' />
      <FontAwesomeIcon icon='arrow-up' transform="shrink-2 left-14" />
    </a>

    <span style={{marginRight:"10px"}}>{this.state.dbName}</span>

    {/** 表示等のコントローラー */}
    <Button onClick={this.handleEditable}  style={{marginRight:"10px"}}>
      <FontAwesomeIcon icon="edit" size="lg"/>
    </Button>

    {/** レンダリング */}
    <Button variant="contained" color="primary" onClick={this.handleRender}>
      <FontAwesomeIcon icon="blender" size="lg"/>
    </Button>

    {/** 編集用の表示部分 */}
    <Collapse in={this.state.editable} collapsedSize={0}>
      <FormGroup>

        <FormControl>
          <TextField label="Name" value={ this.state.workspace.name }
                     onChange={(e) => this.handleTextChange(e.target,"name")}/>
        </FormControl>

        <FormControl>
          <TextField label="Scene" value={ this.state.workspace.scene }
                     onChange={(e) => this.handleTextChange(e.target,"scene")}/>
        </FormControl>

        <FormControl>
          <TextField label="Thumbnail Frame" value={ this.state.workspace.frame }
                     onChange={(e) => this.handleTextChange(e.target,"frame")}/>
        </FormControl>

        <FormControl>
          <TextField label="Start Frame" value={ this.state.workspace.start }
                     onChange={(e) => this.handleTextChange(e.target,"start")}/>
        </FormControl>

        <FormControl>
          <TextField label="End Frame" value={ this.state.workspace.end }
                     onChange={(e) => this.handleTextChange(e.target,"end")}/>
        </FormControl>

        <FormControl>
          <Button variant="contained" onClick={this.handleEdit}>
            <FontAwesomeIcon icon="save" size="lg"/>
          </Button>
        </FormControl>

      </FormGroup>
    </Collapse>
  </Grid>

  {/** サムネイル表示 */}
  <Grid item xs={4}>
    <Thumbnail project={this.props.params.id} workspace={this.props.params.wId}/>
    <Container style={{marginTop:"10px"}}>
      {/** 結果表示用 */}
      <Button variant="contained" color="secondary" onClick={this.handleResult}>
        <FontAwesomeIcon icon="film" size="lg"/>
      </Button>
    </Container>
  </Grid>

</Grid>

<ResultDialog base={baseURL} ref={this.dialog} 
              project={this.props.params.id} workspace={this.props.params.wId}/>

    {/** ジョブ一覧 */}
    <FlexTable className="blenderColor" columns={this.columns} paging={this.state.paging} ref={this.table}/>
    </>);
  }

}

export default withParams(WorkspaceView);
