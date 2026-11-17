package api

import "testing"

func TestResolveFPS(t *testing.T) {
	cases := []struct {
		name      string
		workspace float64
		scene     float64
		want      float64
	}{
		{"ワークスペースの指定を優先", 60, 24, 60},
		{"空ならシーンの値", 0, 29.97, 29.97},
		{"どちらも無ければ 0", 0, 0, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := resolveFPS(c.workspace, c.scene); got != c.want {
				t.Errorf("resolveFPS(%v, %v) = %v, want %v", c.workspace, c.scene, got, c.want)
			}
		})
	}
}
