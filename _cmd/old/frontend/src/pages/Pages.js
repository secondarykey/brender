import React from "react";

import { useParams,Routes,Route } from "react-router-dom";
import Index from "./Index.js"
import Setting from "./Setting.js"
import ProjectList from "./Project/ProjectList.js"
import ProjectView from "./Project/ProjectView.js"
import WorkspaceView from "./Workspace/WorkspaceView.js"

class Pages extends React.Component {
  render() {
    return (
      <Routes>
        <Route path="/" element={<Index key="index"/>} />
        <Route path="/setting" element={<Setting key="setting"/>}/>
        <Route path="/project" element={<ProjectList key="projectList"/>}/>
        <Route path="/project/view/:id" element={<ProjectView key="projectView"/>}/>
        <Route path="/project/:id/workspace/:wId" element={<WorkspaceView key="workspaceView"/>}/>
      </Routes>
    )
  }
}

export function withParams(Component) {
  return props => <Component {...props} params={useParams()} />;
}

export default Pages;
