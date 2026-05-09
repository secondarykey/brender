package model

import (
	"time"

	"github.com/google/uuid"
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

func UpdateQueueRunning(id string, pid int) error {
	now := time.Now()
	if res := db.Model(&Queue{}).Where("id = ?", id).Updates(map[string]any{
		"status":     QueueRunning,
		"process_id": pid,
		"started_at": &now,
	}); res.Error != nil {
		return xerrors.Errorf("UpdateQueueRunning: %w", res.Error)
	}
	return nil
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
	if res := db.Order("id desc").Find(&list); res.Error != nil {
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
