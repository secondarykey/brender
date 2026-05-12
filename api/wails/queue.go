package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Queue struct{}

func NewQueue() *Queue {
	var q Queue
	return &q
}

func (s *Queue) PreviewRender(projectID string, workspaceID string) (*api.RenderPreview, error) {
	return api.PreviewRender(projectID, workspaceID)
}

func (s *Queue) EnqueueWithPreview(projectID string, workspaceID string, preview *api.RenderPreview) (*model.Queue, error) {
	return api.EnqueueWithPreview(projectID, workspaceID, preview)
}

func (s *Queue) Enqueue(projectID string, workspaceID string) (*model.Queue, error) {
	return api.Enqueue(projectID, workspaceID)
}

func (s *Queue) List() ([]*model.Queue, error) {
	return api.ListQueues()
}

func (s *Queue) ListItems() ([]*api.QueueItem, error) {
	return api.ListQueueItems()
}

func (s *Queue) ListByWorkspace(projectID string, workspaceID string) ([]*model.Queue, error) {
	return api.ListQueuesByWorkspace(projectID, workspaceID)
}

func (s *Queue) Get(id string) (*model.Queue, error) {
	return api.GetQueue(id)
}

func (s *Queue) Cancel(id string) error {
	return api.CancelQueue(id)
}

func (s *Queue) ListJobs() ([]*model.Job, error) {
	return api.ListJobs()
}

func (s *Queue) ListJobsByWorkspace(projectID string, workspaceID string) ([]*model.Job, error) {
	return api.ListJobsByWorkspace(projectID, workspaceID)
}

func (s *Queue) ListJobsByProjectFile(projectID string, fileID string) ([]*model.Job, error) {
	return api.ListJobsByProjectFile(projectID, fileID)
}

func (s *Queue) DeleteJob(id string) error {
	return api.DeleteJob(id)
}

func (s *Queue) DeleteJobData(id string) error {
	return api.DeleteJobData(id)
}

func (s *Queue) ListJobImages(id string) ([]string, error) {
	return api.ListJobImages(id)
}

func (s *Queue) GetImageBase64(path string) (string, error) {
	return api.GetImageBase64(path)
}

func (s *Queue) LockJob(id string) error {
	return api.LockJob(id)
}

func (s *Queue) UnlockJob(id string) error {
	return api.UnlockJob(id)
}

func (s *Queue) GetJobLog(id string) (string, error) {
	return api.GetJobLog(id)
}
