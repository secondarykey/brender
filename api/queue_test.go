package api

import (
	"context"
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
	if err := model.CreateJob(context.Background(), &model.Job{ID: id, BlenderPath: blenderPath}); err != nil {
		t.Fatalf("CreateJob: %v", err)
	}
	if err := model.CreateQueue(context.Background(), &model.Queue{ID: id, ProcessID: pid, Status: model.QueueRunning}); err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}
	return id
}

// 実行中のキューのキャンセルは、実行 goroutine の finishJob（kill されたのでエラーで呼ばれる）が
// 後から走っても、先に走っても cancelled のまま残る。
func TestCancelRunningQueue(t *testing.T) {
	for _, finishFirst := range []bool{false, true} {
		name := "キャンセルが先"
		if finishFirst {
			name = "finishJob が先"
		}
		t.Run(name, func(t *testing.T) {
			initQueueTestDB(t)

			cmd := startFakeBlender(t)
			id := createRunningQueue(t, cmd.Process.Pid, cmd.Path)

			if finishFirst {
				// CancelQueue が kill した直後に finishJob が割り込んだ場合と同じ: 目印だけ先に置かれた状態
				userKilledQueues.Store(id, struct{}{})
				cmd.Process.Kill()
				finishJob(SystemContext(), id, false, cmd.Wait().Error(), 0)
				// finishJob がキューを消しているので CancelQueue はエラーで返る（記録は cancelled のまま）
				_ = CancelQueue(SystemContext(), id)
			} else {
				if err := CancelQueue(SystemContext(), id); err != nil {
					t.Fatalf("CancelQueue: %v", err)
				}
				waitErr := cmd.Wait()
				if waitErr == nil {
					t.Fatal("process was not killed")
				}
				finishJob(SystemContext(), id, false, waitErr.Error(), 0)
			}

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
			if q, _ := model.GetQueue(id); q != nil {
				t.Errorf("Queue %s still exists", id)
			}
			if _, ok := userKilledQueues.Load(id); ok {
				t.Error("cancel mark was not consumed by finishJob")
			}
		})
	}
}

// 待機中のキューのキャンセルには実行 goroutine が無いので目印を置かない（残り続けないように）。
func TestCancelWaitingQueue(t *testing.T) {
	initQueueTestDB(t)

	id, err := model.NewQueueID()
	if err != nil {
		t.Fatalf("NewQueueID: %v", err)
	}
	if err := model.CreateJob(context.Background(), &model.Job{ID: id}); err != nil {
		t.Fatalf("CreateJob: %v", err)
	}
	if err := model.CreateQueue(context.Background(), &model.Queue{ID: id, Status: model.QueueWaiting}); err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}
	if err := CancelQueue(SystemContext(), id); err != nil {
		t.Fatalf("CancelQueue: %v", err)
	}
	if _, ok := userKilledQueues.Load(id); ok {
		t.Error("waiting queue must not leave a mark")
	}
	j, err := model.GetJob(id)
	if err != nil {
		t.Fatalf("GetJob: %v", err)
	}
	if j.Status != model.JobCancelled {
		t.Errorf("Job.Status = %q, want %q", j.Status, model.JobCancelled)
	}
}
