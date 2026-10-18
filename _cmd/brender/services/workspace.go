package services

import (
	"context"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
)

type Workspace struct{}

func NewWorkspace() *Workspace {
	var w Workspace
	return &w
}

func (s *Workspace) ListByProject(ctx context.Context, projectID string, sort, dir string) ([]*model.WorkspacesByFile, error) {
	return api.ListWorkspacesByProject(ctx, projectID, sort, dir)
}

func (s *Workspace) Get(ctx context.Context, projectID string, workspaceID string) (*model.WorkspaceDetail, error) {
	return api.GetWorkspace(ctx, projectID, workspaceID)
}

func (s *Workspace) Create(ctx context.Context, projectID string, projectFileID string, name string) (*model.Workspace, error) {
	return api.CreateWorkspace(ctx, projectID, projectFileID, name)
}

func (s *Workspace) CreateBatch(ctx context.Context, projectID string, projectFileID string, specs []api.WorkspaceBatchSpec) ([]*model.Workspace, error) {
	return api.CreateWorkspaceBatch(ctx, projectID, projectFileID, specs)
}

func (s *Workspace) Copy(ctx context.Context, projectID string, workspaceID string, newName string) (*model.Workspace, error) {
	return api.CopyWorkspace(ctx, projectID, workspaceID, newName)
}

func (s *Workspace) Update(ctx context.Context, projectID string, workspaceID string, name string, note string, blenderInstallID uint, scene, camera, engine string, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY int, outputFormat string, autoLock bool, autoLockMinSize int64, autoLockKeep int) (*model.WorkspaceDetail, error) {
	return api.UpdateWorkspace(ctx, projectID, workspaceID, name, note, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY, outputFormat, autoLock, autoLockMinSize, autoLockKeep)
}

func (s *Workspace) Delete(ctx context.Context, projectID, workspaceID string, force bool) error {
	return api.DeleteWorkspace(ctx, projectID, workspaceID, force)
}

// GetThumbnail はウィンドウには base64 のデータ URI、ブラウザには URL で返す（Project.GetFileThumbnail と同じ）。
func (s *Workspace) GetThumbnail(ctx context.Context, projectID string, fileID string, workspaceID string) (string, error) {
	if api.FromBrowser(ctx) {
		return api.GetWorkspaceThumbnailURL(ctx, projectID, fileID, workspaceID)
	}
	return api.GetWorkspaceThumbnail(projectID, fileID, workspaceID)
}

func (s *Workspace) SetThumbnail(ctx context.Context, projectID string, fileID string, workspaceID string, imagePath string) (string, error) {
	return api.SetWorkspaceThumbnail(ctx, projectID, fileID, workspaceID, imagePath)
}

// CreateMovie は ffmpeg による動画作成を goroutine で開始し即返す。
// ffmpeg プロセス完了後（成功・失敗とも）に api.MovieCreatedHook 経由で通知する。
// 入力拡張子はジョブの OutputExt から自動取得するため、呼び出し元での指定は不要。
func (s *Workspace) CreateMovie(ctx context.Context, projectID string, fileID string, workspaceID string, jobID string, fps int, outext string, extraArgs string) {
	// Wails は呼び出しが返ると ctx を取り消す。利用者の値は残したまま、取り消しだけを外して使う
	ctx = context.WithoutCancel(ctx)
	go func() {
		path, ch, err := api.CreateMovie(ctx, projectID, fileID, workspaceID, jobID, fps, outext, extraArgs)
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
