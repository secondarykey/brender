package api

import (
	"context"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/secondarykey/brender/model"
)

// scheduleFixture は作業ディレクトリ 2 つ（free・locked）と、それぞれにあるプロジェクト。
// runQueue を差し替え、起動したキューを記録するだけにする（Blender は起動しない）。
type scheduleFixture struct {
	free, locked       *model.WorkDir
	freePrj, lockedPrj string

	mu      sync.Mutex
	started []string
}

func newScheduleFixture(t *testing.T, max int) *scheduleFixture {
	t.Helper()
	initQueueTestDB(t)
	fx := &scheduleFixture{
		free:   &model.WorkDir{Path: t.TempDir(), Status: model.WorkDirStatusActive},
		locked: &model.WorkDir{Path: t.TempDir(), Status: model.WorkDirStatusLock},
	}
	for _, wd := range []*model.WorkDir{fx.free, fx.locked} {
		if err := model.CreateWorkDir(context.Background(), wd); err != nil {
			t.Fatalf("CreateWorkDir: %v", err)
		}
	}
	for _, x := range []struct {
		wd  *model.WorkDir
		dst *string
	}{{fx.free, &fx.freePrj}, {fx.locked, &fx.lockedPrj}} {
		p, err := model.CreateProject(context.Background(), "P", nil, x.wd.ID)
		if err != nil {
			t.Fatalf("CreateProject: %v", err)
		}
		*x.dst = p.Project.ID
	}
	if err := model.SetEnvironment(context.Background(), &model.Environment{MaxConcurrentJobs: max}); err != nil {
		t.Fatalf("SetEnvironment: %v", err)
	}

	prev := runQueue
	runQueue = func(q *model.Queue, _ *model.Job) {
		fx.mu.Lock()
		fx.started = append(fx.started, q.ID)
		fx.mu.Unlock()
	}
	t.Cleanup(func() { runQueue = prev })
	return fx
}

// add は待ちのキュー（とジョブ）を1つ足して ID を返す。ID は UUID v7 なので足した順に並ぶ。
func (fx *scheduleFixture) add(t *testing.T, projectID string, status string) string {
	t.Helper()
	id, err := model.NewQueueID()
	if err != nil {
		t.Fatalf("NewQueueID: %v", err)
	}
	if err := model.CreateJob(context.Background(), &model.Job{ID: id, ProjectID: projectID, WorkspaceID: id, JobType: model.JobTypeRender}); err != nil {
		t.Fatalf("CreateJob: %v", err)
	}
	if err := model.CreateQueue(context.Background(), &model.Queue{ID: id, ProjectID: projectID, WorkspaceID: id, Status: status}); err != nil {
		t.Fatalf("CreateQueue: %v", err)
	}
	return id
}

// startedIDs は schedule が起動した goroutine が記録し終えるのを待って、起動したキューを返す。
func (fx *scheduleFixture) startedIDs(t *testing.T, want int) []string {
	t.Helper()
	waitFor(t, func() bool {
		fx.mu.Lock()
		defer fx.mu.Unlock()
		return len(fx.started) >= want
	})
	fx.mu.Lock()
	defer fx.mu.Unlock()
	got := append([]string(nil), fx.started...)
	sort.Strings(got)
	return got
}

func queueStatus(t *testing.T, id string) string {
	t.Helper()
	list, err := model.ListQueues()
	if err != nil {
		t.Fatalf("ListQueues: %v", err)
	}
	for _, q := range list {
		if q.ID == id {
			return q.Status
		}
	}
	return ""
}

func sameIDs(got []string, want ...string) bool {
	sort.Strings(want)
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

// 空きの数だけ古い順に起動する。新しい投入が先に待っているジョブを追い越さない。
func TestScheduleStartsOldestFirst(t *testing.T) {
	fx := newScheduleFixture(t, 1)
	older := fx.add(t, fx.freePrj, model.QueueWaiting)
	newer := fx.add(t, fx.freePrj, model.QueueWaiting)

	schedule()
	if got := fx.startedIDs(t, 1); !sameIDs(got, older) {
		t.Errorf("started %v, want only the older %s", got, older)
	}
	if s := queueStatus(t, newer); s != model.QueueWaiting {
		t.Errorf("newer status = %q, want waiting", s)
	}
}

// lock 中の作業ディレクトリのジョブは飛ばし、後ろのジョブを起動する。以前は先頭で全部が止まった。
func TestScheduleSkipsLockedWorkDir(t *testing.T) {
	fx := newScheduleFixture(t, 1)
	lockedQ := fx.add(t, fx.lockedPrj, model.QueueWaiting)
	freeQ := fx.add(t, fx.freePrj, model.QueueWaiting)

	schedule()
	if got := fx.startedIDs(t, 1); !sameIDs(got, freeQ) {
		t.Errorf("started %v, want %s behind the locked one", got, freeQ)
	}
	if s := queueStatus(t, lockedQ); s != model.QueueWaiting {
		t.Errorf("locked status = %q, want waiting", s)
	}

	// lock を外すと起動する（以前は次の終了か投入まで起動しなかった）
	fx.mu.Lock()
	fx.started = nil
	fx.mu.Unlock()
	if err := model.SetEnvironment(context.Background(), &model.Environment{MaxConcurrentJobs: 2}); err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateWorkDir(context.Background(), fx.locked.ID, fx.locked.Path, 0, model.WorkDirStatusActive); err != nil {
		t.Fatalf("UpdateWorkDir: %v", err)
	}
	if got := fx.startedIDs(t, 1); !sameIDs(got, lockedQ) {
		t.Errorf("started %v after unlocking, want %s", got, lockedQ)
	}
}

// 同時実行数を上げると、すぐに待ちを起動する（以前は次の終了か投入まで起動しなかった）。
func TestScheduleOnMaxConcurrentJobsRaised(t *testing.T) {
	fx := newScheduleFixture(t, 1)
	fx.add(t, fx.freePrj, model.QueueRunning)
	a := fx.add(t, fx.freePrj, model.QueueWaiting)
	b := fx.add(t, fx.freePrj, model.QueueRecovering)

	schedule()
	// 起動するときは scheduleMu の中で DB を running にするので、状態で確かめられる
	if s := queueStatus(t, a); s != model.QueueWaiting {
		t.Fatalf("status = %q while full, want waiting", s)
	}

	if err := SetMaxConcurrentJobs(context.Background(), 3); err != nil {
		t.Fatalf("SetMaxConcurrentJobs: %v", err)
	}
	if got := fx.startedIDs(t, 2); !sameIDs(got, a, b) {
		t.Errorf("started %v, want %s and %s", got, a, b)
	}
	for _, id := range []string{a, b} {
		if s := queueStatus(t, id); s != model.QueueRunning {
			t.Errorf("%s status = %q, want running", id, s)
		}
	}
}

// 終了の後始末中（shuttingDown）は起動しない。
func TestScheduleNotWhileShuttingDown(t *testing.T) {
	fx := newScheduleFixture(t, 1)
	id := fx.add(t, fx.freePrj, model.QueueWaiting)
	shuttingDown.Store(true)
	schedule()
	if s := queueStatus(t, id); s != model.QueueWaiting {
		t.Errorf("status = %q, want waiting", s)
	}
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("timed out")
		}
		time.Sleep(5 * time.Millisecond)
	}
}
