package api

import (
	"context"
	"os"
	"path/filepath"

	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

// MigrationHook はプロジェクト移行の進捗・完了時に呼ばれるフック。
// 呼び出し元（Wails サービス層など）で設定する。status が "error" のとき errMsg に失敗の理由が入る。
var MigrationHook func(projectID string, status string, pct float64, errMsg string)

// WorkDirChangeDirHook は作業ディレクトリのパス変更進捗・完了時に呼ばれるフック。
// status が "error" のとき errMsg に失敗の理由が入る。
var WorkDirChangeDirHook func(workDirID uint, status string, pct float64, errMsg string)

// GetProjectBaseDir はプロジェクトの作業ディレクトリ基底パスを返す。
// WorkDirID が未設定（0）の場合はデフォルト作業ディレクトリを自動割り当てする。
func GetProjectBaseDir(projectID string) (string, error) {
	p, err := model.SelectProject(projectID)
	if err != nil {
		return "", xerrors.Errorf("GetProjectBaseDir SelectProject: %w", err)
	}
	if p == nil {
		return "", xerrors.Errorf("GetProjectBaseDir: project not found: %s", projectID)
	}
	if p.WorkDirID == 0 {
		wd, err := model.GetDefaultWorkDir()
		if err != nil {
			return "", xerrors.Errorf("GetProjectBaseDir GetDefaultWorkDir: %w", err)
		}
		if wd == nil {
			return "", xerrors.New("作業ディレクトリが設定されていません（システム設定で追加してください）")
		}
		// 既定の作業ディレクトリを割り当てるのはシステムの判断（呼び出しの ctx を持たない関数なので）
		if err := model.UpdateProjectWorkDir(SystemContext(), projectID, wd.ID); err != nil {
			return "", xerrors.Errorf("GetProjectBaseDir UpdateProjectWorkDir: %w", err)
		}
		return wd.Path, nil
	}
	wd, err := model.GetWorkDir(p.WorkDirID)
	if err != nil {
		return "", xerrors.Errorf("GetProjectBaseDir GetWorkDir: %w", err)
	}
	if wd == nil {
		return "", xerrors.New("作業ディレクトリが設定されていません（プロジェクト設定で設定してください）")
	}
	return wd.Path, nil
}

// AssignDefaultWorkDir は新規プロジェクトに最高優先度の active work_dir を割り当てる。
func AssignDefaultWorkDir(p *model.Project) error {
	wd, err := model.GetDefaultWorkDir()
	if err != nil {
		return xerrors.Errorf("AssignDefaultWorkDir: %w", err)
	}
	if wd == nil {
		return xerrors.New("有効な作業ディレクトリがありません。システム設定で追加してください")
	}
	p.WorkDirID = wd.ID
	return nil
}

func ListWorkDirs() ([]*model.WorkDir, error) {
	return model.ListWorkDirs()
}

func CreateWorkDir(ctx context.Context, path string, priority int) (*model.WorkDir, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	if path == "" {
		return nil, xerrors.New("作業ディレクトリのパスが必要です")
	}
	wd := &model.WorkDir{
		Path:     path,
		Priority: priority,
		Status:   model.WorkDirStatusActive,
	}
	if err := model.CreateWorkDir(ctx, wd); err != nil {
		return nil, err
	}
	return wd, nil
}

func UpdateWorkDir(ctx context.Context, id uint, path string, priority int, status string) (*model.WorkDir, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	wd, err := model.GetWorkDir(id)
	if err != nil || wd == nil {
		return nil, xerrors.Errorf("UpdateWorkDir: not found: %w", err)
	}
	wd.Path = path
	wd.Priority = priority
	wd.Status = status
	if err := model.UpdateWorkDir(ctx, wd); err != nil {
		return nil, err
	}
	// lock を外したら、止めていた待ちのジョブを起動する
	schedule()
	notifyQueueChanged()
	return wd, nil
}

func ReorderWorkDirs(ctx context.Context, ids []uint) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	return model.ReorderWorkDirs(ctx, ids)
}

func DeleteWorkDir(ctx context.Context, id uint) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	count, err := model.CountProjectsByWorkDir(id)
	if err != nil {
		return xerrors.Errorf("DeleteWorkDir: %w", err)
	}
	if count > 0 {
		return xerrors.Errorf("この作業ディレクトリは %d 件のプロジェクトで使用中のため削除できません", count)
	}
	return model.DeleteWorkDir(id)
}

// CheckWorkDir はパスの存在確認と空き容量を返す。
func CheckWorkDir(ctx context.Context, path string) (map[string]interface{}, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	info, err := os.Stat(path)
	exists := err == nil && info.IsDir()

	result := map[string]interface{}{
		"exists": exists,
		"free":   uint64(0),
		"total":  uint64(0),
	}

	if exists {
		free, total, err := diskFreeBytes(path)
		if err == nil {
			result["free"] = free
			result["total"] = total
		}
	}
	return result, nil
}

// GetWorkDirStats は指定 work_dir のプロジェクト数とデータサイズを返す。admin 限定（作業ディレクトリの設定）。
func GetWorkDirStats(ctx context.Context, id uint) (map[string]interface{}, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	wd, err := model.GetWorkDir(id)
	if err != nil || wd == nil {
		return nil, xerrors.New("work dir not found")
	}
	count, err := model.CountProjectsByWorkDir(id)
	if err != nil {
		return nil, xerrors.Errorf("GetWorkDirStats: %w", err)
	}
	var dataSize int64
	filepath.WalkDir(wd.Path, func(_ string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			if info, e := d.Info(); e == nil {
				dataSize += info.Size()
			}
		}
		return nil
	})
	return map[string]interface{}{
		"project_count": count,
		"data_size":     dataSize,
	}, nil
}

// GetProjectDiskSize はプロジェクトのデータサイズ（作業ディレクトリ内の {projectID}/ 以下）をバイトで返す。
func GetProjectDiskSize(ctx context.Context, projectID string) (int64, error) {
	if err := requireProjectAccess(ctx, projectID); err != nil {
		return 0, err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return 0, xerrors.Errorf("GetProjectDiskSize: %w", err)
	}
	return dirSize(filepath.Join(baseDir, projectID)), nil
}
