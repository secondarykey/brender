package main

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type QueueService struct{}

func (s *QueueService) PreviewRender(projectID string, workspaceID string) (*api.RenderPreview, error) {
	return api.PreviewRender(projectID, workspaceID)
}

func (s *QueueService) EnqueueWithPreview(projectID string, workspaceID string, preview *api.RenderPreview) (*model.Queue, error) {
	return api.EnqueueWithPreview(projectID, workspaceID, preview)
}

func (s *QueueService) Enqueue(projectID string, workspaceID string) (*model.Queue, error) {
	return api.Enqueue(projectID, workspaceID)
}

func (s *QueueService) List() ([]*model.Queue, error) {
	return api.ListQueues()
}

func (s *QueueService) ListItems() ([]*api.QueueItem, error) {
	return api.ListQueueItems()
}

func (s *QueueService) ListByWorkspace(projectID string, workspaceID string) ([]*model.Queue, error) {
	return api.ListQueuesByWorkspace(projectID, workspaceID)
}

func (s *QueueService) Get(id string) (*model.Queue, error) {
	return api.GetQueue(id)
}

func (s *QueueService) Cancel(id string) error {
	return api.CancelQueue(id)
}

func (s *QueueService) ListJobs() ([]*model.Job, error) {
	return api.ListJobs()
}

func (s *QueueService) ListJobsByWorkspace(projectID string, workspaceID string) ([]*model.Job, error) {
	return api.ListJobsByWorkspace(projectID, workspaceID)
}

func (s *QueueService) ListJobsByProjectFile(projectID string, fileID uint) ([]*model.Job, error) {
	return api.ListJobsByProjectFile(projectID, fileID)
}

func (s *QueueService) DeleteJob(id string) error {
	return api.DeleteJob(id)
}
