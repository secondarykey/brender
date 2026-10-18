package services

import (
	"context"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
)

type WorkDir struct{}

func NewWorkDir() *WorkDir { return &WorkDir{} }

func (w *WorkDir) List(ctx context.Context) ([]*model.WorkDir, error) {
	return api.ListWorkDirs()
}

func (w *WorkDir) Create(ctx context.Context, path string, priority int) (*model.WorkDir, error) {
	return api.CreateWorkDir(ctx, path, priority)
}

func (w *WorkDir) Update(ctx context.Context, id uint, path string, priority int, status string) (*model.WorkDir, error) {
	return api.UpdateWorkDir(ctx, id, path, priority, status)
}

func (w *WorkDir) Reorder(ctx context.Context, ids []uint) error {
	return api.ReorderWorkDirs(ctx, ids)
}

func (w *WorkDir) Delete(ctx context.Context, id uint) error {
	return api.DeleteWorkDir(ctx, id)
}

func (w *WorkDir) CheckDir(ctx context.Context, path string) (map[string]interface{}, error) {
	return api.CheckWorkDir(ctx, path)
}

func (w *WorkDir) StartMigration(ctx context.Context, projectID string, newWorkDirID uint) error {
	return api.StartMigrateProjectWorkDir(ctx, projectID, newWorkDirID)
}

func (w *WorkDir) GetWorkDirStats(ctx context.Context, id uint) (map[string]interface{}, error) {
	return api.GetWorkDirStats(id)
}

func (w *WorkDir) ChangeDir(ctx context.Context, id uint, newPath string) error {
	return api.StartChangeWorkDir(ctx, id, newPath)
}

func (w *WorkDir) GetProjectDiskSize(ctx context.Context, projectID string) (int64, error) {
	return api.GetProjectDiskSize(projectID)
}
