package exec_test

import (
	"os"
	"strings"
	"testing"

	"github.com/secondarykey/brender/exec"
)

// シーン名・カメラ名は利用者が決められるので、引用符を含む名前で Python のコードを
// 差し込めないこと（文字列リテラルとして埋まること）を見る。
const evilName = `x"); import os; os.system("calc"); ("`

// escapedEvil は evilName を Python の文字列リテラルにしたもの（引用符がエスケープされる）。
const escapedEvil = `"x\"); import os; os.system(\"calc\"); (\""`

func TestRunScriptEscapesNames(t *testing.T) {
	run := exec.NewRunScript()
	run.Camera.Set = true
	run.Camera.Scene = evilName
	run.Camera.Name = evilName
	run.Samples.Set = true
	run.Samples.Scene = evilName
	run.Samples.Value = 8
	run.Samples.IsCycles = true
	run.Resolution.Set = true
	run.Resolution.Scene = evilName
	run.Resolution.X = 640
	run.Resolution.Y = 360

	p, err := exec.GetRunPythonFile(run)
	if err != nil {
		t.Fatalf("GetRunPythonFile: %v", err)
	}
	checkEscaped(t, p)
}

func TestSamplesComparisonScriptEscapesNames(t *testing.T) {
	p, err := exec.GetSamplesComparisonPythonFile(&exec.SamplesComparisonRun{
		Scene:       evilName,
		Frame:       1,
		SamplesList: "1,2",
		IsCycles:    true,
		OutputDir:   `C:\out\` + evilName,
		Camera:      evilName,
		Engine:      evilName,
		Format:      evilName,
	})
	if err != nil {
		t.Fatalf("GetSamplesComparisonPythonFile: %v", err)
	}
	checkEscaped(t, p)
}

func checkEscaped(t *testing.T, path string) {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	src := string(b)
	if strings.Contains(src, `"`+evilName+`"`) || strings.Contains(src, `'`+evilName+`'`) {
		t.Errorf("name is embedded without escaping:\n%s", src)
	}
	if !strings.Contains(src, escapedEvil) {
		t.Errorf("escaped literal %s not found:\n%s", escapedEvil, src)
	}
	// コードとして差し込まれた行（行の頭の import）が無いこと
	for _, line := range strings.Split(src, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "import os") {
			t.Errorf("injected line found: %q", line)
		}
	}
}
