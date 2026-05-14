package api

import (
	"log"
	"time"

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
	ws, err := model.CreateWorkspace(projectID, projectFileID, name, false)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateWorkspaceProcessedAt(ws.ID, &now); err != nil {
		log.Printf("CreateWorkspace: UpdateWorkspaceProcessedAt: %v", err)
	}
	if err := model.UpdateProjectFileProcessedAt(projectFileID, &now); err != nil {
		log.Printf("CreateWorkspace: UpdateProjectFileProcessedAt: %v", err)
	}
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		log.Printf("CreateWorkspace: UpdateProjectProcessedAt: %v", err)
	}
	return ws, nil
}

func UpdateWorkspace(projectID string, workspaceID string, name string, blenderInstallID uint, scene, camera, engine string, startFrame, endFrame, frameStep, thread, samples int) (*model.WorkspaceDetail, error) {
	if name == "" {
		return nil, xerrors.New("workspace name is required")
	}
	return model.UpdateWorkspace(projectID, workspaceID, name, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples)
}

func DeleteWorkspace(projectID, workspaceID string) error {
	dirs, _ := model.ListOutputDirsByWorkspace(workspaceID)
	removeOutputDirs(dirs)
	if err := model.DeleteJobsByWorkspace(workspaceID); err != nil {
		return xerrors.Errorf("DeleteWorkspace jobs: %w", err)
	}
	return model.DeleteWorkspace(projectID, workspaceID)
}
