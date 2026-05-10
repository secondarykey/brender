package main

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type ProjectService struct{}

func (s *ProjectService) List() ([]*model.ProjectDetail, error) {
	return api.ListProjects()
}

func (s *ProjectService) Get(id string) (*model.ProjectDetail, error) {
	return api.GetProject(id)
}

func (s *ProjectService) Create(name string) (*model.ProjectDetail, error) {
	return api.CreateProject(name)
}

func (s *ProjectService) Delete(id string) error {
	return api.DeleteProject(id)
}

func (s *ProjectService) Update(id, name string) (*model.ProjectDetail, error) {
	return api.UpdateProject(id, name)
}

func (s *ProjectService) UpdateFile(fileID string, name string, blenderInstallID uint, scene string) (*model.ProjectFile, error) {
	return api.UpdateProjectFile(fileID, name, blenderInstallID, scene)
}

func (s *ProjectService) GetFile(fileID string) (*model.ProjectFile, error) {
	return api.GetFile(fileID)
}

func (s *ProjectService) AddFile(projectID, path string) (*model.ProjectFile, error) {
	return api.AddProjectFile(projectID, path)
}

func (s *ProjectService) RemoveFile(fileID string) error {
	return api.RemoveProjectFile(fileID)
}

func (s *ProjectService) DeleteFile(fileID string) error {
	return api.DeleteProjectFile(fileID)
}

func (s *ProjectService) GetFileThumbnail(projectID string, fileID string) (string, error) {
	return api.GetFileThumbnail(projectID, fileID)
}
