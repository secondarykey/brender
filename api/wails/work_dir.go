package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type WorkDir struct{}

func NewWorkDir() *WorkDir { return &WorkDir{} }

func (w *WorkDir) List() ([]*model.WorkDir, error) {
	return api.ListWorkDirs()
}

func (w *WorkDir) Create(path string, priority int) (*model.WorkDir, error) {
	return api.CreateWorkDir(path, priority)
}

func (w *WorkDir) Update(id uint, path string, priority int, status string) (*model.WorkDir, error) {
	return api.UpdateWorkDir(id, path, priority, status)
}

func (w *WorkDir) Delete(id uint) error {
	return api.DeleteWorkDir(id)
}

func (w *WorkDir) CheckDir(path string) (map[string]interface{}, error) {
	return api.CheckWorkDir(path)
}

func (w *WorkDir) StartMigration(projectID string, newWorkDirID uint) error {
	return api.StartMigrateProjectWorkDir(projectID, newWorkDirID)
}
