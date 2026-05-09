package main

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type BlenderService struct{}

func (s *BlenderService) List() ([]*model.BlenderInstall, error) {
	return api.ListBlenders()
}

func (s *BlenderService) Register(path string) (*model.BlenderInstall, error) {
	return api.RegisterBlender(path)
}

func (s *BlenderService) Delete(id uint) error {
	return api.DeleteBlender(id)
}

func (s *BlenderService) Reorder(ids []uint) error {
	return api.ReorderBlenders(ids)
}

func (s *BlenderService) GetEngines(installID uint) ([]string, error) {
	return api.GetEngines(installID)
}

func (s *BlenderService) GetScenes(installID uint, fileID uint) ([]string, error) {
	return api.GetScenes(installID, fileID)
}

func (s *BlenderService) GetFileInfo(installID uint, fileID uint) (*api.FileInfo, error) {
	return api.GetFileInfo(installID, fileID)
}
