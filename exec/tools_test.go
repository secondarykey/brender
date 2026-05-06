package exec_test

import (
	"os"
	"testing"

	"github.com/ikascrew/brender/exec"
)

func TestToolFile(t *testing.T) {

	p, err := exec.ExportCreateToolPythonFile()
	if err != nil {
		t.Errorf("CreateToolPython() not nil %v", err)
	}

	_, err = os.Stat(p)
	if err != nil {
		t.Errorf("python file is not exists: %v", err)
	}
}
