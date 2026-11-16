package model

import (
	"path/filepath"
	"runtime"
	"testing"
)

func TestRebasePath(t *testing.T) {
	j := filepath.Join
	root := filepath.FromSlash("/work")
	if runtime.GOOS == "windows" {
		root = `D:\work`
	}
	tests := []struct {
		name        string
		p, old, new string
		want        string
		wantOK      bool
	}{
		{"under the base", j(root, "p", "job"), root, j(root + "2"), j(root+"2", "p", "job"), true},
		{"the base itself", root, root, j(root + "2"), j(root + "2"), true},
		{"a sibling with the same prefix", j(root+"2", "p"), root, j(root + "3"), "", false},
		{"slash in the stored base", j(root, "p"), filepath.ToSlash(root) + "/", j(root + "2"), j(root+"2", "p"), true},
		{"empty", "", root, j(root + "2"), "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := RebasePath(tt.p, tt.old, tt.new)
			if got != tt.want || ok != tt.wantOK {
				t.Errorf("RebasePath(%q, %q, %q) = %q, %v; want %q, %v", tt.p, tt.old, tt.new, got, ok, tt.want, tt.wantOK)
			}
		})
	}
	if runtime.GOOS == "windows" {
		if _, ok := RebasePath(`d:\WORK\p`, `D:\work`, `E:\x`); !ok {
			t.Error("Windows paths should match regardless of case")
		}
	}
}
