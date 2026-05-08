package main

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type WorkspaceService struct{}

func (s *WorkspaceService) ListByProject(projectID string) ([]*model.WorkspacesByFile, error) {
	return api.ListWorkspacesByProject(projectID)
}

func (s *WorkspaceService) Get(projectID string, workspaceID string) (*model.WorkspaceDetail, error) {
	return api.GetWorkspace(projectID, workspaceID)
}

func (s *WorkspaceService) Create(projectID string, projectFileID uint, name string) (*model.Workspace, error) {
	return api.CreateWorkspace(projectID, projectFileID, name)
}

func (s *WorkspaceService) Update(projectID string, workspaceID string, name string, blenderInstallID uint, scene, engine string, startFrame, endFrame, frameStep, thread int) (*model.WorkspaceDetail, error) {
	return api.UpdateWorkspace(projectID, workspaceID, name, blenderInstallID, scene, engine, startFrame, endFrame, frameStep, thread)
}

func (s *WorkspaceService) Delete(projectID, workspaceID string) error {
	return api.DeleteWorkspace(projectID, workspaceID)
}
