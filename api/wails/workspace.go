package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Workspace struct{}

func NewWorkspace() *Workspace {
	var w Workspace
	return &w
}

func (s *Workspace) ListByProject(projectID string, sort, dir string) ([]*model.WorkspacesByFile, error) {
	return api.ListWorkspacesByProject(api.WailsContext(), projectID, sort, dir)
}

func (s *Workspace) Get(projectID string, workspaceID string) (*model.WorkspaceDetail, error) {
	return api.GetWorkspace(api.WailsContext(), projectID, workspaceID)
}

func (s *Workspace) Create(projectID string, projectFileID string, name string) (*model.Workspace, error) {
	return api.CreateWorkspace(api.WailsContext(), projectID, projectFileID, name)
}

func (s *Workspace) CreateBatch(projectID string, projectFileID string, specs []api.WorkspaceBatchSpec) ([]*model.Workspace, error) {
	return api.CreateWorkspaceBatch(api.WailsContext(), projectID, projectFileID, specs)
}

func (s *Workspace) Copy(projectID string, workspaceID string, newName string) (*model.Workspace, error) {
	return api.CopyWorkspace(api.WailsContext(), projectID, workspaceID, newName)
}

func (s *Workspace) Update(projectID string, workspaceID string, name string, note string, blenderInstallID uint, scene, camera, engine string, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY int, outputFormat string, autoLock bool, autoLockMinSize int64, autoLockKeep int) (*model.WorkspaceDetail, error) {
	return api.UpdateWorkspace(api.WailsContext(), projectID, workspaceID, name, note, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY, outputFormat, autoLock, autoLockMinSize, autoLockKeep)
}

func (s *Workspace) Delete(projectID, workspaceID string, force bool) error {
	return api.DeleteWorkspace(api.WailsContext(), projectID, workspaceID, force)
}

func (s *Workspace) GetThumbnail(projectID string, fileID string, workspaceID string) (string, error) {
	return api.GetWorkspaceThumbnail(projectID, fileID, workspaceID)
}

func (s *Workspace) SetThumbnail(projectID string, fileID string, workspaceID string, imagePath string) (string, error) {
	return api.SetWorkspaceThumbnail(api.WailsContext(), projectID, fileID, workspaceID, imagePath)
}

// CreateMovie は ffmpeg による動画作成を goroutine で開始し即返す。
// ffmpeg プロセス完了後（成功・失敗とも）に api.MovieCreatedHook 経由で通知する。
// 入力拡張子はジョブの OutputExt から自動取得するため、呼び出し元での指定は不要。
func (s *Workspace) CreateMovie(projectID string, fileID string, workspaceID string, jobID string, fps int, outext string, extraArgs string) {
	go func() {
		path, ch, err := api.CreateMovie(api.WailsContext(), projectID, fileID, workspaceID, jobID, fps, outext, extraArgs)
		if err != nil {
			if api.MovieCreatedHook != nil {
				api.MovieCreatedHook(jobID, "", err.Error())
			}
			return
		}
		errMsg := ""
		if err := <-ch; err != nil {
			errMsg = err.Error()
		}
		if api.MovieCreatedHook != nil {
			api.MovieCreatedHook(jobID, path, errMsg)
		}
	}()
}
