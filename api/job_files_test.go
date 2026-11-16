package api

import (
	"os"
	"path/filepath"
	"testing"
)

// 画像だけでなくログ・動画・サブフォルダのファイルも数える（ジョブを消したときに空く量と合わせる）。
func TestDirSize(t *testing.T) {
	dir := t.TempDir()
	files := map[string]int{
		"frame_0001.png":     100,
		"render.log":         20,
		"movie.mp4":          300,
		"sub/frame_0002.jpg": 4,
	}
	var want int64
	for name, size := range files {
		p := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, make([]byte, size), 0o644); err != nil {
			t.Fatal(err)
		}
		want += int64(size)
	}
	if got := dirSize(dir); got != want {
		t.Errorf("dirSize = %d, want %d", got, want)
	}
	if got := dirSize(filepath.Join(dir, "missing")); got != 0 {
		t.Errorf("dirSize(missing) = %d, want 0", got)
	}
}
