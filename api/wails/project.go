package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Project struct{}

func NewProject() *Project {
	var p Project
	return &p
}

func (s *Project) List(sort string) ([]*model.ProjectDetail, error) {
	return api.ListProjects(sort)
}

func (s *Project) Get(id string) (*model.ProjectDetail, error) {
	return api.GetProject(id)
}

func (s *Project) Create(name string) (*model.ProjectDetail, error) {
	return api.CreateProject(name)
}

func (s *Project) Delete(id string) error {
	return api.DeleteProject(id)
}

func (s *Project) Update(id, name string) (*model.ProjectDetail, error) {
	return api.UpdateProject(id, name)
}

func (s *Project) UpdateFile(fileID string, name string, blenderInstallID uint, scene, camera, engine string, engineFixed bool) (*model.ProjectFile, error) {
	return api.UpdateProjectFile(fileID, name, blenderInstallID, scene, camera, engine, engineFixed)
}

func (s *Project) GetFile(fileID string) (*model.ProjectFile, error) {
	return api.GetFile(fileID)
}

func (s *Project) AddFile(projectID, path string) (*model.ProjectFile, error) {
	return api.AddProjectFile(projectID, path)
}

func (s *Project) RemoveFile(fileID string) error {
	return api.RemoveProjectFile(fileID)
}

func (s *Project) DeleteFile(fileID string) error {
	return api.DeleteProjectFile(fileID)
}

func (s *Project) GetFileThumbnail(projectID string, fileID string) (string, error) {
	return api.GetFileThumbnail(projectID, fileID)
}

func (s *Project) GetProjectThumbnail(projectID string) (string, error) {
	return api.GetProjectThumbnail(projectID)
}

func (s *Project) SetProjectThumbnail(projectID string, imagePath string) (string, error) {
	return api.SetProjectThumbnail(projectID, imagePath)
}

func (s *Project) SetFileThumbnail(projectID string, fileID string, imagePath string) (string, error) {
	return api.SetFileThumbnail(projectID, fileID, imagePath)
}

func (s *Project) SetFileThumbnailFromWorkspace(projectID string, fileID string, workspaceID string) (string, error) {
	return api.SetFileThumbnailFromWorkspace(projectID, fileID, workspaceID)
}

func (s *Project) SetProjectThumbnailFromFile(projectID string, fileID string) (string, error) {
	return api.SetProjectThumbnailFromFile(projectID, fileID)
}
