package exec

import (
	"strings"
)

// エンジン種別の内部キー。EngineFlags() の判定ロジックと対応。
const (
	EngineKeyCycles    = "CYCLES"
	EngineKeyEevee     = "EEVEE"
	EngineKeyWorkbench = "WORKBENCH"
)

// EngineFlags はエンジン名から IsXxx フラグを返す。
func EngineFlags(engine string) (isCycles, isEevee, isWorkbench bool) {
	e := strings.ToUpper(engine)
	isCycles = strings.Contains(e, "CYCLES")
	isEevee = strings.Contains(e, "EEVEE")
	isWorkbench = strings.Contains(e, "WORKBENCH")
	return
}

/*
var (
	runFileMu   sync.Mutex
	runFilePath string
)
*/

type Run struct {
	Camera     *RunCamera
	Samples    *RunSamples
	Resolution *RunResolution
}

type RunCamera struct {
	Set   bool   //設定をする
	Scene string //カメラのシーン
	Name  string //設定カメラ名
}

type RunSamples struct {
	Set         bool   //設定をする
	Scene       string //設定のシーン
	Value       int    //設定サンプル数
	IsCycles    bool
	IsEevee     bool
	IsWorkbench bool
}

type RunResolution struct {
	Set   bool   // 設定をする
	Scene string // 設定のシーン
	X     int    // 解像度 X
	Y     int    // 解像度 Y
}

func NewRunScript() *Run {
	var run Run

	run.Camera = newRunCamera()
	run.Samples = newRunSamples()
	run.Resolution = newRunResolution()

	return &run
}

func newRunResolution() *RunResolution {
	var r RunResolution
	r.Set = false
	r.Scene = ""
	r.X = 0
	r.Y = 0
	return &r
}

func newRunCamera() *RunCamera {
	var cam RunCamera

	cam.Set = false
	cam.Scene = ""
	cam.Name = ""

	return &cam
}

func newRunSamples() *RunSamples {

	var samples RunSamples
	samples.Set = false
	samples.IsCycles = false
	samples.IsEevee = false
	samples.IsWorkbench = false

	samples.Scene = ""
	samples.Value = 0
	return &samples
}

// GetRunPythonFile はレンダリング実行時に渡す Python スクリプトのパスを返す。
// ファイルが存在しない場合のみ再作成する。
func GetRunPythonFile(dto *Run) (string, error) {

	/*
		runFileMu.Lock()
		defer runFileMu.Unlock()

		if runFilePath != "" {
			if _, err := os.Stat(runFilePath); err == nil {
				return runFilePath, nil
			}
			runFilePath = ""
		}
	*/

	p, err := createRunPythonFile(dto)
	if err != nil {
		return "", err
	}
	//runFilePath = p
	return p, nil
}

/**
 * レンダリング実行用のPythonファイルを作成する
 */
func createRunPythonFile(dto *Run) (string, error) {
	return createScript("run.tmpl", "run_*.py", dto)
}
