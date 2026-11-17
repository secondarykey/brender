package services

import (
	"path/filepath"
	"testing"
)

func TestHasBackgroundArg(t *testing.T) {
	tests := []struct {
		args []string
		want bool
	}{
		{nil, false},
		{[]string{"--background"}, true},
		{[]string{"-background"}, true},
		{[]string{"--other", "--background"}, true},
		{[]string{"background"}, false},
		{[]string{"--backgrounds"}, false},
	}
	for _, tt := range tests {
		if got := HasBackgroundArg(tt.args); got != tt.want {
			t.Errorf("HasBackgroundArg(%v) = %v, want %v", tt.args, got, tt.want)
		}
	}
}

// 同じ DB なら同じ ID（二重起動として止める）、違う DB なら違う ID（並べて動かせる）。
func TestInstanceID(t *testing.T) {
	dir := t.TempDir()
	a := filepath.Join(dir, "brender.db")
	b := filepath.Join(dir, "other.db")

	if instanceID(a, "windows") != instanceID(filepath.Join(dir, ".", "brender.db"), "windows") {
		t.Error("同じパスの書き方違いで ID が変わった")
	}
	if instanceID(a, "windows") == instanceID(b, "windows") {
		t.Error("違う DB で ID が同じ")
	}
	// Windows・macOS は大文字小文字を区別しない
	upper := filepath.Join(dir, "BRENDER.DB")
	if instanceID(a, "windows") != instanceID(upper, "windows") {
		t.Error("Windows で大文字小文字の違いで ID が変わった")
	}
	if instanceID(a, "linux") == instanceID(upper, "linux") {
		t.Error("Linux で大文字小文字の違うパスが同じ ID になった")
	}
}
