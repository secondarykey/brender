package exec_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/ikascrew/brender/exec"
)

func TestEngines(t *testing.T) {

	engines, err := exec.RunEngines("D:\\Blender Foundation\\Blender 4.5\\blender.exe")
	if err != nil {
		t.Fatalf("exec.RunEngines() error not nil: %v", err)
	}

	if len(engines) != 3 {
		t.Errorf("exec.RunEngines() length want [%d] got [%d]", 3, len(engines))
	}

	err = matchSlice(engines, "BLENDER_EEVEE", "BLENDER_WORKBENCH", "CYCLES")
	if err != nil {
		t.Errorf("exec.RunEngines() match slice error [%v] ", err)
	}

}

func matchSlice(src []string, vals ...string) error {
	var err error
	for _, v1 := range vals {
		e := false
		for _, v2 := range src {
			if v1 == v2 {
				e = true
				break
			}
		}
		if !e {
			err = errors.Join(err, fmt.Errorf("%s not found", v1))
		}
	}
	return err
}
