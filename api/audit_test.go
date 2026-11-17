package api

import (
	"context"
	"testing"

	"github.com/secondarykey/brender/model"
)

// バックグラウンドの処理は owner の権限で動くが、記録（監査カラム）には操作した人を残す。
// 呼び出しの ctx が取り消されても、バックグラウンドの ctx は取り消されない。
func TestBackgroundContext(t *testing.T) {
	req, cancel := context.WithCancel(model.WithUser(context.Background(), "u1"))
	bg := backgroundContext(req)
	cancel()

	if bg.Err() != nil {
		t.Errorf("呼び出しの取り消しが移った: %v", bg.Err())
	}
	if got, _ := model.UserFromContext(bg); got != model.UserIDOwner {
		t.Errorf("権限のユーザ = %q, want owner", got)
	}
	if got := model.AuditUser(bg); got != "u1" {
		t.Errorf("記録のユーザ = %q, want u1", got)
	}
}

// 起動時のリカバリで作り直すジョブとキューは、もとのジョブを投入した人のものとして記録する。
func TestRecoverKeepsJobCreator(t *testing.T) {
	initQueueTestDB(t)

	id, err := model.NewQueueID()
	if err != nil {
		t.Fatalf("NewQueueID: %v", err)
	}
	user := model.WithUser(context.Background(), "u1")
	if err := model.CreateJob(user, &model.Job{ID: id, OutputDir: t.TempDir()}); err != nil {
		t.Fatalf("CreateJob: %v", err)
	}
	// PID 0 は kill しない（Blender は起動していない）
	if err := model.CreateQueue(user, &model.Queue{ID: id, Status: model.QueueRunning}); err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}

	RecoverStaleQueues()

	queues, err := model.ListQueues()
	if err != nil || len(queues) != 1 || queues[0].ID == id {
		t.Fatalf("作り直したキューが1つあるはず: %v %v", queues, err)
	}
	newQ := queues[0]
	if newQ.CreatedBy != "u1" {
		t.Errorf("Queue.CreatedBy = %q, want u1", newQ.CreatedBy)
	}
	j, err := model.GetJob(newQ.ID)
	if err != nil || j == nil {
		t.Fatalf("GetJob: %v", err)
	}
	if j.CreatedBy != "u1" {
		t.Errorf("Job.CreatedBy = %q, want u1", j.CreatedBy)
	}
}
