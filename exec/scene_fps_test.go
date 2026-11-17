package exec_test

import (
	"testing"

	"github.com/secondarykey/brender/exec"
)

func TestParseSceneFPS(t *testing.T) {
	cases := []struct {
		name string
		line string
		want float64
	}{
		{"24fps", "1\t1\t250\tScene\tCamera\t1920\t1080\tCYCLES\t24.000", 24},
		{"NTSC", "0\t1\t100\tScene.001\tCamera\t1920\t1080\tBLENDER_EEVEE\t29.970", 29.97},
		{"古いスクリプトの出力（FPS なし）", "1\t1\t250\tScene\tCamera\t1920\t1080\tCYCLES", 0},
		{"読めない値", "1\t1\t250\tScene\tCamera\t1920\t1080\tCYCLES\tx", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := exec.ExportParseScene(c.line)
			if s.FPS != c.want {
				t.Errorf("FPS = %v, want %v", s.FPS, c.want)
			}
			if s.Start != 1 || s.Name == "" {
				t.Errorf("他の項目が読めていない: %+v", s)
			}
		})
	}
}
