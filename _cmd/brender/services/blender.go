package services

import (
	"runtime"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/exec"
	"github.com/secondarykey/brender/model"
)

type Blender struct{}

func NewBlender() *Blender {
	var b Blender
	return &b
}

func (s *Blender) List() ([]*model.BlenderInstall, error) {
	return api.ListBlenders()
}

func (s *Blender) Register(path string) (*model.BlenderInstall, error) {
	return api.RegisterBlender(path)
}

func (s *Blender) Delete(id uint) error {
	return api.DeleteBlender(id)
}

func (s *Blender) Reorder(ids []uint) error {
	return api.ReorderBlenders(ids)
}

func (s *Blender) OpenFile(installID uint, filePath string) error {
	return api.OpenBlenderFile(installID, filePath)
}

func (s *Blender) GetEngines(installID uint) ([]string, error) {
	return api.GetEngines(installID)
}

func (s *Blender) GetScenes(installID uint, fileID string) ([]string, error) {
	return api.GetScenes(installID, fileID)
}

func (s *Blender) GetCameras(installID uint, fileID string) ([]*exec.CameraTool, error) {
	return api.GetCameras(installID, fileID)
}

func (s *Blender) GetToolData(installID uint, fileID string) (*exec.Tool, error) {
	return api.GetToolData(installID, fileID)
}

func (s *Blender) GetCPUCount() int {
	return runtime.NumCPU()
}
