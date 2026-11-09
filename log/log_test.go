package log_test

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/secondarykey/brender/log"
	"gorm.io/gorm"
)

// recordHandler は受け取った Record を貯めるハンドラ。
type recordHandler struct {
	level   slog.Level
	records *[]slog.Record
	attrs   []slog.Attr
}

func (h *recordHandler) Enabled(_ context.Context, l slog.Level) bool { return l >= h.level }
func (h *recordHandler) Handle(_ context.Context, r slog.Record) error {
	r = r.Clone()
	r.AddAttrs(h.attrs...)
	*h.records = append(*h.records, r)
	return nil
}
func (h *recordHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	nh := *h
	nh.attrs = append(append([]slog.Attr{}, h.attrs...), attrs...)
	return &nh
}
func (h *recordHandler) WithGroup(string) slog.Handler { return h }

// useRecorder は SetLogger で出し先を貯めるハンドラにする（テストの終わりに戻す）。
func useRecorder(t *testing.T, lv slog.Level) *[]slog.Record {
	t.Helper()
	var rs []slog.Record
	log.SetLogger(slog.New(&recordHandler{level: lv, records: &rs}))
	t.Cleanup(func() { log.SetLogger(nil) })
	return &rs
}

func attrsOf(r slog.Record) map[string]string {
	m := map[string]string{}
	r.Attrs(func(a slog.Attr) bool {
		m[a.Key] = a.Value.String()
		return true
	})
	return m
}

// 記録される位置が、ここの関数を呼んだ側になること（間に関数を挟むとこの log パッケージになる）。
func TestCallerIsTheCaller(t *testing.T) {
	rs := useRecorder(t, log.LevelTrace)

	log.Info("kv")
	log.Errorf("f %d", 1)

	if len(*rs) != 2 {
		t.Fatalf("records = %d, want 2", len(*rs))
	}
	for _, r := range *rs {
		f, _ := runtime.CallersFrames([]uintptr{r.PC}).Next() // slog の AddSource と同じ見方（インライン展開も呼び出し元で返す）
		fn := f.Function
		if !strings.HasSuffix(fn, ".TestCallerIsTheCaller") {
			t.Errorf("%q: caller = %q, want TestCallerIsTheCaller", r.Message, fn)
		}
	}
}

// Info はキーと値、Infof は printf の形。
func TestForms(t *testing.T) {
	rs := useRecorder(t, log.LevelTrace)

	log.Notice("saved", "path", "a.blend", "n", 3)
	log.Warnf("%d frames", 10)

	r := (*rs)[0]
	if r.Message != "saved" || r.Level != log.LevelNotice {
		t.Errorf("kv: msg=%q level=%v", r.Message, r.Level)
	}
	if a := attrsOf(r); a["path"] != "a.blend" || a["n"] != "3" {
		t.Errorf("kv attrs = %v", a)
	}
	if r := (*rs)[1]; r.Message != "10 frames" || r.Level != log.LevelWarn {
		t.Errorf("printf: msg=%q level=%v", r.Message, r.Level)
	}
}

// 出し先のレベルより下は出さないこと。
func TestLevelCut(t *testing.T) {
	rs := useRecorder(t, log.LevelNotice)

	log.Info("drop")
	log.Debugf("drop %d", 1)
	log.Notice("keep")

	if len(*rs) != 1 || (*rs)[0].Message != "keep" {
		t.Fatalf("records = %v", *rs)
	}
	if log.Enabled(log.LevelInfo) || !log.Enabled(log.LevelNotice) {
		t.Errorf("Enabled does not follow the logger level")
	}
}

// SetLogger をしなければ slog.Default() に出ること。
func TestDefaultLogger(t *testing.T) {
	var rs []slog.Record
	old := slog.Default()
	slog.SetDefault(slog.New(&recordHandler{level: log.LevelTrace, records: &rs}))
	t.Cleanup(func() { slog.SetDefault(old) })

	log.Info("to default")

	if len(rs) != 1 || rs[0].Message != "to default" {
		t.Fatalf("records = %v", rs)
	}
}

// GORM のログに logger=db の印が付くこと。
func TestDBLogger(t *testing.T) {
	rs := useRecorder(t, log.LevelTrace)

	db := log.NewDBLogger()
	db.Trace(context.Background(), time.Now(), func() (string, int64) { return "SELECT 1", 1 }, nil)
	db.Trace(context.Background(), time.Now(), func() (string, int64) { return "SELECT 2", 0 }, gorm.ErrRecordNotFound)

	if len(*rs) != 3 {
		t.Fatalf("records = %d, want 3", len(*rs))
	}
	if r := (*rs)[0]; r.Message != "SQL:SELECT 1" || attrsOf(r)["logger"] != log.DBName {
		t.Errorf("record = %q %v", r.Message, attrsOf(r))
	}
	if r := (*rs)[2]; r.Message != "NotFound SQL:SELECT 2" || r.Level != log.LevelInfo {
		t.Errorf("not found = %q %v", r.Message, r.Level)
	}
}

// Init は Dir/<Prefix>_<日付>.log に書き、SetLevel で出すレベルが変わること。
func TestInitWritesFile(t *testing.T) {
	old := slog.Default()
	t.Cleanup(func() { slog.SetDefault(old) })
	dir := t.TempDir()

	c, err := log.Init(log.Options{Dir: dir, Prefix: "test", Root: log.LevelNotice})
	if err != nil {
		t.Fatalf("Init() error: %v", err)
	}
	log.Info("hidden")
	log.Noticef("shown %d", 1)
	log.SetLevel(log.LevelInfo)
	log.Info("now shown", "k", "v")
	if log.GetLevel() != log.LevelInfo {
		t.Errorf("GetLevel() = %v", log.GetLevel())
	}

	path := log.Path()
	want := filepath.Join(dir, "test_"+time.Now().Format("20060102")+".log")
	if path != want {
		t.Errorf("Path() = %q, want %q", path, want)
	}
	if err := c.Close(); err != nil { // Windows では閉じてから一時フォルダを消す
		t.Fatalf("Close() error: %v", err)
	}

	b, err := os.ReadFile(want)
	if err != nil {
		t.Fatalf("ReadFile() error: %v", err)
	}
	out := string(b)
	if strings.Contains(out, "hidden") {
		t.Errorf("Info was written under Notice: %q", out)
	}
	if !strings.Contains(out, "[NOTICE] shown 1") || !strings.Contains(out, "now shown k=v") {
		t.Errorf("unexpected log: %q", out)
	}
}

// フォルダを作れなくても止まらず、error を返して出せる出口で組むこと。
func TestInitBadDir(t *testing.T) {
	old := slog.Default()
	t.Cleanup(func() { slog.SetDefault(old) })
	f := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(f, nil, 0644); err != nil {
		t.Fatal(err)
	}

	c, err := log.Init(log.Options{Dir: filepath.Join(f, "sub")})
	if err == nil {
		t.Errorf("Init() error = nil, want error")
	}
	if c == nil {
		t.Fatalf("Init() closer = nil")
	}
	c.Close()
	log.Info("still works")
}
