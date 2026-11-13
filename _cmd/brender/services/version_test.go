package services

import "testing"

func TestRunVersion(t *testing.T) {
	tests := []struct {
		raw  string
		dev  bool
		want string
	}{
		{"0.4.0", false, "0.4.0"},
		{"0.4.0\n", false, "0.4.0"},
		{"0.4.0", true, "0.4.1"},
		{" 1.2.9\r\n", true, "1.2.10"},
		{"0.4", true, "0.4"},
		{"0.4.x", true, "0.4.x"},
		{"", true, ""},
	}
	for _, tt := range tests {
		if got := RunVersion(tt.raw, tt.dev); got != tt.want {
			t.Errorf("RunVersion(%q, %v) = %q, want %q", tt.raw, tt.dev, got, tt.want)
		}
	}
}
