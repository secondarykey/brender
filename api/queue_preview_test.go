package api

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/secondarykey/brender/model"
)

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

// 前回のレンダリングがファイルを読んだ時刻は、動き始めた時刻（無ければキューに入れた時刻）。
func TestRenderReadAt(t *testing.T) {
	enq := time.Date(2026, 1, 2, 3, 0, 0, 0, time.Local)
	start := enq.Add(time.Hour)

	if got := renderReadAt(nil); got != nil {
		t.Errorf("前回なし: got %v, want nil", got)
	}
	if got := renderReadAt(&model.Job{EnqueuedAt: &enq, StartedAt: &start}); got == nil || !got.Equal(start) {
		t.Errorf("動き始めた時刻: got %v, want %v", got, start)
	}
	if got := renderReadAt(&model.Job{EnqueuedAt: &enq}); got == nil || !got.Equal(enq) {
		t.Errorf("StartedAt なし: got %v, want %v", got, enq)
	}
}
