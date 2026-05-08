package model

import (
	"time"

	"golang.org/x/xerrors"
)

const (
	JobCompleted = "completed"
	JobError     = "error"
	JobCancelled = "cancelled"
)

// Job はレンダリング実行の完了済み履歴レコード。
// Queue と同じ UUID v7 の ID を持つ。
type Job struct {
	ID            string     `gorm:"primaryKey" json:"id"` // UUID v7, Queue と共通
	ProjectID     string     `json:"project_id"`
	ProjectName   string     `json:"project_name"`
	WorkspaceID   string     `json:"workspace_id"`
	WorkspaceName string     `json:"workspace_name"`
	ProjectFileID uint       `json:"project_file_id"`
	BlenderPath   string     `json:"blender_path"`
	BlenderFile   string     `json:"blender_file"`
	OutputDir     string     `json:"output_dir"`
	Scene         string     `json:"scene"`
	Engine        string     `json:"engine"`
	StartFrame    int        `json:"start_frame"`
	EndFrame      int        `json:"end_frame"`
	FrameStep     int        `json:"frame_step"`
	Thread        int        `json:"thread"`
	Status        string     `json:"status"` // completed / error / cancelled
	ErrorMsg      string     `json:"error_msg"`
	StartedAt     *time.Time `json:"started_at"`
	CompletedAt   *time.Time `json:"completed_at"`
	EnqueuedAt    *time.Time `json:"enqueued_at"` // キュー登録時刻
}

func CreateJob(j *Job) error {
	if res := db.Create(j); res.Error != nil {
		return xerrors.Errorf("CreateJob: %w", res.Error)
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
	if res := db.Order("enqueued_at desc").Find(&list); res.Error != nil {
		return nil, xerrors.Errorf("ListJobs: %w", res.Error)
	}
	return list, nil
}

func ListJobsByWorkspace(projectID string, workspaceID string) ([]*Job, error) {
	var list []*Job
	if res := db.Where("project_id = ? AND workspace_id = ?", projectID, workspaceID).
		Order("enqueued_at desc").Find(&list); res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByWorkspace: %w", res.Error)
	}
	return list, nil
}

func DeleteJobsByWorkspace(workspaceID string) error {
	if res := db.Delete(&Job{}, "workspace_id = ?", workspaceID); res.Error != nil {
		return xerrors.Errorf("DeleteJobsByWorkspace: %w", res.Error)
	}
	return nil
}

func ListJobsByProjectFile(projectID string, projectFileID uint) ([]*Job, error) {
	var list []*Job
	if res := db.Where("project_id = ? AND project_file_id = ?", projectID, projectFileID).
		Order("enqueued_at desc").Find(&list); res.Error != nil {
		return nil, xerrors.Errorf("ListJobsByProjectFile: %w", res.Error)
	}
	return list, nil
}

func DeleteJobsByProjectFile(fileID uint) error {
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

func UpdateJobDone(id string, status string, errMsg string, completedAt *time.Time) error {
	if res := db.Model(&Job{}).Where("id = ?", id).Updates(map[string]any{
		"status":       status,
		"error_msg":    errMsg,
		"completed_at": completedAt,
	}); res.Error != nil {
		return xerrors.Errorf("UpdateJobDone: %w", res.Error)
	}
	return nil
}
