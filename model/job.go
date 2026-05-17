package model

import (
	"errors"
	"time"

	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

const (
	JobCompleted = "completed"
	JobError     = "error"
	JobCancelled = "cancelled"
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
	ProjectName   string     `json:"project_name"`
	WorkspaceID   string     `json:"workspace_id"`
	WorkspaceName string     `json:"workspace_name"`
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
	DiskSize      int64      `json:"disk_size"`   // 出力フォルダの容量（バイト）
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
	if res := db.First(&j, "id = ?", id); res.Error != nil {
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
