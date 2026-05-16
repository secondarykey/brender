package api

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func ListWorkspacesByProject(projectID string, sort, dir string) ([]*model.WorkspacesByFile, error) {
	return model.ListWorkspacesByProject(projectID, sort, dir)
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

func UpdateWorkspace(projectID string, workspaceID string, name string, note string, blenderInstallID uint, scene, camera, engine string, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY int) (*model.WorkspaceDetail, error) {
	if name == "" {
		return nil, xerrors.New("workspace name is required")
	}
	return model.UpdateWorkspace(projectID, workspaceID, name, note, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY)
}

func DeleteWorkspace(projectID, workspaceID string, force bool) error {
	if !force {
		locked, err := model.HasLockedJobsByWorkspace(workspaceID)
		if err != nil {
			return xerrors.Errorf("DeleteWorkspace: %w", err)
		}
		if locked {
			return xerrors.New("locked_jobs_exist")
		}
	}
	dirs, _ := model.ListOutputDirsByWorkspace(workspaceID)
	removeOutputDirs(dirs)
	// ジョブディレクトリを削除後、空になった {workspaceID}/ ディレクトリ自体も削除する
	if len(dirs) > 0 {
		wsDir := filepath.Dir(dirs[0])
		if err := os.RemoveAll(wsDir); err != nil {
			log.Printf("DeleteWorkspace: remove workspace dir: %v", err)
		}
	}
	if err := model.DeleteJobsByWorkspace(workspaceID); err != nil {
		return xerrors.Errorf("DeleteWorkspace jobs: %w", err)
	}
	return model.DeleteWorkspace(projectID, workspaceID)
}
