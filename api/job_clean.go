package api

import (
	"context"

	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

// GetCleanableJobStats はフィルタ条件に合致するクリーンアップ対象のジョブ統計を返す。
// GetCleanableJobStats はクリーンアップ対象のジョブの集計を返す。プロジェクト横断なので admin 限定（CleanJobData と同じ）。
func GetCleanableJobStats(ctx context.Context, filter *model.CleanFilter) (*model.CleanableJobStats, error) {
	if err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	return model.GetCleanableJobStats(filter)
}

// CleanJobData はフィルタ条件に合致するジョブの出力データを削除する（履歴は残す）。
// プロジェクト横断のクリーンアップのため admin 権限を要求する。削除件数を返す。
func CleanJobData(ctx context.Context, filter *model.CleanFilter) (int, error) {
	if err := requireAdmin(ctx); err != nil {
		return 0, err
	}
	jobs, err := model.ListCleanableJobs(filter)
	if err != nil {
		return 0, xerrors.Errorf("CleanJobData: %w", err)
	}
	deleted := 0
	for _, j := range jobs {
		if err := DeleteJobData(ctx, j.ID); err != nil {
			log.Errorf("CleanJobData: %v", err)
			continue
		}
		deleted++
	}
	return deleted, nil
}

// MeasureFilteredDiskSize はフィルタ条件に合致するジョブの OutputDir を実測して合計バイト数を返す。
// プロジェクト横断なので admin 限定（CleanJobData と同じ）。
func MeasureFilteredDiskSize(ctx context.Context, filter *model.CleanFilter) (int64, error) {
	if err := requireAdmin(ctx); err != nil {
		return 0, err
	}
	jobs, err := model.ListCleanableJobs(filter)
	if err != nil {
		return 0, xerrors.Errorf("MeasureFilteredDiskSize: %w", err)
	}
	var total int64
	for _, j := range jobs {
		if j.OutputDir == "" {
			continue
		}
		total += dirSize(j.OutputDir)
	}
	return total, nil
}
