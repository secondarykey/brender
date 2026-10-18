package services

import (
	"context"
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

func (s *Queue) PreviewRender(ctx context.Context, projectID string, workspaceID string) (*api.RenderPreview, error) {
	return api.PreviewRender(projectID, workspaceID)
}

func (s *Queue) EnqueueWithPreview(ctx context.Context, projectID string, workspaceID string, preview *api.RenderPreview) (*model.Queue, error) {
	return api.EnqueueWithPreview(ctx, projectID, workspaceID, preview)
}

func (s *Queue) Enqueue(ctx context.Context, projectID string, workspaceID string) (*model.Queue, error) {
	return api.Enqueue(ctx, projectID, workspaceID)
}

func (s *Queue) TestEnqueue(ctx context.Context, projectID string, workspaceID string, params api.TestRenderParams) (*model.Queue, error) {
	return api.TestEnqueue(ctx, projectID, workspaceID, params)
}

func (s *Queue) SamplesComparisonEnqueue(ctx context.Context, projectID string, workspaceID string, sampleCounts []int, frame int) (*model.Queue, error) {
	return api.SamplesComparisonEnqueue(ctx, projectID, workspaceID, sampleCounts, frame)
}

func (s *Queue) List(ctx context.Context) ([]*model.Queue, error) {
	return api.ListQueues()
}

func (s *Queue) ListItems(ctx context.Context) ([]*api.QueueItem, error) {
	return api.ListQueueItems(ctx)
}

func (s *Queue) ListByWorkspace(ctx context.Context, projectID string, workspaceID string) ([]*model.Queue, error) {
	return api.ListQueuesByWorkspace(projectID, workspaceID)
}

func (s *Queue) Get(ctx context.Context, id string) (*model.Queue, error) {
	return api.GetQueue(id)
}

func (s *Queue) Cancel(ctx context.Context, id string) error {
	return api.CancelQueue(ctx, id)
}

func (s *Queue) KillRunning(ctx context.Context) error {
	return api.KillRunningQueuesByUser(ctx)
}

func (s *Queue) ListJobs(ctx context.Context) ([]*model.Job, error) {
	return api.ListJobs()
}

func (s *Queue) ListJobsPaged(ctx context.Context, filter *model.JobFilter, page int, pageSize int) (*model.JobListResult, error) {
	return api.ListJobsPaged(ctx, filter, page, pageSize)
}

func (s *Queue) ListJobsByWorkspace(ctx context.Context, projectID string, workspaceID string) ([]*model.Job, error) {
	return api.ListJobsByWorkspace(ctx, projectID, workspaceID)
}

func (s *Queue) ListJobsByWorkspacePaged(ctx context.Context, projectID string, workspaceID string, page int, pageSize int) (*model.JobPagedResult, error) {
	return api.ListJobsByWorkspacePaged(ctx, projectID, workspaceID, page, pageSize)
}

func (s *Queue) ListJobsByProjectFile(ctx context.Context, projectID string, fileID string) ([]*model.Job, error) {
	return api.ListJobsByProjectFile(ctx, projectID, fileID)
}

func (s *Queue) ListJobsByProjectFilePaged(ctx context.Context, projectID string, fileID string, page int, pageSize int) (*model.JobPagedResult, error) {
	return api.ListJobsByProjectFilePaged(ctx, projectID, fileID, page, pageSize)
}

func (s *Queue) GetJob(ctx context.Context, id string) (*model.Job, error) {
	return api.GetJob(ctx, id)
}

func (s *Queue) UpdateJobMeta(ctx context.Context, id, name, note string) error {
	return api.UpdateJobMeta(ctx, id, name, note)
}

func (s *Queue) DeleteJob(ctx context.Context, id string) error {
	return api.DeleteJob(ctx, id)
}

func (s *Queue) BulkDeleteJobsByWorkspace(ctx context.Context, projectID string, workspaceID string, keepCount int, dataOnly bool, errorOnly bool) (int, error) {
	return api.BulkDeleteJobsByWorkspace(ctx, projectID, workspaceID, keepCount, dataOnly, errorOnly)
}

func (s *Queue) DeleteJobData(ctx context.Context, id string) error {
	return api.DeleteJobData(ctx, id)
}

func (s *Queue) ListJobImages(ctx context.Context, id string) ([]string, error) {
	return api.ListJobImages(ctx, id)
}

func (s *Queue) ListJobFiles(ctx context.Context, id string) ([]*api.JobFileInfo, error) {
	return api.ListJobFiles(ctx, id)
}

func (s *Queue) GetImageBase64(ctx context.Context, path string) (string, error) {
	return api.GetImageBase64(ctx, path)
}

func (s *Queue) LockJob(ctx context.Context, id string) error {
	return api.LockJob(ctx, id)
}

func (s *Queue) UnlockJob(ctx context.Context, id string) error {
	return api.UnlockJob(ctx, id)
}

func (s *Queue) GetJobLog(ctx context.Context, id string) (string, error) {
	return api.GetJobLog(ctx, id)
}

func (s *Queue) ZipJobData(ctx context.Context, id string, savePath string) error {
	return api.ZipJobData(ctx, id, savePath)
}

func (s *Queue) ZipJobSelectedFiles(ctx context.Context, id string, filePaths []string, savePath string) error {
	return api.ZipJobSelectedFiles(ctx, id, filePaths, savePath)
}

func (s *Queue) DeleteJobFiles(ctx context.Context, id string, filePaths []string) error {
	return api.DeleteJobFiles(ctx, id, filePaths)
}

// ウィンドウを開くメソッド（Open*/CloseMiniMonitor）は、ブラウザから呼ばれると
// サーバの機械の画面で開いてしまうため断る。

func (s *Queue) OpenMovieWindow(ctx context.Context, videoPath string) error {
	if api.FromBrowser(ctx) {
		return api.ErrNotAvailableFromBrowser
	}
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

func (s *Queue) GetCleanableJobStats(ctx context.Context, filter *model.CleanFilter) (*model.CleanableJobStats, error) {
	return api.GetCleanableJobStats(filter)
}

func (s *Queue) CleanJobData(ctx context.Context, filter *model.CleanFilter) (int, error) {
	return api.CleanJobData(ctx, filter)
}

func (s *Queue) MeasureFilteredDiskSize(ctx context.Context, filter *model.CleanFilter) (int64, error) {
	return api.MeasureFilteredDiskSize(filter)
}

func (s *Queue) OpenLogWindow(ctx context.Context, jobID string) error {
	if api.FromBrowser(ctx) {
		return api.ErrNotAvailableFromBrowser
	}
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

func (s *Queue) OpenMiniMonitor(ctx context.Context) error {
	if api.FromBrowser(ctx) {
		return api.ErrNotAvailableFromBrowser
	}
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

func (s *Queue) CloseMiniMonitor(ctx context.Context) error {
	if api.FromBrowser(ctx) {
		return api.ErrNotAvailableFromBrowser
	}
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
