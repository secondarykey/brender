package wails

import (
	"fmt"
	"net/url"
	"path/filepath"
	"time"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
	"github.com/wailsapp/wails/v3/pkg/application"
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

func (s *Queue) TestEnqueue(projectID string, workspaceID string, params api.TestRenderParams) (*model.Queue, error) {
	return api.TestEnqueue(projectID, workspaceID, params)
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

func (s *Queue) ListJobFiles(id string) ([]*api.JobFileInfo, error) {
	return api.ListJobFiles(id)
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

func (s *Queue) ZipJobData(id string, savePath string) error {
	return api.ZipJobData(id, savePath)
}

func (s *Queue) OpenMovieWindow(videoPath string) error {
	title := filepath.Base(videoPath)
	winName := fmt.Sprintf("movie-%d", time.Now().UnixNano())
	application.Get().Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             winName,
		Title:            title,
		Width:            1280,
		Height:           720,
		Frameless:        true,
		URL:              "/?movie=" + url.QueryEscape(videoPath),
		BackgroundColour: application.NewRGB(0, 0, 0),
	}).Show()
	return nil
}

func (s *Queue) OpenLogWindow(jobID string) error {
	title := "render.log"
	if j, err := model.GetJob(jobID); err == nil && j != nil {
		title = fmt.Sprintf("render.log — %s / %s", j.ProjectName, j.WorkspaceName)
	}

	winName := fmt.Sprintf("log-%s-%d", jobID, time.Now().UnixNano())
	application.Get().Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             winName,
		Title:            title,
		Width:            900,
		Height:           700,
		Frameless:        true,
		URL:              "/?log=" + jobID,
		BackgroundColour: application.NewRGB(26, 26, 26),
	}).Show()

	return nil
}
