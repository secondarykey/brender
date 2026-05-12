package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Workspace struct{}

func NewWorkspace() *Workspace {
	var w Workspace
	return &w
}

func (s *Workspace) ListByProject(projectID string) ([]*model.WorkspacesByFile, error) {
	return api.ListWorkspacesByProject(projectID)
}

func (s *Workspace) Get(projectID string, workspaceID string) (*model.WorkspaceDetail, error) {
	return api.GetWorkspace(projectID, workspaceID)
}

func (s *Workspace) Create(projectID string, projectFileID string, name string) (*model.Workspace, error) {
	return api.CreateWorkspace(projectID, projectFileID, name)
}

func (s *Workspace) Update(projectID string, workspaceID string, name string, blenderInstallID uint, scene, engine string, startFrame, endFrame, frameStep, thread, samples int) (*model.WorkspaceDetail, error) {
	return api.UpdateWorkspace(projectID, workspaceID, name, blenderInstallID, scene, engine, startFrame, endFrame, frameStep, thread, samples)
}

func (s *Workspace) Delete(projectID, workspaceID string) error {
	return api.DeleteWorkspace(projectID, workspaceID)
}

func (s *Workspace) GetThumbnail(projectID string, fileID string, workspaceID string) (string, error) {
	return api.GetWorkspaceThumbnail(projectID, fileID, workspaceID)
}
