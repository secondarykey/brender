package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type Workspace struct{}

func NewWorkspace() *Workspace {
	var w Workspace
	return &w
}

func (s *Workspace) ListByProject(projectID string, sort, dir string) ([]*model.WorkspacesByFile, error) {
	return api.ListWorkspacesByProject(projectID, sort, dir)
}

func (s *Workspace) Get(projectID string, workspaceID string) (*model.WorkspaceDetail, error) {
	return api.GetWorkspace(projectID, workspaceID)
}

func (s *Workspace) Create(projectID string, projectFileID string, name string) (*model.Workspace, error) {
	return api.CreateWorkspace(projectID, projectFileID, name)
}

func (s *Workspace) CreateBatch(projectID string, projectFileID string, specs []api.WorkspaceBatchSpec) ([]*model.Workspace, error) {
	return api.CreateWorkspaceBatch(projectID, projectFileID, specs)
}

func (s *Workspace) Copy(projectID string, workspaceID string, newName string) (*model.Workspace, error) {
	return api.CopyWorkspace(projectID, workspaceID, newName)
}

func (s *Workspace) Update(projectID string, workspaceID string, name string, note string, blenderInstallID uint, scene, camera, engine string, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY int) (*model.WorkspaceDetail, error) {
	return api.UpdateWorkspace(projectID, workspaceID, name, note, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY)
}

func (s *Workspace) Delete(projectID, workspaceID string, force bool) error {
	return api.DeleteWorkspace(projectID, workspaceID, force)
}

func (s *Workspace) GetThumbnail(projectID string, fileID string, workspaceID string) (string, error) {
	return api.GetWorkspaceThumbnail(projectID, fileID, workspaceID)
}

func (s *Workspace) SetThumbnail(projectID string, fileID string, workspaceID string, imagePath string) (string, error) {
	return api.SetWorkspaceThumbnail(projectID, fileID, workspaceID, imagePath)
}

// movieCreatedEvent は movie:created イベントのペイロード。
type movieCreatedEvent struct {
	JobID string `json:"job_id"`
	Path  string `json:"path"`
	Error string `json:"error"`
}

// CreateMovie は ffmpeg による動画作成を goroutine で開始し即返す。
// ffmpeg プロセス完了後（成功・失敗とも）に "movie:created" イベントを emit する。
func (s *Workspace) CreateMovie(projectID string, fileID string, workspaceID string, jobID string, fps int, inext string, outext string, extraArgs string) {
	go func() {
		path, ch, err := api.CreateMovie(projectID, fileID, workspaceID, jobID, fps, inext, outext, extraArgs)
		if err != nil {
			application.Get().Event.Emit("movie:created", movieCreatedEvent{JobID: jobID, Error: err.Error()})
			return
		}
		err = <-ch
		ev := movieCreatedEvent{JobID: jobID, Path: path}
		if err != nil {
			ev.Error = err.Error()
		}
		application.Get().Event.Emit("movie:created", ev)
	}()
}
