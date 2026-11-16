package api

import (
	"context"
	"os"

	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

func ListJobsPaged(ctx context.Context, filter *model.JobFilter, page, pageSize int) (*model.JobListResult, error) {
	result, err := model.ListJobsPaged(filter, page, pageSize)
	if err != nil {
		return nil, err
	}
	if fullAccess(ctx) {
		for _, j := range result.Jobs {
			j.HasFileAccess = true
		}
	} else {
		userID := currentUser(ctx)
		cache := map[string]bool{}
		for _, j := range result.Jobs {
			if j.ProjectFileID == "" {
				j.HasFileAccess = true
				continue
			}
			if v, ok := cache[j.ProjectFileID]; ok {
				j.HasFileAccess = v
				continue
			}
			ok, err := model.HasFileAccess(j.ProjectFileID, userID)
			if err == nil {
				j.HasFileAccess = ok
			}
			cache[j.ProjectFileID] = j.HasFileAccess
		}
	}
	return result, nil
}

func UpdateJobMeta(ctx context.Context, id, name, note string) error {
	// runner 以上の権限が必要
	if !fullAccess(ctx) {
		j, err := model.GetJob(id)
		if err != nil {
			return xerrors.Errorf("UpdateJobMeta GetJob: %w", err)
		}
		if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
			return err
		}
	}
	return model.UpdateJobMeta(id, name, note)
}

func DeleteJob(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJob GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 1 {
		return xerrors.New("ロック中のジョブは削除できません")
	}
	if j.OutputDir != "" {
		if _, statErr := os.Stat(j.OutputDir); statErr == nil {
			if rmErr := os.RemoveAll(j.OutputDir); rmErr != nil {
				log.Errorf("DeleteJob RemoveAll: %v", rmErr)
			}
		}
	}
	return model.DeleteJob(id)
}

// BulkDeleteJobsByWorkspace はワークスペースのジョブ履歴を一括削除する。
// errorOnly=true のとき: ロックされていないエラージョブをすべて物理削除する（keepCount/dataOnly は無視）。
// errorOnly=false のとき: ロックされていないジョブのうち最新 keepCount 件を残し残りを削除する。
// dataOnly=true の場合は出力データのみ削除してジョブ履歴を残す（DataStatus を削除済みに更新）。
// ロック済みジョブは常に保持される。削除件数を返す。
func BulkDeleteJobsByWorkspace(ctx context.Context, projectID, workspaceID string, keepCount int, dataOnly bool, errorOnly bool) (int, error) {
	// runner 以上の権限が必要（ワークスペースのファイルで判定）
	if !fullAccess(ctx) {
		if w, wErr := model.SelectWorkspace(projectID, workspaceID); wErr == nil && w != nil {
			if err := requireFileRole(ctx, w.ProjectFileID, rolesRunnerUp...); err != nil {
				return 0, err
			}
		}
	}
	jobs, err := model.ListJobsByWorkspace(projectID, workspaceID)
	if err != nil {
		return 0, xerrors.Errorf("BulkDeleteJobsByWorkspace: %w", err)
	}

	var toDelete []*model.Job
	if errorOnly {
		for _, j := range jobs {
			if j.DataStatus%2 == 0 && j.Status == model.JobError {
				toDelete = append(toDelete, j)
			}
		}
	} else {
		if keepCount < 0 {
			keepCount = 0
		}
		// jobs は enqueued_at DESC 順（最新が先頭）
		var nonLocked []*model.Job
		for _, j := range jobs {
			if j.DataStatus%2 == 0 {
				nonLocked = append(nonLocked, j)
			}
		}
		if keepCount < len(nonLocked) {
			toDelete = nonLocked[keepCount:]
		}
	}

	deleted := 0
	for _, j := range toDelete {
		var opErr error
		if dataOnly {
			opErr = DeleteJobData(ctx, j.ID)
		} else {
			opErr = DeleteJob(ctx, j.ID)
		}
		if opErr != nil {
			log.Errorf("BulkDeleteJobsByWorkspace: %v", opErr)
			continue
		}
		deleted++
	}
	return deleted, nil
}

func DeleteJobData(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJobData GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 1 {
		return xerrors.New("ロック中のジョブのデータは削除できません")
	}
	if j.OutputDir != "" {
		if _, statErr := os.Stat(j.OutputDir); statErr == nil {
			if rmErr := os.RemoveAll(j.OutputDir); rmErr != nil {
				return xerrors.Errorf("DeleteJobData RemoveAll: %w", rmErr)
			}
		}
	}
	return model.UpdateJobDataStatus(id, model.JobDataDeleted)
}

func LockJob(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("LockJob GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 1 {
		return nil // すでにロック済み
	}
	return model.UpdateJobDataStatus(id, j.DataStatus+1)
}

func UnlockJob(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("UnlockJob GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 0 {
		return nil // ロックされていない
	}
	return model.UpdateJobDataStatus(id, j.DataStatus-1)
}

func GetJob(ctx context.Context, id string) (*model.Job, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return nil, err
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return nil, err
	}
	return j, nil
}

// workspaceFileAccess はワークスペースのファイルに対する参照権限を確認する。
func workspaceFileAccess(ctx context.Context, projectID, workspaceID string) error {
	if fullAccess(ctx) {
		return nil
	}
	w, err := model.SelectWorkspace(projectID, workspaceID)
	if err != nil || w == nil {
		return xerrors.Errorf("workspace not found: %w", err)
	}
	return requireFileAccess(ctx, w.ProjectFileID)
}

func ListJobsByWorkspace(ctx context.Context, projectID string, workspaceID string) ([]*model.Job, error) {
	if err := workspaceFileAccess(ctx, projectID, workspaceID); err != nil {
		return nil, err
	}
	return model.ListJobsByWorkspace(projectID, workspaceID)
}

func ListJobsByWorkspacePaged(ctx context.Context, projectID, workspaceID string, page, pageSize int) (*model.JobPagedResult, error) {
	if err := workspaceFileAccess(ctx, projectID, workspaceID); err != nil {
		return nil, err
	}
	return model.ListJobsByWorkspacePaged(projectID, workspaceID, page, pageSize)
}

func ListJobsByProjectFile(ctx context.Context, projectID string, projectFileID string) ([]*model.Job, error) {
	if err := requireFileAccess(ctx, projectFileID); err != nil {
		return nil, err
	}
	return model.ListJobsByProjectFile(projectID, projectFileID)
}

func ListJobsByProjectFilePaged(ctx context.Context, projectID, projectFileID string, page, pageSize int) (*model.JobPagedResult, error) {
	if err := requireFileAccess(ctx, projectFileID); err != nil {
		return nil, err
	}
	return model.ListJobsByProjectFilePaged(projectID, projectFileID, page, pageSize)
}
