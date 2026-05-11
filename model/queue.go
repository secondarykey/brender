package model

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"golang.org/x/xerrors"
)

const (
	QueueWaiting = "waiting"
	QueueRunning = "running"
)

type Queue struct {
	ID          string     `gorm:"primaryKey" json:"id"` // UUID v7, same as Job
	ProjectID   string     `json:"project_id"`
	WorkspaceID string     `json:"workspace_id"`
	ProcessID   int        `json:"process_id"`
	Status      string     `json:"status"` // waiting / running
	StartedAt   *time.Time `json:"started_at"`
	CreatedAt   *time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func NewQueueID() (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", xerrors.Errorf("uuid.NewV7: %w", err)
	}
	return id.String(), nil
}

func CreateQueue(q *Queue) error {
	if res := db.Create(q); res.Error != nil {
		return xerrors.Errorf("CreateQueue: %w", res.Error)
	}
	return nil
}

// MarkQueueStarting は status を waiting → running へ変更する。
// PID 確定前に呼ぶことでスケジューラの二重起動を防ぐ。
func MarkQueueStarting(id string) error {
	if res := db.Model(&Queue{}).Where("id = ?", id).Update("status", QueueRunning); res.Error != nil {
		return xerrors.Errorf("MarkQueueStarting: %w", res.Error)
	}
	return nil
}

// UpdateQueueRunning は実際の PID と開始時刻を記録する（status は MarkQueueStarting で設定済み）。
func UpdateQueueRunning(id string, pid int) error {
	now := time.Now()
	if res := db.Model(&Queue{}).Where("id = ?", id).Updates(map[string]any{
		"process_id": pid,
		"started_at": &now,
	}); res.Error != nil {
		return xerrors.Errorf("UpdateQueueRunning: %w", res.Error)
	}
	return nil
}

func CountRunningQueues() (int64, error) {
	var count int64
	if res := db.Model(&Queue{}).Where("status = ?", QueueRunning).Count(&count); res.Error != nil {
		return 0, xerrors.Errorf("CountRunningQueues: %w", res.Error)
	}
	return count, nil
}

// GetOldestWaitingQueue は待機中のキューを登録順（id asc）で1件返す。
// 存在しない場合は nil, nil を返す。
func GetOldestWaitingQueue() (*Queue, error) {
	var q Queue
	res := db.Where("status = ?", QueueWaiting).Order("id asc").First(&q)
	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, xerrors.Errorf("GetOldestWaitingQueue: %w", res.Error)
	}
	return &q, nil
}

func DeleteQueue(id string) error {
	if res := db.Delete(&Queue{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteQueue: %w", res.Error)
	}
	return nil
}

func GetQueue(id string) (*Queue, error) {
	var q Queue
	if res := db.First(&q, "id = ?", id); res.Error != nil {
		return nil, xerrors.Errorf("GetQueue: %w", res.Error)
	}
	return &q, nil
}

func CountQueues() (int64, error) {
	var count int64
	if res := db.Model(&Queue{}).Count(&count); res.Error != nil {
		return 0, xerrors.Errorf("CountQueues: %w", res.Error)
	}
	return count, nil
}

func ListQueues() ([]*Queue, error) {
	var list []*Queue
	if res := db.Order("id asc").Find(&list); res.Error != nil {
		return nil, xerrors.Errorf("ListQueues: %w", res.Error)
	}
	return list, nil
}

func ListQueuesByWorkspace(projectID string, workspaceID string) ([]*Queue, error) {
	var list []*Queue
	if res := db.Where("project_id = ? AND workspace_id = ?", projectID, workspaceID).
		Order("id desc").Find(&list); res.Error != nil {
		return nil, xerrors.Errorf("ListQueuesByWorkspace: %w", res.Error)
	}
	return list, nil
}
