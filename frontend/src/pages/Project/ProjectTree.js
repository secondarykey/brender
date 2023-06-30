import React from "react";

import { withParams } from "../Pages";
import { callPostAPI } from "../Layout";

import CheckboxTree from "react-checkbox-tree";
import 'react-checkbox-tree/lib/react-checkbox-tree.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core'
import { faChevronDown ,faChevronRight, 
         faCheckSquare, faSquare,
         faFile, faFolder,faFolderOpen,
         faVideoSlash} from '@fortawesome/free-solid-svg-icons'

library.add(faCheckSquare,faSquare,faFolder,faFolderOpen,faChevronRight,faChevronDown,faFile,faVideoSlash);

class ProjectTree extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      tree : [],
      checkTree : [],
      expandTree : ["root"]
    }

    this.handleCheckTree = this.handleCheckTree.bind(this);
    this.handleExpandTree = this.handleExpandTree.bind(this);
    this.size = this.size.bind(this);
  }

  componentDidMount() {
    this.view();
  }

  size() {

    var tree = this.state.tree;
    if ( tree.length === 0 ) {
      return 0;
    }
    var s = tree[0].size;
    if ( s === undefined ) {
      return 0;
    }
    return s;
  }

  view() {

    var args = {
      projectId : this.props.params.id
    }

    callPostAPI("/api/v1/project/tree",args).then( (res) => {
      var data = [];
      data.push(res.data);
      this.setState({
        tree:data
      })

      if ( this.props.onChange !== undefined ) {
        this.props.onChange(res.data);
      }
    }).catch( (err) => {
      console.log(err);
    });
  }

  handleCheckTree(t) {
    this.setState({
      checkTree:t
    })
  }

  handleExpandTree(t) {
    this.setState({
      expandTree:t
    })
  }

  render() {
    return (<>
    <CheckboxTree nodes={this.state.tree}
      checked={this.state.checkTree}
      expanded={this.state.expandTree}
      onCheck={(checked) => this.handleCheckTree(checked)}
      onExpand={(expanded) => this.handleExpandTree(expanded)}
      icons={{
        check: <FontAwesomeIcon className="rct-icon rct-icon-check" icon="check-square" />,
        uncheck: <FontAwesomeIcon className="rct-icon rct-icon-uncheck" icon={['fas', 'square']} />,
        halfCheck: <FontAwesomeIcon className="rct-icon rct-icon-half-check" icon="check-square" />,
        expandClose: <FontAwesomeIcon className="rct-icon rct-icon-expand-close" icon="chevron-right" />,
        expandOpen: <FontAwesomeIcon className="rct-icon rct-icon-expand-open" icon="chevron-down" />,
        expandAll: <FontAwesomeIcon className="rct-icon rct-icon-expand-all" icon="plus-square" />,
        collapseAll: <FontAwesomeIcon className="rct-icon rct-icon-collapse-all" icon="minus-square" />,
        parentClose: <FontAwesomeIcon className="rct-icon rct-icon-parent-close" icon="folder" />,
        parentOpen: <FontAwesomeIcon className="rct-icon rct-icon-parent-open" icon="folder-open" />,
        leaf: <FontAwesomeIcon className="rct-icon rct-icon-leaf-close" icon="file" />
      }}
    />
    </>);
  }
}

export default withParams(ProjectTree);