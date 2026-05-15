package api

import (
	"log/slog"
	"os"
	"time"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func ListProjects(sort string) ([]*model.ProjectDetail, error) {
	return model.ListProjects(sort)
}

func GetProject(id string) (*model.ProjectDetail, error) {
	return model.GetProject(id)
}

func UpdateProject(id, name string) (*model.ProjectDetail, error) {
	if name == "" {
		return nil, xerrors.New("project name is required")
	}
	return model.UpdateProject(id, name)
}

func UpdateProjectFile(fileID string, name string, blenderInstallID uint, blenderFixed bool, scene string, sceneFixed bool, camera string, cameraFixed bool, engine string, engineFixed bool) (*model.ProjectFile, error) {
	if name == "" {
		return nil, xerrors.New("file name is required")
	}
	return model.UpdateProjectFile(fileID, name, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed)
}

func GetFile(fileID string) (*model.ProjectFile, error) {
	return model.GetProjectFile(fileID)
}

func AddProjectFile(projectID, path string) (*model.ProjectFile, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, xerrors.Errorf("file not found: %s", path)
	}
	f, err := model.AddProjectFile(projectID, path)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateProjectFileProcessedAt(f.ID, &now); err != nil {
		slog.Error("AddProjectFile: UpdateProjectFileProcessedAt", "error", err)
	}
	touchProjectProcessedAt(projectID)
	go func() {
		if err := CreateThumbnailWorkspace(projectID, f); err != nil {
			slog.Error("thumbnail workspace creation failed", "fileID", f.ID, "error", err)
		}
	}()
	return f, nil
}

func RemoveProjectFile(fileID string) error {
	return model.RemoveProjectFile(fileID)
}

func DeleteProjectFile(fileID string) error {
	dirs, _ := model.ListOutputDirsByProjectFile(fileID)
	removeOutputDirs(dirs)
	if err := model.DeleteJobsByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile jobs: %w", err)
	}
	if err := model.DeleteWorkspacesByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile workspaces: %w", err)
	}
	return model.RemoveProjectFile(fileID)
}

func DeleteProject(id string) error {
	dirs, _ := model.ListOutputDirsByProject(id)
	removeOutputDirs(dirs)
	if err := model.DeleteJobsByProject(id); err != nil {
		return xerrors.Errorf("DeleteProject jobs: %w", err)
	}
	if err := model.DeleteWorkspacesByProject(id); err != nil {
		return xerrors.Errorf("DeleteProject workspaces: %w", err)
	}
	return model.DeleteProject(id)
}

func CreateProject(name string) (*model.ProjectDetail, error) {
	if name == "" {
		return nil, xerrors.New("project name is required")
	}
	p := &model.Project{}
	if err := AssignDefaultWorkDir(p); err != nil {
		return nil, err
	}
	d, err := model.CreateProject(name, nil, p.WorkDirID)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateProjectProcessedAt(d.Project.ID, &now); err != nil {
		slog.Error("CreateProject: UpdateProjectProcessedAt", "error", err)
	}
	return d, nil
}

func touchProjectProcessedAt(projectID string) {
	now := time.Now()
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		slog.Error("touchProjectProcessedAt", "projectID", projectID, "error", err)
	}
}
