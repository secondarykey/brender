package api

import (
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func ListWorkspacesByProject(projectID string, sort string) ([]*model.WorkspacesByFile, error) {
	return model.ListWorkspacesByProject(projectID, sort)
}

func GetWorkspace(projectID string, workspaceID string) (*model.WorkspaceDetail, error) {
	return model.GetWorkspace(projectID, workspaceID)
}

func CreateWorkspace(projectID string, projectFileID string, name string) (*model.Workspace, error) {
	if name == "" {
		return nil, xerrors.New("workspace name is required")
	}
	return model.CreateWorkspace(projectID, projectFileID, name, false)
}

func UpdateWorkspace(projectID string, workspaceID string, name string, blenderInstallID uint, scene, engine string, startFrame, endFrame, frameStep, thread, samples int) (*model.WorkspaceDetail, error) {
	if name == "" {
		return nil, xerrors.New("workspace name is required")
	}
	return model.UpdateWorkspace(projectID, workspaceID, name, blenderInstallID, scene, engine, startFrame, endFrame, frameStep, thread, samples)
}

func DeleteWorkspace(projectID, workspaceID string) error {
	dirs, _ := model.ListOutputDirsByWorkspace(workspaceID)
	removeOutputDirs(dirs)
	if err := model.DeleteJobsByWorkspace(workspaceID); err != nil {
		return xerrors.Errorf("DeleteWorkspace jobs: %w", err)
	}
	return model.DeleteWorkspace(projectID, workspaceID)
}
