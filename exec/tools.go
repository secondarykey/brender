package exec

import (
	"bufio"
	"embed"
	"fmt"
	"os"
	"strconv"
	"strings"
	"text/template"

	"golang.org/x/xerrors"
)

//

//go:embed _assets
var assetsEmb embed.FS

const (
	ToolFlag   = "=BRENDER PYTHON TOOL %s"
	SceneFlag  = "==SCENES %s"
	CameraFlag = "==CAMERA %s"
	StartFlag  = "START"
	EndFlag    = "END"
	FileName   = "brender-tool_*.py"
)

var (
	ToolStart   = fmt.Sprintf(ToolFlag, StartFlag)
	ToolEnd     = fmt.Sprintf(ToolFlag, EndFlag)
	SceneStart  = fmt.Sprintf(SceneFlag, StartFlag)
	SceneEnd    = fmt.Sprintf(SceneFlag, EndFlag)
	CameraStart = fmt.Sprintf(CameraFlag, StartFlag)
	CameraEnd   = fmt.Sprintf(CameraFlag, EndFlag)
)

/**
 * ツール用のPythonファイルを作成する
 */
func createToolPythonFile() (string, error) {

	tmpl, err := template.ParseFS(assetsEmb, "_assets/tools.tmpl")
	if err != nil {
		return "", xerrors.Errorf("template.ParseFS() error: %w", err)
	}

	dto := struct {
		ToolStartFlag   string
		ToolEndFlag     string
		SceneStartFlag  string
		SceneEndFlag    string
		CameraStartFlag string
		CameraEndFlag   string
	}{
		ToolStart, ToolEnd,
		SceneStart, SceneEnd,
		CameraStart, CameraEnd,
	}

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
	Scenes  []SceneTool
}

func (t Tool) ActiveScene() SceneTool {
	for _, s := range t.Scenes {
		if s.Active {
			return s
		}
	}
	return NewSceneTool()
}

type SceneTool struct {
	Active bool
	Name   string
	Start  int
	End    int
	Output string
}

func parseTool(stdout string) Tool {

	scanner := bufio.NewScanner(strings.NewReader(stdout))
	version := false
	tool := false
	scene := false
	ended := false
	rtn := Tool{}

	for scanner.Scan() {

		line := scanner.Text()

		//slog.Info(line)
		//ツール用に出力しているセパレータを判定
		switch {
		case strings.Index(line, ToolStart) == 0:
			tool = true
		case strings.Index(line, ToolEnd) == 0:
			tool = false
			ended = true
		case strings.Index(line, SceneStart) == 0:
			scene = true
		case strings.Index(line, SceneEnd) == 0:
			scene = false
		case tool:
			if scene {
				s := parseScene(line)
				rtn.Scenes = append(rtn.Scenes, s)
			}
		case !version && strings.Index(line, "Blender") == 0:
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
		default:
		}

		if ended {
			break
		}
	}

	return rtn
}

func NewSceneTool() SceneTool {
	var s SceneTool
	s.Active = false
	s.Start = -1
	s.End = -1
	s.Name = ""
	return s
}

func parseScene(line string) SceneTool {
	s := NewSceneTool()
	csv := strings.Split(line, " ")
	if len(csv) < 3 {
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
	s.Output = strings.Join(csv[4:], " ")
	return s
}
