package main

import (
	"runtime/debug"
	"testing"
)

func TestDevVersion(t *testing.T) {
	tests := []struct {
		name     string
		settings []debug.BuildSetting
		want     string
	}{
		{"no vcs", nil, "dev"},
		{"clean", []debug.BuildSetting{{Key: "vcs.revision", Value: "1a2b3c4d5e6f"}, {Key: "vcs.modified", Value: "false"}}, "dev (1a2b3c4)"},
		{"modified", []debug.BuildSetting{{Key: "vcs.revision", Value: "1a2b3c4d5e6f"}, {Key: "vcs.modified", Value: "true"}}, "dev (1a2b3c4, modified)"},
		{"short", []debug.BuildSetting{{Key: "vcs.revision", Value: "abc"}}, "dev (abc)"},
	}
	for _, tt := range tests {
		if got := devVersion(tt.settings); got != tt.want {
			t.Errorf("%s: devVersion() = %q, want %q", tt.name, got, tt.want)
		}
	}
}

func TestAppVersionUsesLdflags(t *testing.T) {
	old := version
	defer func() { version = old }()

	version = "0.4.1"
	if got := appVersion(); got != "0.4.1" {
		t.Errorf("appVersion() = %q, want 0.4.1", got)
	}
}
