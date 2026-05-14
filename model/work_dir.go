package model

import (
	"errors"
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

// UpdateJobOutputDirPrefix は移行時に Job.OutputDir の prefix を一括置換する。
func UpdateJobOutputDirPrefix(projectID, oldBase, newBase string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var jobs []*Job
		if err := tx.Where("project_id = ?", projectID).Find(&jobs).Error; err != nil {
			return xerrors.Errorf("UpdateJobOutputDirPrefix find: %w", err)
		}
		for _, j := range jobs {
			if !strings.HasPrefix(j.OutputDir, oldBase) {
				continue
			}
			newOutputDir := newBase + j.OutputDir[len(oldBase):]
			if err := tx.Model(j).Update("output_dir", newOutputDir).Error; err != nil {
				return xerrors.Errorf("UpdateJobOutputDirPrefix update %s: %w", j.ID, err)
			}
		}
		return nil
	})
}
