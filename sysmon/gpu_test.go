package sysmon

import (
	"testing"
)

func TestParseNvidiaSmiOutput(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		want   int
		wantOK bool
	}{
		{
			name:   "single GPU",
			input:  "0, NVIDIA GeForce RTX 4090, 45, 24564, 1234, 62",
			want:   1,
			wantOK: true,
		},
		{
			name: "multi GPU",
			input: "0, NVIDIA GeForce RTX 4090, 45, 24564, 1234, 62\n" +
				"1, NVIDIA GeForce RTX 3080, 30, 10240, 5120, 55",
			want:   2,
			wantOK: true,
		},
		{
			name:   "empty",
			input:  "",
			want:   0,
			wantOK: false,
		},
		{
			name:   "too few fields",
			input:  "0, NVIDIA, 45",
			want:   0,
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gpus := parseNvidiaSmiOutput(tt.input)
			if tt.wantOK && len(gpus) != tt.want {
				t.Errorf("got %d GPUs, want %d", len(gpus), tt.want)
			}
			if !tt.wantOK && len(gpus) != 0 {
				t.Errorf("got %d GPUs, want 0", len(gpus))
			}
		})
	}
}

func TestParseNvidiaSmiFields(t *testing.T) {
	gpus := parseNvidiaSmiOutput("0, NVIDIA GeForce RTX 4090, 45, 24564, 1234, 62")
	if len(gpus) != 1 {
		t.Fatalf("expected 1 GPU, got %d", len(gpus))
	}

	g := gpus[0]
	if g.Index != 0 {
		t.Errorf("Index: got %d, want 0", g.Index)
	}
	if g.Name != "NVIDIA GeForce RTX 4090" {
		t.Errorf("Name: got %q, want %q", g.Name, "NVIDIA GeForce RTX 4090")
	}
	if g.Usage != 45 {
		t.Errorf("Usage: got %f, want 45", g.Usage)
	}
	if g.MemTotalMB != 24564 {
		t.Errorf("MemTotalMB: got %d, want 24564", g.MemTotalMB)
	}
	if g.MemUsedMB != 1234 {
		t.Errorf("MemUsedMB: got %d, want 1234", g.MemUsedMB)
	}
	if g.Temperature != 62 {
		t.Errorf("Temperature: got %d, want 62", g.Temperature)
	}

	expectedMemUsage := float64(1234) / float64(24564) * 100
	if g.MemUsage < expectedMemUsage-0.01 || g.MemUsage > expectedMemUsage+0.01 {
		t.Errorf("MemUsage: got %f, want ~%f", g.MemUsage, expectedMemUsage)
	}
}

func TestCollectGPUNoNvidiaSmi(t *testing.T) {
	origPath := nvidiaSmiPath
	nvidiaSmiPath = ""
	defer func() { nvidiaSmiPath = origPath }()

	available, gpus := collectGPU()
	if available {
		t.Error("should return false when nvidia-smi is not available")
	}
	if len(gpus) != 0 {
		t.Error("should return empty slice when nvidia-smi is not available")
	}
}
