package api

import (
	"io"
	"os"
	osexec "os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/secondarykey/brender/model"
)

// TestHelperBlenderProcess は強制終了の対象にする疑似 Blender プロセスの本体。
// 通常の go test では何もしない。
func TestHelperBlenderProcess(t *testing.T) {
	if os.Getenv("BRENDER_HELPER_BLENDER") != "1" {
		return
	}
	time.Sleep(60 * time.Second)
	os.Exit(0)
}

func initQueueTestDB(t *testing.T) {
	t.Helper()
	if err := model.Init(filepath.Join(t.TempDir(), "test.db")); err != nil {
		t.Fatalf("Init: %v", err)
	}
	// Windows では接続を閉じないと TempDir のクリーンアップが失敗する。
	t.Cleanup(func() { model.Close() })
	t.Cleanup(func() { shuttingDown.Store(false) })
}

// startFakeBlender はテストバイナリを "blender" という名前で複製して起動する。
// killQueueProcess は実行ファイル名に "blender" を含むプロセスしか kill しないため。
func startFakeBlender(t *testing.T) *osexec.Cmd {
	t.Helper()
	self, err := os.Executable()
	if err != nil {
		t.Fatalf("Executable: %v", err)
	}
	name := "blender"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	path := filepath.Join(t.TempDir(), name)
	src, err := os.Open(self)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer src.Close()
	dst, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		t.Fatalf("OpenFile: %v", err)
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		t.Fatalf("Copy: %v", err)
	}
	dst.Close()

	cmd := osexec.Command(path, "-test.run=^TestHelperBlenderProcess$")
	cmd.Env = append(os.Environ(), "BRENDER_HELPER_BLENDER=1")
	if err := cmd.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() {
		cmd.Process.Kill()
		cmd.Wait()
	})
	return cmd
}

func createRunningQueue(t *testing.T, pid int, blenderPath string) string {
	t.Helper()
	id, err := model.NewQueueID()
	if err != nil {
		t.Fatalf("NewQueueID: %v", err)
	}
	if err := model.CreateJob(&model.Job{ID: id, BlenderPath: blenderPath}); err != nil {
		t.Fatalf("CreateJob: %v", err)
	}
	if err := model.CreateQueue(&model.Queue{ID: id, ProcessID: pid, Status: model.QueueRunning}); err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}
	return id
}

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
	finishJob(id, false, waitErr.Error(), 0)

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

	finishJob(id, true, "", 0)
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
	finishJob(id, false, waitErr.Error(), 0)

	q, err := model.GetQueue(id)
	if err != nil || q == nil {
		t.Fatalf("Queue must remain for recovery: %v", err)
	}
	if q.Status != model.QueueRunning {
		t.Errorf("Queue.Status = %q, want %q", q.Status, model.QueueRunning)
	}
}

func TestFileNotModifiedSince(t *testing.T) {
	path := filepath.Join(t.TempDir(), "scene.blend")
	if err := os.WriteFile(path, []byte("x"), 0644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	mod := time.Date(2026, 1, 2, 3, 4, 5, 0, time.Local)
	if err := os.Chtimes(path, mod, mod); err != nil {
		t.Fatalf("Chtimes: %v", err)
	}
	at := func(d time.Duration) *time.Time { v := mod.Add(d); return &v }

	tests := []struct {
		name        string
		path        string
		processedAt *time.Time
		want        bool
	}{
		{"未実行", path, nil, false},
		{"実行後に更新", path, at(-time.Minute), false},
		{"実行より前に更新", path, at(time.Minute), true},
		{"実行と同時刻", path, at(0), true},
		{"ファイルが無い", filepath.Join(t.TempDir(), "missing.blend"), at(0), true},
	}
	for _, tt := range tests {
		if got := fileNotModifiedSince(tt.path, tt.processedAt); got != tt.want {
			t.Errorf("%s: got %v, want %v", tt.name, got, tt.want)
		}
	}
}
