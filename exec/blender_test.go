package exec_test

import (
	"testing"

	"github.com/secondarykey/brender/exec"
)

func TestVersion(t *testing.T) {

	b, err := exec.NewBlender("D:\\Blender Foundation\\Blender 3.6\\blender.exe")
	if err != nil {
		t.Fatalf("exec.RunVersion() error not nil: %v", err)
	}
	v := b.Version()
	if v != "3.6.1" {
		t.Errorf("exec.RunVersion() want [3.6.1] got [%s]", v)
	}

	b, err = exec.NewBlender("D:\\Blender Foundation\\Blender 4.0\\blender.exe")
	if err != nil {
		t.Fatalf("exec.RunVersion() error not nil: %v", err)
	}
	v = b.Version()
	if v != "4.0.1" {
		t.Errorf("exec.RunVersion() want [4.0.1] got [%s]", v)
	}
}
