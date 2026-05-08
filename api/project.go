package api

import (
	"os"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func ListProjects() ([]*model.ProjectDetail, error) {
	return model.ListProjects()
}

func GetProject(id string) (*model.ProjectDetail, error) {
	return model.GetProject(id)
}

func UpdateProject(id, name string, blenderInstallID uint, scene string) (*model.ProjectDetail, error) {
	if name == "" {
		return nil, xerrors.New("project name is required")
	}
	return model.UpdateProject(id, name, blenderInstallID, scene)
}

func UpdateProjectFile(fileID uint, name string) (*model.ProjectFile, error) {
	if name == "" {
		return nil, xerrors.New("file name is required")
	}
	return model.UpdateProjectFile(fileID, name)
}

func AddProjectFile(projectID, path string) (*model.ProjectFile, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, xerrors.Errorf("file not found: %s", path)
	}
	return model.AddProjectFile(projectID, path)
}

func RemoveProjectFile(fileID uint) error {
	return model.RemoveProjectFile(fileID)
}

func DeleteProjectFile(fileID uint) error {
	if err := model.DeleteJobsByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile jobs: %w", err)
	}
	if err := model.DeleteWorkspacesByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile workspaces: %w", err)
	}
	return model.RemoveProjectFile(fileID)
}

func DeleteProject(id string) error {
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
	return model.CreateProject(name, 0, nil)
}
