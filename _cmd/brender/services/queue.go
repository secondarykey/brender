package services

import (
	"fmt"
	"net/url"
	"path/filepath"
	"time"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
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
	return api.EnqueueWithPreview(api.WailsContext(), projectID, workspaceID, preview)
}

func (s *Queue) Enqueue(projectID string, workspaceID string) (*model.Queue, error) {
	return api.Enqueue(api.WailsContext(), projectID, workspaceID)
}

func (s *Queue) TestEnqueue(projectID string, workspaceID string, params api.TestRenderParams) (*model.Queue, error) {
	return api.TestEnqueue(api.WailsContext(), projectID, workspaceID, params)
}

func (s *Queue) SamplesComparisonEnqueue(projectID string, workspaceID string, sampleCounts []int, frame int) (*model.Queue, error) {
	return api.SamplesComparisonEnqueue(api.WailsContext(), projectID, workspaceID, sampleCounts, frame)
}

func (s *Queue) List() ([]*model.Queue, error) {
	return api.ListQueues()
}

func (s *Queue) ListItems() ([]*api.QueueItem, error) {
	return api.ListQueueItems(api.WailsContext())
}

func (s *Queue) ListByWorkspace(projectID string, workspaceID string) ([]*model.Queue, error) {
	return api.ListQueuesByWorkspace(projectID, workspaceID)
}

func (s *Queue) Get(id string) (*model.Queue, error) {
	return api.GetQueue(id)
}

func (s *Queue) Cancel(id string) error {
	return api.CancelQueue(api.WailsContext(), id)
}

func (s *Queue) KillRunning() error {
	return api.KillRunningQueuesByUser(api.WailsContext())
}

func (s *Queue) ListJobs() ([]*model.Job, error) {
	return api.ListJobs()
}

func (s *Queue) ListJobsPaged(filter *model.JobFilter, page int, pageSize int) (*model.JobListResult, error) {
	return api.ListJobsPaged(api.WailsContext(), filter, page, pageSize)
}

func (s *Queue) ListJobsByWorkspace(projectID string, workspaceID string) ([]*model.Job, error) {
	return api.ListJobsByWorkspace(api.WailsContext(), projectID, workspaceID)
}

func (s *Queue) ListJobsByWorkspacePaged(projectID string, workspaceID string, page int, pageSize int) (*model.JobPagedResult, error) {
	return api.ListJobsByWorkspacePaged(api.WailsContext(), projectID, workspaceID, page, pageSize)
}

func (s *Queue) ListJobsByProjectFile(projectID string, fileID string) ([]*model.Job, error) {
	return api.ListJobsByProjectFile(api.WailsContext(), projectID, fileID)
}

func (s *Queue) ListJobsByProjectFilePaged(projectID string, fileID string, page int, pageSize int) (*model.JobPagedResult, error) {
	return api.ListJobsByProjectFilePaged(api.WailsContext(), projectID, fileID, page, pageSize)
}

func (s *Queue) GetJob(id string) (*model.Job, error) {
	return api.GetJob(api.WailsContext(), id)
}

func (s *Queue) UpdateJobMeta(id, name, note string) error {
	return api.UpdateJobMeta(api.WailsContext(), id, name, note)
}

func (s *Queue) DeleteJob(id string) error {
	return api.DeleteJob(api.WailsContext(), id)
}

func (s *Queue) BulkDeleteJobsByWorkspace(projectID string, workspaceID string, keepCount int, dataOnly bool, errorOnly bool) (int, error) {
	return api.BulkDeleteJobsByWorkspace(api.WailsContext(), projectID, workspaceID, keepCount, dataOnly, errorOnly)
}

func (s *Queue) DeleteJobData(id string) error {
	return api.DeleteJobData(api.WailsContext(), id)
}

func (s *Queue) ListJobImages(id string) ([]string, error) {
	return api.ListJobImages(api.WailsContext(), id)
}

func (s *Queue) ListJobFiles(id string) ([]*api.JobFileInfo, error) {
	return api.ListJobFiles(api.WailsContext(), id)
}

func (s *Queue) GetImageBase64(path string) (string, error) {
	return api.GetImageBase64(api.WailsContext(), path)
}

func (s *Queue) LockJob(id string) error {
	return api.LockJob(api.WailsContext(), id)
}

func (s *Queue) UnlockJob(id string) error {
	return api.UnlockJob(api.WailsContext(), id)
}

func (s *Queue) GetJobLog(id string) (string, error) {
	return api.GetJobLog(api.WailsContext(), id)
}

func (s *Queue) ZipJobData(id string, savePath string) error {
	return api.ZipJobData(api.WailsContext(), id, savePath)
}

func (s *Queue) ZipJobSelectedFiles(id string, filePaths []string, savePath string) error {
	return api.ZipJobSelectedFiles(api.WailsContext(), id, filePaths, savePath)
}

func (s *Queue) DeleteJobFiles(id string, filePaths []string) error {
	return api.DeleteJobFiles(api.WailsContext(), id, filePaths)
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

func (s *Queue) GetCleanableJobStats(filter *model.CleanFilter) (*model.CleanableJobStats, error) {
	return api.GetCleanableJobStats(filter)
}

func (s *Queue) CleanJobData(filter *model.CleanFilter) (int, error) {
	return api.CleanJobData(api.WailsContext(), filter)
}

func (s *Queue) MeasureFilteredDiskSize(filter *model.CleanFilter) (int64, error) {
	return api.MeasureFilteredDiskSize(filter)
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
