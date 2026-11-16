package model

import (
	"errors"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

const (
	WorkDirStatusActive   = "active"
	WorkDirStatusInactive = "inactive"
	WorkDirStatusLock     = "lock"
)

type WorkDir struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Path     string `json:"path"`
	Priority int    `json:"priority"`
	Status   string `json:"status" gorm:"default:'active'"`
	MetaFields
}

func ListWorkDirs() ([]*WorkDir, error) {
	var dirs []*WorkDir
	if res := db.Order("priority asc, created_at asc").Find(&dirs); res.Error != nil {
		return nil, xerrors.Errorf("ListWorkDirs: %w", res.Error)
	}
	return dirs, nil
}

func GetWorkDir(id uint) (*WorkDir, error) {
	var wd WorkDir
	res := db.First(&wd, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetWorkDir: %w", res.Error)
	}
	return &wd, nil
}

// GetDefaultWorkDir は Status=active のうち Priority 最小の作業ディレクトリを返す。
func GetDefaultWorkDir() (*WorkDir, error) {
	var wd WorkDir
	res := db.Where("status = ?", WorkDirStatusActive).Order("priority asc, created_at asc").First(&wd)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetDefaultWorkDir: %w", res.Error)
	}
	return &wd, nil
}

func CreateWorkDir(wd *WorkDir) error {
	if res := db.Create(wd); res.Error != nil {
		return xerrors.Errorf("CreateWorkDir: %w", res.Error)
	}
	return nil
}

func UpdateWorkDir(wd *WorkDir) error {
	if res := db.Save(wd); res.Error != nil {
		return xerrors.Errorf("UpdateWorkDir: %w", res.Error)
	}
	return nil
}

func ReorderWorkDirs(ids []uint) error {
	for i, id := range ids {
		if res := db.Model(&WorkDir{}).Where("id = ?", id).Update("priority", i); res.Error != nil {
			return xerrors.Errorf("ReorderWorkDirs: %w", res.Error)
		}
	}
	return nil
}

func DeleteWorkDir(id uint) error {
	if res := db.Delete(&WorkDir{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteWorkDir: %w", res.Error)
	}
	return nil
}

// CountProjectsByWorkDir は指定 work_dir を使用しているプロジェクト数を返す。
func CountProjectsByWorkDir(workDirID uint) (int64, error) {
	var count int64
	if res := db.Model(&Project{}).Where("work_dir_id = ?", workDirID).Count(&count); res.Error != nil {
		return 0, xerrors.Errorf("CountProjectsByWorkDir: %w", res.Error)
	}
	return count, nil
}

// MoveProjectWorkDir はプロジェクトの作業ディレクトリを workDirID に替え、
// ジョブの出力先を oldBase から newBase の下へ書き換える。1つのトランザクションで行う。
func MoveProjectWorkDir(projectID string, workDirID uint, oldBase, newBase string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Project{}).Where("id = ?", projectID).Update("work_dir_id", workDirID).Error; err != nil {
			return xerrors.Errorf("MoveProjectWorkDir project: %w", err)
		}
		return rebaseJobOutputDirs(tx, projectID, oldBase, newBase)
	})
}

// ChangeWorkDirPath は作業ディレクトリのパスを newPath に替え、projectIDs のジョブの出力先を
// 旧パスから newPath の下へ書き換える。1つのトランザクションで行う。
func ChangeWorkDirPath(id uint, oldPath, newPath string, projectIDs []string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&WorkDir{}).Where("id = ?", id).Update("path", newPath).Error; err != nil {
			return xerrors.Errorf("ChangeWorkDirPath work_dir: %w", err)
		}
		for _, pid := range projectIDs {
			if err := rebaseJobOutputDirs(tx, pid, oldPath, newPath); err != nil {
				return err
			}
		}
		return nil
	})
}

// rebaseJobOutputDirs はプロジェクトのジョブの出力先のうち、oldBase の下にあるものを newBase の下へ書き換える。
func rebaseJobOutputDirs(tx *gorm.DB, projectID, oldBase, newBase string) error {
	var jobs []*Job
	if err := tx.Where("project_id = ?", projectID).Find(&jobs).Error; err != nil {
		return xerrors.Errorf("rebaseJobOutputDirs find: %w", err)
	}
	for _, j := range jobs {
		newOutputDir, ok := RebasePath(j.OutputDir, oldBase, newBase)
		if !ok {
			continue
		}
		if err := tx.Model(j).Update("output_dir", newOutputDir).Error; err != nil {
			return xerrors.Errorf("rebaseJobOutputDirs update %s: %w", j.ID, err)
		}
	}
	return nil
}

// RebasePath は oldBase の下にある p を、newBase の下の同じ位置のパスにする。p が oldBase の下に無ければ ok は false。
// 文字列の頭の一致では見ない（"D:/work" が "D:/work2/..." に当たらないように。区切りの / と \ の違いも吸収する）。
func RebasePath(p, oldBase, newBase string) (string, bool) {
	if p == "" || oldBase == "" {
		return "", false
	}
	if !PathWithin(p, oldBase) {
		return "", false
	}
	rel, err := filepath.Rel(filepath.Clean(oldBase), filepath.Clean(p))
	if err != nil {
		return "", false
	}
	return filepath.Join(newBase, rel), true
}

// PathWithin は p が dir そのものか、dir の下にあるかを返す（Windows では大文字小文字を区別しない）。
func PathWithin(p, dir string) bool {
	rel, err := filepath.Rel(filepath.Clean(dir), filepath.Clean(p))
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
}
