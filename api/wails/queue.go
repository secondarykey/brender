package wails

import (
	"fmt"
	"net/url"
	"path/filepath"
	"time"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
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

func (s *Queue) KillRunning() {
	api.KillRunningQueues()
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

func (s *Queue) GetJob(id string) (*model.Job, error) {
	return model.GetJob(id)
}

func (s *Queue) UpdateJobMeta(id, name, note string) error {
	return api.UpdateJobMeta(id, name, note)
}

func (s *Queue) DeleteJob(id string) error {
	return api.DeleteJob(id)
}

func (s *Queue) BulkDeleteJobsByWorkspace(projectID string, workspaceID string, keepCount int, dataOnly bool, errorOnly bool) (int, error) {
	return api.BulkDeleteJobsByWorkspace(projectID, workspaceID, keepCount, dataOnly, errorOnly)
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

func (s *Queue) ZipJobSelectedFiles(id string, filePaths []string, savePath string) error {
	return api.ZipJobSelectedFiles(id, filePaths, savePath)
}

func (s *Queue) DeleteJobFiles(id string, filePaths []string) error {
	return api.DeleteJobFiles(id, filePaths)
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

func (s *Queue) GetCleanableJobStats() (*model.CleanableJobStats, error) {
	return api.GetCleanableJobStats()
}

func (s *Queue) CleanJobData() (int, error) {
	return api.CleanJobData()
}

func (s *Queue) OpenLogWindow(jobID string) error {
	title := "render.log"
	if j, err := model.GetJob(jobID); err == nil && j != nil {
		title = fmt.Sprintf("render.log — %s", j.Name)
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

const miniMonitorWindowName = "mini-monitor"

func (s *Queue) OpenMiniMonitor() error {
	app := application.Get()
	if win, ok := app.Window.GetByName(miniMonitorWindowName); ok {
		win.Show()
		win.Focus()
		return nil
	}
	if main, ok := app.Window.GetByName("main"); ok {
		main.Hide()
	}
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             miniMonitorWindowName,
		Title:            "Queue Monitor",
		Width:            600,
		Height:           90,
		MinWidth:         600,
		MaxWidth:         600,
		MinHeight:        90,
		MaxHeight:        90,
		Frameless:        true,
		URL:              "/?minimonitor=1",
		BackgroundColour: application.NewRGB(26, 26, 26),
	})
	win.RegisterHook(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		if main, ok := app.Window.GetByName("main"); ok {
			main.Show()
			main.Focus()
		}
	})
	win.Show()
	return nil
}

func (s *Queue) CloseMiniMonitor() error {
	app := application.Get()
	if main, ok := app.Window.GetByName("main"); ok {
		main.Show()
		main.Focus()
	}
	if win, ok := app.Window.GetByName(miniMonitorWindowName); ok {
		win.Close()
	}
	return nil
}
