package exec

import (
	"bufio"
	"embed"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"text/template"

	"golang.org/x/xerrors"
)

//go:embed _assets
var assetsEmb embed.FS

// ツールスクリプトのキャッシュ（プロセス起動後に1回だけ作成、存在確認付き）
var (
	toolFileMu   sync.Mutex
	toolFilePath string
)

// getToolPythonFile はキャッシュされたスクリプトファイルパスを返す。
// ファイルが存在しない場合のみ再作成する。
func getToolPythonFile() (string, error) {
	toolFileMu.Lock()
	defer toolFileMu.Unlock()

	if toolFilePath != "" {
		if _, err := os.Stat(toolFilePath); err == nil {
			return toolFilePath, nil
		}
		// ファイルが消えていたらリセットして再作成
		toolFilePath = ""
	}

	p, err := createToolPythonFile()
	if err != nil {
		return "", err
	}
	toolFilePath = p
	return p, nil
}

const (
	ToolFlag    = "=BRENDER PYTHON TOOL %s"
	Flags       = "===="
	EngineFlag  = "ENGINES"
	SceneFlag   = "SCENES"
	CameraFlag  = "CAMERA"
	SamplesFlag = "SAMPLES"
	StartFlag   = "START"
	StartStart  = "START"
	EndFlag     = "END"
	FileName    = "brender-tool_*.py"
)

var (
	ToolStart = fmt.Sprintf(ToolFlag, StartFlag)
	ToolEnd   = fmt.Sprintf(ToolFlag, EndFlag)
)

var parsers = []*parser{
	newParser(EngineFlag, func(line string) interface{} { return parseEngine(line) }),
	newParser(SceneFlag, func(line string) interface{} { return parseScene(line) }),
	newParser(CameraFlag, func(line string) interface{} { return parseCamera(line) }),
	newParser(SamplesFlag, func(line string) interface{} { return parseSamples(line) }),
}

/**
 * ツール用のPythonファイルを作成する
 */
func createToolPythonFile() (string, error) {

	tmpl, err := template.ParseFS(assetsEmb, "_assets/tools.tmpl")
	if err != nil {
		return "", xerrors.Errorf("template.ParseFS() error: %w", err)
	}

	//現状DTO なし
	dto := struct{}{}

	fp, err := os.CreateTemp("", FileName)
	if err != nil {
		return "", xerrors.Errorf("os.CreateTemp() error: %w", err)
	}
	defer fp.Close()

	err = tmpl.Execute(fp, dto)
	if err != nil {
		return "", xerrors.Errorf("template.ParseFS() error: %w", err)
	}
	return fp.Name(), nil
}

type Tool struct {
	Version string
	Build   string
	Engines []string
	Scenes  []*SceneTool
	Cameras []*CameraTool
}

func (t Tool) ActiveScene() *SceneTool {
	for _, s := range t.Scenes {
		if s.Active {
			return s
		}
	}
	return NewSceneTool()
}

type SceneTool struct {
	Active  bool
	Name    string
	Start   int
	End     int
	Camera  string
	X       int
	Y       int
	Engine  string
	Output  string
	Samples map[string]int
}

type CameraTool struct {
	Name   string
	Scenes []string
	Output string
}

type parser struct {
	Name   string
	Parser func(string) interface{}
}

func newParser(name string, fn func(string) interface{}) *parser {
	var p parser
	p.Name = name
	p.Parser = fn
	return &p
}

func parseTool(stdout string) Tool {

	scanner := bufio.NewScanner(strings.NewReader(stdout))

	version := false
	ended := false

	rtn := Tool{}

	var p *parser

	for scanner.Scan() {

		line := scanner.Text()

		switch {
		case strings.Index(line, ToolStart) == 0:
			// tool section start
		case strings.Index(line, ToolEnd) == 0:
			ended = true
		case p != nil:

			if isParseEnd(p, line) {
				p = nil
			} else {

				obj := p.Parser(line)

				if p.Name == EngineFlag {
					if v, ok := obj.(string); ok {
						rtn.Engines = append(rtn.Engines, v)
					}
				} else if p.Name == SceneFlag {
					if v, ok := obj.(*SceneTool); ok {
						rtn.Scenes = append(rtn.Scenes, v)
					}
				} else if p.Name == CameraFlag {
					if v, ok := obj.(*CameraTool); ok {
						rtn.Cameras = append(rtn.Cameras, v)
					}
				} else if p.Name == SamplesFlag {
					if v, ok := obj.([]string); ok {
						setSamples(rtn.Scenes, v)
					}
				}
			}

		default:

			if !version && strings.Index(line, "Blender") == 0 {
				csv := strings.Split(line, " ")
				if len(csv) >= 2 {
					rtn.Version = csv[1]
					version = true
					if len(csv) >= 3 {
						remain := strings.Join(csv[2:], " ")
						//"()"を除去
						rtn.Build = remain[1 : len(remain)-1]
					}
				}
			} else {
				wk := isParseStart(line)
				if wk != nil {
					p = wk
				}
			}

		}

		if ended {
			break
		}
	}

	return rtn
}

// パーサーの始点
func isParseStart(line string) *parser {
	for _, p := range parsers {
		if strings.Contains(line, fmt.Sprintf("%s %s %s", Flags, p.Name, StartStart)) {
			return p
		}
	}
	return nil
}

// パーサーの終点
func isParseEnd(p *parser, line string) bool {
	return strings.Contains(line, fmt.Sprintf("%s %s %s", Flags, p.Name, EndFlag))
}

func NewSceneTool() *SceneTool {
	var s SceneTool
	s.Active = false
	s.Start = -1
	s.End = -1
	s.Name = ""
	s.Samples = make(map[string]int)
	return &s
}

func parseScene(line string) *SceneTool {

	s := NewSceneTool()
	s.Output = line

	csv := strings.Split(line, "\t")
	if len(csv) < 8 {
		return s
	}

	if csv[0] == "1" {
		s.Active = true
	}

	v, _ := strconv.Atoi(csv[1])
	s.Start = v
	v, _ = strconv.Atoi(csv[2])
	s.End = v

	s.Name = csv[3]

	s.Camera = csv[4]
	v, _ = strconv.Atoi(csv[5])
	s.X = v
	v, _ = strconv.Atoi(csv[6])
	s.Y = v

	s.Engine = csv[7]

	return s
}

func setSamples(scenes []*SceneTool, vals []string) {
	// Python の printSamples() はシーンと同順で1行ずつ出力する
	// vals: [workbench_aa, eevee_samples, cycles_samples]
	if len(vals) < 3 || len(scenes) == 0 {
		return
	}
	scene := scenes[len(scenes)-1] // 直近に追加されたシーンに対応
	toInt := func(s string) int {
		v, _ := strconv.Atoi(s)
		return v
	}
	scene.Samples["WORKBENCH"] = toInt(vals[0])
	scene.Samples["EEVEE"] = toInt(vals[1])
	scene.Samples["CYCLES"] = toInt(vals[2])
}

func parseEngine(line string) string {
	return strings.TrimSpace(line)
}

func parseSamples(line string) []string {
	return strings.Split(line, "\t")
}

func NewCameraTool() *CameraTool {
	var c CameraTool
	c.Name = ""
	c.Scenes = nil
	return &c
}

func parseCamera(line string) *CameraTool {

	c := NewCameraTool()
	c.Output = line

	csv := strings.Split(line, "\t")
	if len(csv) < 2 {
		return c
	}

	c.Name = csv[0]
	c.Scenes = strings.Split(csv[1], ",")

	return c
}
