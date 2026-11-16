package api

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/secondarykey/brender/model"
)

// moveFixture は作業ディレクトリ 2 つと、1 つ目にあるプロジェクト（出力したジョブ 1 つ）。
type moveFixture struct {
	oldWd, newWd *model.WorkDir
	projectID    string
	jobID        string
	jobFile      string // 旧パスにあるジョブの出力ファイル
}

func newMoveFixture(t *testing.T) *moveFixture {
	t.Helper()
	initQueueTestDB(t)
	fx := &moveFixture{
		oldWd: &model.WorkDir{Path: t.TempDir(), Status: model.WorkDirStatusActive},
		newWd: &model.WorkDir{Path: t.TempDir(), Status: model.WorkDirStatusActive},
	}
	for _, wd := range []*model.WorkDir{fx.oldWd, fx.newWd} {
		if err := model.CreateWorkDir(wd); err != nil {
			t.Fatalf("CreateWorkDir: %v", err)
		}
	}
	p, err := model.CreateProject("P", nil, fx.oldWd.ID)
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	fx.projectID = p.Project.ID

	id, err := model.NewQueueID()
	if err != nil {
		t.Fatalf("NewQueueID: %v", err)
	}
	fx.jobID = id
	outDir := filepath.Join(fx.oldWd.Path, fx.projectID, "file", "ws", id)
	if err := os.MkdirAll(outDir, 0755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	fx.jobFile = filepath.Join(outDir, "frame_0001.png")
	if err := os.WriteFile(fx.jobFile, []byte("frame"), 0644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := model.CreateJob(&model.Job{ID: id, ProjectID: fx.projectID, OutputDir: outDir, Status: model.JobCompleted}); err != nil {
		t.Fatalf("CreateJob: %v", err)
	}
	return fx
}

// waitHook はフックが done か error を知らせるまで待ち、その状態を返す。
func waitMigration(t *testing.T) func() string {
	t.Helper()
	ch := make(chan string, 16)
	prev := MigrationHook
	MigrationHook = func(_ string, status string, _ float64) {
		if status != "running" {
			ch <- status
		}
	}
	t.Cleanup(func() { MigrationHook = prev })
	return func() string {
		select {
		case s := <-ch:
			return s
		case <-time.After(10 * time.Second):
			t.Fatal("the move did not finish")
			return ""
		}
	}
}

func (fx *moveFixture) job(t *testing.T) *model.Job {
	t.Helper()
	j, err := model.GetJob(fx.jobID)
	if err != nil || j == nil {
		t.Fatalf("GetJob: %v", err)
	}
	return j
}

func (fx *moveFixture) workDirID(t *testing.T) uint {
	t.Helper()
	p, err := model.SelectProject(fx.projectID)
	if err != nil || p == nil {
		t.Fatalf("SelectProject: %v", err)
	}
	return p.WorkDirID
}

func TestMigrateProjectWorkDir(t *testing.T) {
	fx := newMoveFixture(t)
	wait := waitMigration(t)

	if err := StartMigrateProjectWorkDir(context.Background(), fx.projectID, fx.newWd.ID); err != nil {
		t.Fatalf("StartMigrateProjectWorkDir: %v", err)
	}
	if s := wait(); s != "done" {
		t.Fatalf("status = %q, want done", s)
	}

	if got := fx.workDirID(t); got != fx.newWd.ID {
		t.Errorf("WorkDirID = %d, want %d", got, fx.newWd.ID)
	}
	j := fx.job(t)
	if !model.PathWithin(j.OutputDir, fx.newWd.Path) {
		t.Errorf("OutputDir = %s, want under %s", j.OutputDir, fx.newWd.Path)
	}
	if b, err := os.ReadFile(filepath.Join(j.OutputDir, "frame_0001.png")); err != nil || string(b) != "frame" {
		t.Errorf("the copied frame = %q, %v", b, err)
	}
	if _, err := os.Stat(filepath.Join(fx.oldWd.Path, fx.projectID)); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the old folder is left: %v", err)
	}
}

// 移動先が同じ場所（別の作業ディレクトリが同じパスを指す）なら、コピーも削除もしない。
// 以前は自分自身へコピーして元を空にし、そのあと消していた。
func TestMigrateProjectWorkDirSamePath(t *testing.T) {
	fx := newMoveFixture(t)
	wait := waitMigration(t)
	same := &model.WorkDir{Path: fx.oldWd.Path + string(filepath.Separator), Status: model.WorkDirStatusActive}
	if err := model.CreateWorkDir(same); err != nil {
		t.Fatalf("CreateWorkDir: %v", err)
	}

	if err := StartMigrateProjectWorkDir(context.Background(), fx.projectID, same.ID); err != nil {
		t.Fatalf("StartMigrateProjectWorkDir: %v", err)
	}
	if s := wait(); s != "done" {
		t.Fatalf("status = %q, want done", s)
	}
	if b, err := os.ReadFile(fx.jobFile); err != nil || string(b) != "frame" {
		t.Errorf("the frame = %q, %v; want it untouched", b, err)
	}
	if got := fx.workDirID(t); got != same.ID {
		t.Errorf("WorkDirID = %d, want %d", got, same.ID)
	}
}

// まだ何も出力していないプロジェクト（フォルダが無い）も移せる。以前は WalkDir がエラーになっていた。
func TestMigrateProjectWorkDirWithoutFolder(t *testing.T) {
	fx := newMoveFixture(t)
	wait := waitMigration(t)
	if err := os.RemoveAll(filepath.Join(fx.oldWd.Path, fx.projectID)); err != nil {
		t.Fatal(err)
	}
	if err := StartMigrateProjectWorkDir(context.Background(), fx.projectID, fx.newWd.ID); err != nil {
		t.Fatalf("StartMigrateProjectWorkDir: %v", err)
	}
	if s := wait(); s != "done" {
		t.Fatalf("status = %q, want done", s)
	}
	if got := fx.workDirID(t); got != fx.newWd.ID {
		t.Errorf("WorkDirID = %d, want %d", got, fx.newWd.ID)
	}
}

func TestMigrateProjectWorkDirRefuses(t *testing.T) {
	t.Run("queued job", func(t *testing.T) {
		fx := newMoveFixture(t)
		qid, _ := model.NewQueueID()
		if err := model.CreateQueue(&model.Queue{ID: qid, ProjectID: fx.projectID, WorkspaceID: "ws", Status: "waiting"}); err != nil {
			t.Fatalf("CreateQueue: %v", err)
		}
		if err := StartMigrateProjectWorkDir(context.Background(), fx.projectID, fx.newWd.ID); err == nil {
			t.Fatal("err = nil, want an error while a job is queued")
		}
		if movingProjects[fx.projectID] {
			t.Error("the project is left marked as moving")
		}
	})
	t.Run("folder already at the destination", func(t *testing.T) {
		fx := newMoveFixture(t)
		other := filepath.Join(fx.newWd.Path, fx.projectID, "other.png")
		if err := os.MkdirAll(filepath.Dir(other), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(other, []byte("x"), 0644); err != nil {
			t.Fatal(err)
		}
		if err := StartMigrateProjectWorkDir(context.Background(), fx.projectID, fx.newWd.ID); err == nil {
			t.Fatal("err = nil, want an error")
		}
		if _, err := os.Stat(fx.jobFile); err != nil {
			t.Errorf("the source frame: %v", err)
		}
	})
	t.Run("destination inside the source", func(t *testing.T) {
		fx := newMoveFixture(t)
		inner := &model.WorkDir{Path: filepath.Join(fx.oldWd.Path, fx.projectID, "inner"), Status: model.WorkDirStatusActive}
		if err := model.CreateWorkDir(inner); err != nil {
			t.Fatal(err)
		}
		if err := StartMigrateProjectWorkDir(context.Background(), fx.projectID, inner.ID); err == nil {
			t.Fatal("err = nil, want an error")
		}
	})
	t.Run("already moving", func(t *testing.T) {
		fx := newMoveFixture(t)
		if err := beginProjectMove(fx.projectID, fx.oldWd.ID, fx.newWd.ID); err != nil {
			t.Fatalf("beginProjectMove: %v", err)
		}
		defer endProjectMove(fx.projectID, fx.oldWd.ID, fx.newWd.ID)
		if err := StartMigrateProjectWorkDir(context.Background(), fx.projectID, fx.newWd.ID); err == nil {
			t.Fatal("err = nil, want an error for the second move")
		}
		// 移動中は出力させない
		if err := checkProjectNotMoving(fx.projectID); !errors.Is(err, errProjectMoving) {
			t.Errorf("checkProjectNotMoving = %v, want errProjectMoving", err)
		}
		if _, err := writableProjectBaseDir(fx.projectID); !errors.Is(err, errProjectMoving) {
			t.Errorf("writableProjectBaseDir = %v, want errProjectMoving", err)
		}
		// 移している先の作業ディレクトリのパスも変えさせない
		if _, err := beginWorkDirChange(fx.newWd.ID); err == nil {
			t.Error("beginWorkDirChange = nil, want an error")
		}
	})
}

func TestChangeWorkDir(t *testing.T) {
	fx := newMoveFixture(t)
	ch := make(chan string, 16)
	prev := WorkDirChangeDirHook
	WorkDirChangeDirHook = func(_ uint, status string, _ float64) {
		if status != "running" {
			ch <- status
		}
	}
	t.Cleanup(func() { WorkDirChangeDirHook = prev })

	newPath := filepath.Join(t.TempDir(), "moved")
	if err := StartChangeWorkDir(context.Background(), fx.oldWd.ID, newPath); err != nil {
		t.Fatalf("StartChangeWorkDir: %v", err)
	}
	select {
	case s := <-ch:
		if s != "done" {
			t.Fatalf("status = %q, want done", s)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the change did not finish")
	}

	wd, err := model.GetWorkDir(fx.oldWd.ID)
	if err != nil || wd == nil {
		t.Fatalf("GetWorkDir: %v", err)
	}
	if wd.Path != newPath {
		t.Errorf("Path = %s, want %s", wd.Path, newPath)
	}
	j := fx.job(t)
	if b, err := os.ReadFile(filepath.Join(j.OutputDir, "frame_0001.png")); err != nil || string(b) != "frame" {
		t.Errorf("the moved frame (%s) = %q, %v", j.OutputDir, b, err)
	}
	if _, err := os.Stat(filepath.Join(fx.oldWd.Path, fx.projectID)); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the old folder is left: %v", err)
	}
	if changingWorkDirs[fx.oldWd.ID] || movingProjects[fx.projectID] {
		t.Error("the marks are left after the change")
	}
}

// コピーか DB の切り替えに失敗したら、作ったコピーを消し、元はそのまま残す。
// 以前の StartChangeWorkDir はコピーのエラーを見ずに元を消していた。
func TestRunMoveKeepsSourceOnFailure(t *testing.T) {
	mk := func(t *testing.T) moveItem {
		src := filepath.Join(t.TempDir(), "p")
		dst := filepath.Join(t.TempDir(), "p")
		for _, name := range []string{"a.png", "b.png"} {
			if err := os.MkdirAll(src, 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(src, name), []byte(name), 0644); err != nil {
				t.Fatal(err)
			}
		}
		return moveItem{src: src, dst: dst, copy: true}
	}
	check := func(t *testing.T, it moveItem) {
		t.Helper()
		for _, name := range []string{"a.png", "b.png"} {
			if b, err := os.ReadFile(filepath.Join(it.src, name)); err != nil || string(b) != name {
				t.Errorf("source %s = %q, %v", name, b, err)
			}
		}
		if _, err := os.Stat(it.dst); !errors.Is(err, os.ErrNotExist) {
			t.Errorf("the copy is left: %v", err)
		}
	}

	t.Run("copy fails", func(t *testing.T) {
		it := mk(t)
		// コピー先に同じ名前のファイルがあると copyFile は上書きせずに失敗する
		if err := os.MkdirAll(it.dst, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(it.dst, "b.png"), nil, 0644); err != nil {
			t.Fatal(err)
		}
		committed := false
		err := runMove([]moveItem{it}, func(float64) {}, func() error { committed = true; return nil })
		if err == nil {
			t.Fatal("err = nil, want the copy error")
		}
		if committed {
			t.Error("committed after the copy failed")
		}
		check(t, it)
	})
	t.Run("commit fails", func(t *testing.T) {
		it := mk(t)
		err := runMove([]moveItem{it}, func(float64) {}, func() error { return errors.New("db") })
		if err == nil {
			t.Fatal("err = nil, want the commit error")
		}
		check(t, it)
	})
}

// 区切りが違うだけの同じ場所へのパス変更は、コピーも削除もせずにパスだけ書き換え、done を知らせる
// （知らせないと画面が進捗を出したまま待ち続ける）。
func TestChangeWorkDirSamePlace(t *testing.T) {
	fx := newMoveFixture(t)
	ch := make(chan string, 16)
	prev := WorkDirChangeDirHook
	WorkDirChangeDirHook = func(_ uint, status string, _ float64) {
		if status != "running" {
			ch <- status
		}
	}
	t.Cleanup(func() { WorkDirChangeDirHook = prev })

	newPath := fx.oldWd.Path + string(filepath.Separator)
	if err := StartChangeWorkDir(context.Background(), fx.oldWd.ID, newPath); err != nil {
		t.Fatalf("StartChangeWorkDir: %v", err)
	}
	select {
	case s := <-ch:
		if s != "done" {
			t.Fatalf("status = %q, want done", s)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the change did not finish")
	}
	if b, err := os.ReadFile(fx.jobFile); err != nil || string(b) != "frame" {
		t.Errorf("the frame = %q, %v; want it untouched", b, err)
	}
	if wd, _ := model.GetWorkDir(fx.oldWd.ID); wd == nil || wd.Path != newPath {
		t.Errorf("work dir = %+v, want the path %s", wd, newPath)
	}
}
