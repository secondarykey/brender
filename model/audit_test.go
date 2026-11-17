package model

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

// 監査カラム（CreatedBy / UpdatedBy）に残すユーザは、書き込む関数に渡した ctx だけで決まる。
// goroutine をまたいでも変わらない（以前は goroutine ID で引いていて、go func() の中では owner に戻っていた）。

func TestAuditUser(t *testing.T) {
	bg := context.Background()
	if got := AuditUser(bg); got != UserIDOwner {
		t.Errorf("ユーザなし = %q, want owner", got)
	}
	if got := AuditUser(WithUser(bg, "u1")); got != "u1" {
		t.Errorf("WithUser = %q, want u1", got)
	}
	// 権限のユーザより、記録のユーザを優先する（バックグラウンドは owner 権限で動くが、記録は操作した人）
	if got := AuditUser(WithAuditUser(WithUser(bg, UserIDOwner), "u2")); got != "u2" {
		t.Errorf("WithAuditUser = %q, want u2", got)
	}
}

func initAuditTestDB(t *testing.T) {
	t.Helper()
	if err := Init(filepath.Join(t.TempDir(), "test.db")); err != nil {
		t.Fatalf("Init: %v", err)
	}
	t.Cleanup(func() { Close() })
}

func TestAuditColumnsFromContext(t *testing.T) {
	initAuditTestDB(t)
	creator := WithUser(context.Background(), "u1")

	detail, err := CreateProject(creator, "Proj", nil, 0)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	file, err := AddProjectFile(creator, detail.Project.ID, "/tmp/scene.blend")
	if err != nil {
		t.Fatalf("AddProjectFile: %v", err)
	}

	// 別の goroutine から書いても、渡した ctx のユーザが残る
	done := make(chan *Workspace, 1)
	go func() {
		ws, err := CreateWorkspace(creator, detail.Project.ID, file.ID, "WS")
		if err != nil {
			t.Errorf("CreateWorkspace: %v", err)
		}
		done <- ws
	}()
	ws := <-done
	if ws == nil {
		t.FailNow()
	}

	got, err := SelectWorkspace(detail.Project.ID, ws.ID)
	if err != nil || got == nil {
		t.Fatalf("SelectWorkspace: %v", err)
	}
	if got.CreatedBy != "u1" || got.UpdatedBy != "u1" {
		t.Errorf("作成: CreatedBy=%q UpdatedBy=%q, want u1", got.CreatedBy, got.UpdatedBy)
	}

	// 更新は UpdatedBy だけが変わる
	now := time.Now()
	if err := UpdateWorkspaceProcessedAt(WithUser(context.Background(), "u2"), ws.ID, &now); err != nil {
		t.Fatalf("UpdateWorkspaceProcessedAt: %v", err)
	}
	got, _ = SelectWorkspace(detail.Project.ID, ws.ID)
	if got.CreatedBy != "u1" || got.UpdatedBy != "u2" {
		t.Errorf("更新: CreatedBy=%q UpdatedBy=%q, want u1 / u2", got.CreatedBy, got.UpdatedBy)
	}
}

func TestAuditColumnsJob(t *testing.T) {
	initAuditTestDB(t)
	id, err := NewQueueID()
	if err != nil {
		t.Fatalf("NewQueueID: %v", err)
	}
	ctx := WithAuditUser(WithUser(context.Background(), UserIDOwner), "u3")
	if err := CreateJob(ctx, &Job{ID: id}); err != nil {
		t.Fatalf("CreateJob: %v", err)
	}
	if err := CreateQueue(ctx, &Queue{ID: id, Status: QueueWaiting}); err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}
	j, _ := GetJob(id)
	q, _ := GetQueue(id)
	if j == nil || j.CreatedBy != "u3" {
		t.Errorf("Job.CreatedBy = %v, want u3", j)
	}
	if q == nil || q.CreatedBy != "u3" {
		t.Errorf("Queue.CreatedBy = %v, want u3", q)
	}
}
