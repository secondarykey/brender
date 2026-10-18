package services

import (
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
)

type WorkDir struct{}

func NewWorkDir() *WorkDir { return &WorkDir{} }

func (w *WorkDir) List() ([]*model.WorkDir, error) {
	return api.ListWorkDirs()
}

func (w *WorkDir) Create(path string, priority int) (*model.WorkDir, error) {
	return api.CreateWorkDir(api.WailsContext(), path, priority)
}

func (w *WorkDir) Update(id uint, path string, priority int, status string) (*model.WorkDir, error) {
	return api.UpdateWorkDir(api.WailsContext(), id, path, priority, status)
}

func (w *WorkDir) Reorder(ids []uint) error {
	return api.ReorderWorkDirs(api.WailsContext(), ids)
}

func (w *WorkDir) Delete(id uint) error {
	return api.DeleteWorkDir(api.WailsContext(), id)
}

func (w *WorkDir) CheckDir(path string) (map[string]interface{}, error) {
	return api.CheckWorkDir(api.WailsContext(), path)
}

func (w *WorkDir) StartMigration(projectID string, newWorkDirID uint) error {
	return api.StartMigrateProjectWorkDir(api.WailsContext(), projectID, newWorkDirID)
}

func (w *WorkDir) GetWorkDirStats(id uint) (map[string]interface{}, error) {
	return api.GetWorkDirStats(id)
}

func (w *WorkDir) ChangeDir(id uint, newPath string) error {
	return api.StartChangeWorkDir(api.WailsContext(), id, newPath)
}

func (w *WorkDir) GetProjectDiskSize(projectID string) (int64, error) {
	return api.GetProjectDiskSize(projectID)
}
