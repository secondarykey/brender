package api

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

func ListWorkspacesByProject(ctx context.Context, projectID string, sort, dir string) ([]*model.WorkspacesByFile, error) {
	if fullAccess(ctx) {
		return model.ListWorkspacesByProject(projectID, sort, dir)
	}
	return model.ListWorkspacesByProjectForUser(projectID, currentUser(ctx), sort, dir)
}

func GetWorkspace(ctx context.Context, projectID string, workspaceID string) (*model.WorkspaceDetail, error) {
	if !fullAccess(ctx) {
		// ワークスペースのファイルIDを取得して権限チェック
		detail, err := model.GetWorkspace(projectID, workspaceID)
		if err != nil {
			return nil, err
		}
		if detail != nil && detail.Workspace != nil && detail.Workspace.ProjectFileID != "" {
			if err := requireFileAccess(ctx, detail.Workspace.ProjectFileID); err != nil {
				return nil, err
			}
		}
		return detail, nil
	}
	return model.GetWorkspace(projectID, workspaceID)
}

func CreateWorkspace(ctx context.Context, projectID string, projectFileID string, name string) (*model.Workspace, error) {
	if name == "" {
		return nil, xerrors.New("workspace name is required")
	}
	// workspace_creator 以上の権限が必要
	if err := requireFileRole(ctx, projectFileID, rolesWorkspaceCreatorUp...); err != nil {
		return nil, err
	}
	ws, err := model.CreateWorkspace(projectID, projectFileID, name, false)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateWorkspaceProcessedAt(ws.ID, &now); err != nil {
		log.Errorf("CreateWorkspace: UpdateWorkspaceProcessedAt: %v", err)
	}
	if err := model.UpdateProjectFileProcessedAt(projectFileID, &now); err != nil {
		log.Errorf("CreateWorkspace: UpdateProjectFileProcessedAt: %v", err)
	}
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		log.Errorf("CreateWorkspace: UpdateProjectProcessedAt: %v", err)
	}
	return ws, nil
}

type WorkspaceBatchSpec struct {
	Name   string
	Scene  string
	Camera string
	Engine string
}

func CreateWorkspaceBatch(ctx context.Context, projectID, projectFileID string, specs []WorkspaceBatchSpec) ([]*model.Workspace, error) {
	if len(specs) == 0 {
		return nil, xerrors.New("no workspace specs provided")
	}
	// workspace_creator 以上の権限が必要
	if err := requireFileRole(ctx, projectFileID, rolesWorkspaceCreatorUp...); err != nil {
		return nil, err
	}
	var results []*model.Workspace
	now := time.Now()
	for _, spec := range specs {
		ws, err := model.CreateWorkspaceWithSettings(projectID, projectFileID, spec.Name, spec.Scene, spec.Camera, spec.Engine)
		if err != nil {
			return results, err
		}
		if err := model.UpdateWorkspaceProcessedAt(ws.ID, &now); err != nil {
			log.Errorf("CreateWorkspaceBatch: UpdateWorkspaceProcessedAt: %v", err)
		}
		results = append(results, ws)
	}
	if err := model.UpdateProjectFileProcessedAt(projectFileID, &now); err != nil {
		log.Errorf("CreateWorkspaceBatch: UpdateProjectFileProcessedAt: %v", err)
	}
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		log.Errorf("CreateWorkspaceBatch: UpdateProjectProcessedAt: %v", err)
	}
	return results, nil
}

func CopyWorkspace(ctx context.Context, projectID, workspaceID, newName string) (*model.Workspace, error) {
	detail, err := model.GetWorkspace(projectID, workspaceID)
	if err != nil {
		return nil, xerrors.Errorf("CopyWorkspace GetWorkspace: %w", err)
	}
	if detail == nil {
		return nil, xerrors.New("workspace not found")
	}
	// workspace_creator 以上の権限が必要
	if err := requireFileRole(ctx, detail.Workspace.ProjectFileID, rolesWorkspaceCreatorUp...); err != nil {
		return nil, err
	}
	src := detail.Workspace
	newWS, err := model.CreateWorkspace(projectID, src.ProjectFileID, newName, false)
	if err != nil {
		return nil, err
	}
	if _, err := model.UpdateWorkspace(projectID, newWS.ID, newName, src.Note, src.BlenderInstallID,
		src.Scene, src.Camera, src.Engine,
		src.StartFrame, src.EndFrame, src.FrameStep,
		src.Thread, src.Samples, src.ResolutionX, src.ResolutionY, src.OutputFormat,
		src.AutoLock, src.AutoLockMinSize, src.AutoLockKeep); err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateWorkspaceProcessedAt(newWS.ID, &now); err != nil {
		log.Errorf("CopyWorkspace: UpdateWorkspaceProcessedAt: %v", err)
	}
	if err := model.UpdateProjectFileProcessedAt(src.ProjectFileID, &now); err != nil {
		log.Errorf("CopyWorkspace: UpdateProjectFileProcessedAt: %v", err)
	}
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		log.Errorf("CopyWorkspace: UpdateProjectProcessedAt: %v", err)
	}
	return newWS, nil
}

func UpdateWorkspace(ctx context.Context, projectID string, workspaceID string, name string, note string, blenderInstallID uint, scene, camera, engine string, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY int, outputFormat string, autoLock bool, autoLockMinSize int64, autoLockKeep int) (*model.WorkspaceDetail, error) {
	if name == "" {
		return nil, xerrors.New("workspace name is required")
	}
	// editor 以上の権限が必要（workspace_creator も含む）
	if !fullAccess(ctx) {
		detail, err := model.GetWorkspace(projectID, workspaceID)
		if err != nil {
			return nil, xerrors.Errorf("UpdateWorkspace: %w", err)
		}
		if detail != nil && detail.Workspace != nil {
			if err := requireFileRole(ctx, detail.Workspace.ProjectFileID, rolesEditorUp...); err != nil {
				return nil, err
			}
		}
	}
	return model.UpdateWorkspace(projectID, workspaceID, name, note, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY, outputFormat, autoLock, autoLockMinSize, autoLockKeep)
}

func DeleteWorkspace(ctx context.Context, projectID, workspaceID string, force bool) error {
	// workspace_creator 以上の権限が必要
	if !fullAccess(ctx) {
		detail, err := model.GetWorkspace(projectID, workspaceID)
		if err != nil {
			return xerrors.Errorf("DeleteWorkspace: %w", err)
		}
		if detail != nil && detail.Workspace != nil {
			if err := requireFileRole(ctx, detail.Workspace.ProjectFileID, rolesWorkspaceCreatorUp...); err != nil {
				return err
			}
		}
	}
	if !force {
		locked, err := model.HasLockedJobsByWorkspace(workspaceID)
		if err != nil {
			return xerrors.Errorf("DeleteWorkspace: %w", err)
		}
		if locked {
			return xerrors.New("locked_jobs_exist")
		}
	}
	dirs, _ := model.ListOutputDirsByWorkspace(workspaceID)
	removeOutputDirs(dirs)
	// ジョブディレクトリを削除後、空になった {workspaceID}/ ディレクトリ自体も削除する
	if len(dirs) > 0 {
		wsDir := filepath.Dir(dirs[0])
		if err := os.RemoveAll(wsDir); err != nil {
			log.Errorf("DeleteWorkspace: remove workspace dir: %v", err)
		}
	}
	if err := model.DeleteJobsByWorkspace(workspaceID); err != nil {
		return xerrors.Errorf("DeleteWorkspace jobs: %w", err)
	}
	return model.DeleteWorkspace(projectID, workspaceID)
}
