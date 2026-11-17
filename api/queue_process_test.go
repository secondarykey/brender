package api

import (
	"testing"

	"github.com/secondarykey/brender/model"
)

// 利用者の強制終了は shuttingDown を立てず、kill されたジョブは finishJob で cancelled として閉じる。
func TestKillRunningQueuesByUser(t *testing.T) {
	initQueueTestDB(t)

	cmd := startFakeBlender(t)
	id := createRunningQueue(t, cmd.Process.Pid, cmd.Path)

	if err := KillRunningQueuesByUser(SystemContext()); err != nil {
		t.Fatalf("KillRunningQueuesByUser: %v", err)
	}
	if IsShuttingDown() {
		t.Fatal("shuttingDown must not be set by user kill")
	}

	// 実行 goroutine と同じく、プロセス終了を待ってエラーで finishJob を呼ぶ
	waitErr := cmd.Wait()
	if waitErr == nil {
		t.Fatal("process was not killed")
	}
	finishJob(SystemContext(), id, false, waitErr.Error(), 0)

	j, err := model.GetJob(id)
	if err != nil {
		t.Fatalf("GetJob: %v", err)
	}
	if j.Status != model.JobCancelled {
		t.Errorf("Job.Status = %q, want %q", j.Status, model.JobCancelled)
	}
	if j.ErrorMsg != "" {
		t.Errorf("Job.ErrorMsg = %q, want empty", j.ErrorMsg)
	}
	if j.DataStatus != model.JobDataCorrupted {
		t.Errorf("Job.DataStatus = %d, want %d", j.DataStatus, model.JobDataCorrupted)
	}
	if j.CompletedAt == nil {
		t.Error("Job.CompletedAt is nil")
	}
	if q, _ := model.GetQueue(id); q != nil {
		t.Errorf("Queue %s still exists", id)
	}
	if _, ok := userKilledQueues.Load(id); ok {
		t.Error("kill mark was not consumed by finishJob")
	}
}

// kill できなかったキューには目印を残さず、後で正常終了したら completed のまま記録される。
func TestKillRunningQueuesByUserNotKilled(t *testing.T) {
	initQueueTestDB(t)

	id := createRunningQueue(t, 0, "") // PID 未記録（起動直前）

	if err := KillRunningQueuesByUser(SystemContext()); err != nil {
		t.Fatalf("KillRunningQueuesByUser: %v", err)
	}
	if _, ok := userKilledQueues.Load(id); ok {
		t.Fatal("mark must be removed when the process was not killed")
	}

	finishJob(SystemContext(), id, true, "", 0)
	j, err := model.GetJob(id)
	if err != nil {
		t.Fatalf("GetJob: %v", err)
	}
	if j.Status != model.JobCompleted {
		t.Errorf("Job.Status = %q, want %q", j.Status, model.JobCompleted)
	}
}

// 終了時の強制終了は shuttingDown を立て、以後の finishJob は Queue を残したままスキップする。
func TestKillRunningQueuesShutdown(t *testing.T) {
	initQueueTestDB(t)

	cmd := startFakeBlender(t)
	id := createRunningQueue(t, cmd.Process.Pid, cmd.Path)

	KillRunningQueues()
	if !IsShuttingDown() {
		t.Fatal("shuttingDown must be set by shutdown kill")
	}
	waitErr := cmd.Wait()
	if waitErr == nil {
		t.Fatal("process was not killed")
	}
	finishJob(SystemContext(), id, false, waitErr.Error(), 0)

	q, err := model.GetQueue(id)
	if err != nil || q == nil {
		t.Fatalf("Queue must remain for recovery: %v", err)
	}
	if q.Status != model.QueueRunning {
		t.Errorf("Queue.Status = %q, want %q", q.Status, model.QueueRunning)
	}
}
