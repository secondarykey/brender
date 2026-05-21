package model

import (
	"errors"
	"time"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

const (
	JobCompleted   = "completed"
	JobError       = "error"
	JobCancelled   = "cancelled"
	JobInterrupted = "interrupted"
)

const (
	JobTypeRender            = "render"              // 通常レンダリング
	JobTypeTest              = "test"                // テストレンダリング
	JobTypeSamplesComparison = "samples_comparison"  // サンプル比較
)

const (
	JobDataNone             = 0 // データなし
	JobDataNoneLocked       = 1 // データなし（ロック）
	JobDataAvailable        = 2 // データあり
	JobDataAvailableLocked  = 3 // データあり（ロック）
	JobDataDeleted          = 4 // データ削除
	JobDataDeletedLocked    = 5 // データ削除（ロック）
	JobDataCorrupted        = 6 // データ破損（エラー・キャンセル時の不完全出力）
	JobDataCorruptedLocked  = 7 // データ破損（ロック）
	JobDataModified         = 8 // データ操作済（一部削除など）
	JobDataModifiedLocked   = 9 // データ操作済（ロック）
)

// Job はレンダリング実行の完了済み履歴レコード。
// Queue と同じ UUID v7 の ID を持つ。
type Job struct {
	ID            string     `gorm:"primaryKey" json:"id"` // UUID v7, Queue と共通
	Name          string     `json:"name"`
	Note          string     `json:"note"`
	ProjectID     string     `json:"project_id"`
	WorkspaceID   string     `json:"workspace_id"`
	ProjectFileID string     `json:"project_file_id"`
	FileName      string     `gorm:"<-:false;-:migration" json:"file_name"` // project_files.name から JOIN で取得（カラム非作成・書き込み不可）
	BlenderPath   string     `json:"blender_path"`
	BlenderFile   string     `json:"blender_file"`
	OutputDir     string     `json:"output_dir"`
	Scene         string     `json:"scene"`
	Engine        string     `json:"engine"`
	StartFrame    int        `json:"start_frame"`
	EndFrame      int        `json:"end_frame"`
	FrameStep     int        `json:"frame_step"`
	Thread        int        `json:"thread"`
	Camera        string     `json:"camera"`
	Samples       int        `json:"samples"`      // 0 = Blender デフォルト
	ResolutionX   int        `json:"resolution_x"` // 0 = Blender デフォルト
	ResolutionY   int        `json:"resolution_y"` // 0 = Blender デフォルト
	OutputExt     string     `json:"output_ext"`     // レンダリング出力拡張子（"png" / "jpg"）
	BlenderFormat string     `json:"blender_format"` // Blender -F 引数に渡した値（"PNG" / "JPEG" / "OPEN_EXR" など）
	Status        string     `json:"status"`      // completed / error / cancelled
	ErrorMsg      string     `json:"error_msg"`
	DataStatus    int        `json:"data_status"` // 0=なし 1=なしロック 2=あり 3=ありロック 4=削除 5=削除ロック
	JobType       string     `json:"job_type"`      // "" = 通常, "samples_comparison"
	SamplesList   string     `json:"samples_list"`  // カンマ区切りサンプル数
	DiskSize      int64      `json:"disk_size"`     // 出力フォルダの容量（バイト）
	StartedAt     *time.Time `json:"started_at"`
	CompletedAt   *time.Time `json:"completed_at"`
	EnqueuedAt    *time.Time `json:"enqueued_at"` // キュー登録時刻
}

func CreateJob(j *Job) error {
	// DataStatus は int なのでゼロ値 0 = JobDataNone がデフォルト
	if res := db.Create(j); res.Error != nil {
		return xerrors.Errorf("CreateJob: %w", res.Error)
	}
	return nil
}

func UpdateJobMeta(id, name, note string) error {
	if res := db.Model(&Job{}).Where("id = ?", id).Updates(map[string]interface{}{
		"name": name,
		"note": note,
	}); res.Error != nil {
		return xerrors.Errorf("UpdateJobMeta: %w", res.Error)
	}
	return nil
}

func GetJob(id string) (*Job, error) {
	var j Job
	res := db.Select("jobs.*, project_files.name AS file_name").
		Joins("LEFT JOIN project_files ON project_files.id = jobs.project_file_id").
		First(&j, "jobs.id = ?", id)
	if res.Error != nil {
		return nil, xerrors.Errorf("GetJob: %w", res.Error)
	}
	return &j, nil
}

func ListJobs() ([]*Job, error) {
	var list []*Job
	res := db.Select("jobs.*, project_files.name AS file_name").
		Joins("LEFT JOIN project_files ON project_files.id = jobs.project_file_id").
		Order("jobs.enqueued_at desc").Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListJobs: %w", res.Error)
	}
	return list, nil
}

type JobFilter struct {
	DataStatuses []int  `json:"data_statuses"`
	Days         int    `json:"days"`
	SortBy       string `json:"sort_by"`
}

type JobListResult struct {
	Jobs      []*Job `json:"jobs"`
	Total     int64  `json:"total"`
	TotalSize int64  `json:"total_size"`
}

func applyJobFilter(filter *JobFilter) func(*gorm.DB) *gorm.DB {
	return func(tx *gorm.DB) *gorm.DB {
		if filter != nil && len(filter.DataStatuses) > 0 {
			tx = tx.Where("jobs.data_status IN ?", filter.DataStatuses)
		}
		if filter != nil && filter.Days > 0 {
			cutoff := time.Now().AddDate(0, 0, -filter.Days)
			tx = tx.Where("jobs.completed_at <= ?", cutoff)
		}
		return tx
	}
}

func jobSortOrder(filter *JobFilter) string {
	if filter != nil && filter.SortBy == "size" {
		return "jobs.disk_size desc"
	}
	return "jobs.enqueued_at desc"
}

func ListJobsPaged(filter *JobFilter, page, pageSize int) (*JobListResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	var stats struct {
		Count     int64 `gorm:"column:count"`
		TotalSize int64 `gorm:"column:total_size"`
	}
	base := db.Model(&Job{}).Scopes(applyJobFilter(filter))
	if res := base.Select("COUNT(*) as count, COALESCE(SUM(disk_size), 0) as total_size").Scan(&stats); res.Error != nil {
		return nil, xerrors.Errorf("ListJobsPaged count: %w", res.Error)
	}

	var list []*Job
	res := db.Select("jobs.*, project_files.name AS file_name").
		Joins("LEFT JOIN project_files ON project_files.id = jobs.project_file_id").
		Scopes(applyJobFilter(filter)).
		Order(jobSortOrder(filter)).
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListJobsPaged: %w", res.Error)
	}

	return &JobListResult{
		Jobs:      list,
		Total:     stats.Count,
		TotalSize: stats.TotalSize,
	}, nil
}

type JobPagedResult struct {
	Jobs  []*Job `json:"jobs"`
	Total int64  `json:"total"`
}

func ListJobsByWorkspacePaged(projectID, workspaceID string, page, pageSize int) (*JobPagedResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	var count int64
	if res := db.Model(&Job{}).Where("project_id = ? AND workspace_id = ?", projectID, workspaceID).Count(&count); res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByWorkspacePaged count: %w", res.Error)
	}

	var list []*Job
	res := db.Select("jobs.*, project_files.name AS file_name").
		Joins("LEFT JOIN project_files ON project_files.id = jobs.project_file_id").
		Where("jobs.project_id = ? AND jobs.workspace_id = ?", projectID, workspaceID).
		Order("jobs.enqueued_at desc").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByWorkspacePaged: %w", res.Error)
	}

	return &JobPagedResult{Jobs: list, Total: count}, nil
}

func ListJobsByProjectFilePaged(projectID, projectFileID string, page, pageSize int) (*JobPagedResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	var count int64
	if res := db.Model(&Job{}).Where("project_id = ? AND project_file_id = ?", projectID, projectFileID).Count(&count); res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByProjectFilePaged count: %w", res.Error)
	}

	var list []*Job
	res := db.Select("jobs.*, project_files.name AS file_name").
		Joins("LEFT JOIN project_files ON project_files.id = jobs.project_file_id").
		Where("jobs.project_id = ? AND jobs.project_file_id = ?", projectID, projectFileID).
		Order("jobs.enqueued_at desc").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByProjectFilePaged: %w", res.Error)
	}

	return &JobPagedResult{Jobs: list, Total: count}, nil
}

func GetLatestCompletedJobByWorkspace(workspaceID string) (*Job, error) {
	var j Job
	res := db.Where("workspace_id = ? AND status = ? AND data_status = ?", workspaceID, JobCompleted, JobDataAvailable).
		Order("enqueued_at desc").First(&j)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetLatestCompletedJobByWorkspace: %w", res.Error)
	}
	return &j, nil
}

func GetLatestCompletedRenderJob(workspaceID string) (*Job, error) {
	var j Job
	res := db.Where("workspace_id = ? AND status = ? AND job_type = ? AND data_status IN (?,?)",
		workspaceID, JobCompleted, JobTypeRender, JobDataAvailable, JobDataAvailableLocked).
		Order("enqueued_at desc").First(&j)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetLatestCompletedRenderJob: %w", res.Error)
	}
	return &j, nil
}

// GetLatestJobForThumbnail はサムネイル生成用に最新の完了ジョブを返す。
// data_status は問わない（findFirstImage でファイル存在を確認するため）。
func GetLatestJobForThumbnail(workspaceID string) (*Job, error) {
	var j Job
	res := db.Where("workspace_id = ? AND status = ?", workspaceID, JobCompleted).
		Order("enqueued_at desc").First(&j)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetLatestJobForThumbnail: %w", res.Error)
	}
	return &j, nil
}

func ListJobsByWorkspace(projectID string, workspaceID string) ([]*Job, error) {
	var list []*Job
	res := db.Select("jobs.*, project_files.name AS file_name").
		Joins("LEFT JOIN project_files ON project_files.id = jobs.project_file_id").
		Where("jobs.project_id = ? AND jobs.workspace_id = ?", projectID, workspaceID).
		Order("jobs.enqueued_at desc").Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByWorkspace: %w", res.Error)
	}
	return list, nil
}

func DeleteJob(id string) error {
	if res := db.Delete(&Job{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteJob: %w", res.Error)
	}
	return nil
}

func DeleteJobsByWorkspace(workspaceID string) error {
	if res := db.Delete(&Job{}, "workspace_id = ?", workspaceID); res.Error != nil {
		return xerrors.Errorf("DeleteJobsByWorkspace: %w", res.Error)
	}
	return nil
}

func HasLockedJobsByProject(projectID string) (bool, error) {
	var count int64
	res := db.Model(&Job{}).Where(
		"project_id = ? AND data_status IN (?,?,?,?,?)",
		projectID,
		JobDataNoneLocked, JobDataAvailableLocked, JobDataDeletedLocked, JobDataCorruptedLocked, JobDataModifiedLocked,
	).Count(&count)
	if res.Error != nil {
		return false, xerrors.Errorf("HasLockedJobsByProject: %w", res.Error)
	}
	return count > 0, nil
}

func HasLockedJobsByProjectFile(fileID string) (bool, error) {
	var count int64
	res := db.Model(&Job{}).Where(
		"project_file_id = ? AND data_status IN (?,?,?,?,?)",
		fileID,
		JobDataNoneLocked, JobDataAvailableLocked, JobDataDeletedLocked, JobDataCorruptedLocked, JobDataModifiedLocked,
	).Count(&count)
	if res.Error != nil {
		return false, xerrors.Errorf("HasLockedJobsByProjectFile: %w", res.Error)
	}
	return count > 0, nil
}

func HasLockedJobsByWorkspace(workspaceID string) (bool, error) {
	var count int64
	res := db.Model(&Job{}).Where(
		"workspace_id = ? AND data_status IN (?,?,?,?,?)",
		workspaceID,
		JobDataNoneLocked, JobDataAvailableLocked, JobDataDeletedLocked, JobDataCorruptedLocked, JobDataModifiedLocked,
	).Count(&count)
	if res.Error != nil {
		return false, xerrors.Errorf("HasLockedJobsByWorkspace: %w", res.Error)
	}
	return count > 0, nil
}

func ListJobsByProjectFile(projectID string, projectFileID string) ([]*Job, error) {
	var list []*Job
	res := db.Select("jobs.*, project_files.name AS file_name").
		Joins("LEFT JOIN project_files ON project_files.id = jobs.project_file_id").
		Where("jobs.project_id = ? AND jobs.project_file_id = ?", projectID, projectFileID).
		Order("jobs.enqueued_at desc").Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByProjectFile: %w", res.Error)
	}
	return list, nil
}

func DeleteJobsByProjectFile(fileID string) error {
	if res := db.Delete(&Job{}, "project_file_id = ?", fileID); res.Error != nil {
		return xerrors.Errorf("DeleteJobsByProjectFile: %w", res.Error)
	}
	return nil
}

func DeleteJobsByProject(projectID string) error {
	if res := db.Delete(&Job{}, "project_id = ?", projectID); res.Error != nil {
		return xerrors.Errorf("DeleteJobsByProject: %w", res.Error)
	}
	return nil
}

func UpdateJobStarted(id string, startedAt *time.Time) error {
	if res := db.Model(&Job{}).Where("id = ?", id).Update("started_at", startedAt); res.Error != nil {
		return xerrors.Errorf("UpdateJobStarted: %w", res.Error)
	}
	return nil
}

func UpdateJobDone(id string, status string, errMsg string, completedAt *time.Time, diskSize int64, dataStatus int) error {
	if res := db.Model(&Job{}).Where("id = ?", id).Updates(map[string]any{
		"status":       status,
		"error_msg":    errMsg,
		"completed_at": completedAt,
		"disk_size":    diskSize,
		"data_status":  dataStatus,
	}); res.Error != nil {
		return xerrors.Errorf("UpdateJobDone: %w", res.Error)
	}
	return nil
}

func UpdateJobDataStatus(id string, dataStatus int) error {
	if res := db.Model(&Job{}).Where("id = ?", id).Update("data_status", dataStatus); res.Error != nil {
		return xerrors.Errorf("UpdateJobDataStatus: %w", res.Error)
	}
	return nil
}

// CountAutoLockedJobs は指定ワークスペースの自動ロック済みジョブ件数を返す。
// 自動ロック対象 = status=completed かつ data_status=JobDataAvailableLocked
func CountAutoLockedJobs(workspaceID string) (int64, error) {
	var count int64
	if res := db.Model(&Job{}).Where(
		"workspace_id = ? AND status = ? AND data_status = ?",
		workspaceID, JobCompleted, JobDataAvailableLocked,
	).Count(&count); res.Error != nil {
		return 0, xerrors.Errorf("CountAutoLockedJobs: %w", res.Error)
	}
	return count, nil
}

// GetOldestAutoLockedJob は指定ワークスペースで最も古い自動ロック済みジョブを返す。
func GetOldestAutoLockedJob(workspaceID string) (*Job, error) {
	var j Job
	res := db.Where(
		"workspace_id = ? AND status = ? AND data_status = ?",
		workspaceID, JobCompleted, JobDataAvailableLocked,
	).Order("enqueued_at asc").First(&j)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetOldestAutoLockedJob: %w", res.Error)
	}
	return &j, nil
}

// CleanableJobStats はクリーンアップ対象のジョブ統計を返す。
type CleanableJobStats struct {
	Count     int64 `json:"count"`
	TotalSize int64 `json:"total_size"`
}

// CleanFilter はクリーンアップ対象のフィルタ条件。
type CleanFilter struct {
	DataStatuses []int `json:"data_statuses"`
	Days         int   `json:"days"`
}

func applyCleanFilter(filter *CleanFilter) func(*gorm.DB) *gorm.DB {
	return func(tx *gorm.DB) *gorm.DB {
		if filter != nil && len(filter.DataStatuses) > 0 {
			tx = tx.Where("data_status IN ?", filter.DataStatuses)
		} else {
			tx = tx.Where("data_status IN ?", []int{JobDataAvailable, JobDataCorrupted})
		}
		if filter != nil && filter.Days > 0 {
			cutoff := time.Now().AddDate(0, 0, -filter.Days)
			tx = tx.Where("completed_at <= ?", cutoff)
		}
		return tx
	}
}

// GetCleanableJobStats はフィルタ条件に合致する削除可能なジョブの件数と合計容量を返す。
func GetCleanableJobStats(filter *CleanFilter) (*CleanableJobStats, error) {
	var stats CleanableJobStats
	res := db.Model(&Job{}).Scopes(applyCleanFilter(filter)).
		Select("COUNT(*) as count, COALESCE(SUM(disk_size), 0) as total_size").Scan(&stats)
	if res.Error != nil {
		return nil, xerrors.Errorf("GetCleanableJobStats: %w", res.Error)
	}
	return &stats, nil
}

// ListCleanableJobs はフィルタ条件に合致する削除可能なジョブ一覧を返す。
func ListCleanableJobs(filter *CleanFilter) ([]*Job, error) {
	var list []*Job
	res := db.Scopes(applyCleanFilter(filter)).Order("enqueued_at asc").Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListCleanableJobs: %w", res.Error)
	}
	return list, nil
}

// ListOutputDirsByWorkspace はワークスペースに紐づくジョブの出力フォルダ一覧を返す。
func ListOutputDirsByWorkspace(workspaceID string) ([]string, error) {
	var dirs []string
	if res := db.Model(&Job{}).Where("workspace_id = ?", workspaceID).Pluck("output_dir", &dirs); res.Error != nil {
		return nil, xerrors.Errorf("ListOutputDirsByWorkspace: %w", res.Error)
	}
	return dirs, nil
}

// ListOutputDirsByProjectFile はファイルに紐づくジョブの出力フォルダ一覧を返す。
func ListOutputDirsByProjectFile(fileID string) ([]string, error) {
	var dirs []string
	if res := db.Model(&Job{}).Where("project_file_id = ?", fileID).Pluck("output_dir", &dirs); res.Error != nil {
		return nil, xerrors.Errorf("ListOutputDirsByProjectFile: %w", res.Error)
	}
	return dirs, nil
}

// ListOutputDirsByProject はプロジェクトに紐づくジョブの出力フォルダ一覧を返す。
func ListOutputDirsByProject(projectID string) ([]string, error) {
	var dirs []string
	if res := db.Model(&Job{}).Where("project_id = ?", projectID).Pluck("output_dir", &dirs); res.Error != nil {
		return nil, xerrors.Errorf("ListOutputDirsByProject: %w", res.Error)
	}
	return dirs, nil
}
