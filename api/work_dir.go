package api

import (
	"io"
	"os"
	"path/filepath"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

// MigrationHook はプロジェクト移行の進捗・完了時に呼ばれるフック。
// 呼び出し元（Wails サービス層など）で設定する。
var MigrationHook func(projectID string, status string, pct float64)

// GetProjectBaseDir はプロジェクトの作業ディレクトリ基底パスを返す。
func GetProjectBaseDir(projectID string) (string, error) {
	p, err := model.SelectProject(projectID)
	if err != nil {
		return "", xerrors.Errorf("GetProjectBaseDir SelectProject: %w", err)
	}
	if p == nil {
		return "", xerrors.Errorf("GetProjectBaseDir: project not found: %s", projectID)
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

func CreateWorkDir(path string, priority int) (*model.WorkDir, error) {
	if path == "" {
		return nil, xerrors.New("作業ディレクトリのパスが必要です")
	}
	wd := &model.WorkDir{
		Path:     path,
		Priority: priority,
		Status:   model.WorkDirStatusActive,
	}
	if err := model.CreateWorkDir(wd); err != nil {
		return nil, err
	}
	return wd, nil
}

func UpdateWorkDir(id uint, path string, priority int, status string) (*model.WorkDir, error) {
	wd, err := model.GetWorkDir(id)
	if err != nil || wd == nil {
		return nil, xerrors.Errorf("UpdateWorkDir: not found: %w", err)
	}
	wd.Path = path
	wd.Priority = priority
	wd.Status = status
	if err := model.UpdateWorkDir(wd); err != nil {
		return nil, err
	}
	return wd, nil
}

func DeleteWorkDir(id uint) error {
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
func CheckWorkDir(path string) (map[string]interface{}, error) {
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

// StartMigrateProjectWorkDir はプロジェクトを別の作業ディレクトリへ非同期で移行する。
func StartMigrateProjectWorkDir(projectID string, newWorkDirID uint) error {
	oldBase, err := GetProjectBaseDir(projectID)
	if err != nil {
		return xerrors.Errorf("StartMigrateProjectWorkDir: %w", err)
	}
	newWd, err := model.GetWorkDir(newWorkDirID)
	if err != nil || newWd == nil {
		return xerrors.Errorf("StartMigrateProjectWorkDir: new work_dir not found")
	}
	newBase := newWd.Path

	go func() {
		notify := func(pct float64) {
			if MigrationHook != nil {
				MigrationHook(projectID, "running", pct)
			}
		}

		if err := migrateProjectFiles(oldBase, newBase, projectID, notify); err != nil {
			if MigrationHook != nil {
				MigrationHook(projectID, "error", 0)
			}
			return
		}

		if err := model.UpdateProjectWorkDir(projectID, newWorkDirID); err != nil {
			if MigrationHook != nil {
				MigrationHook(projectID, "error", 0)
			}
			return
		}

		if err := model.UpdateJobOutputDirPrefix(projectID, oldBase, newBase); err != nil {
			if MigrationHook != nil {
				MigrationHook(projectID, "error", 0)
			}
			return
		}

		os.RemoveAll(filepath.Join(oldBase, projectID))

		if MigrationHook != nil {
			MigrationHook(projectID, "done", 1.0)
		}
	}()
	return nil
}

func migrateProjectFiles(oldBase, newBase, projectID string, progress func(float64)) error {
	src := filepath.Join(oldBase, projectID)
	dst := filepath.Join(newBase, projectID)

	// 総ファイル数をカウント（進捗計算用）
	total := countFiles(src)
	if total == 0 {
		total = 1
	}
	done := 0

	return filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, path)
		target := filepath.Join(dst, rel)

		if d.IsDir() {
			return os.MkdirAll(target, 0755)
		}

		if err := copyFile(path, target); err != nil {
			return err
		}
		done++
		progress(float64(done) / float64(total))
		return nil
	})
}

func countFiles(dir string) int {
	count := 0
	filepath.WalkDir(dir, func(_ string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			count++
		}
		return nil
	})
	return count
}

func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
