package exec

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

/**
 * 文字列（-v 出力）からバージョンを抜き出す
 */
func parseVersion(b *strings.Builder) (string, error) {

	r := strings.NewReader(b.String())
	s := bufio.NewScanner(r)
	for s.Scan() {
		line := s.Text()
		if strings.Index(line, "Blender") == 0 {
			sl := strings.Split(line, " ")
			if len(sl) >= 2 {
				return sl[1], nil
			}
		}
	}
	return "-", nil
}

/**
 * Blender のエンジンリストを取得する
 */
func RunScenes(cmd, filePath string) ([]string, error) {
	b, err := NewBlender(cmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender: %w", err)
	}
	b.File = filePath
	if err := b.RunTool(); err != nil {
		return nil, xerrors.Errorf("RunTool: %w", err)
	}
	names := make([]string, 0, len(b.Tool.Scenes))
	for _, s := range b.Tool.Scenes {
		names = append(names, s.Name)
	}
	return names, nil
}

// ResolveScene は .blend ファイルを Tool で解析し指定シーンの情報を返す。
// scene が空の場合はアクティブシーンを使用する。
// シーン名が指定されていて存在しない場合はエラーを返す。
func ResolveScene(cmd, filePath, scene string) (SceneTool, error) {
	b, err := NewBlender(cmd)
	if err != nil {
		return NewSceneTool(), xerrors.Errorf("NewBlender: %w", err)
	}
	b.File = filePath
	if err := b.RunTool(); err != nil {
		return NewSceneTool(), xerrors.Errorf("RunTool: %w", err)
	}
	if scene != "" {
		for _, s := range b.Tool.Scenes {
			if s.Name == scene {
				return s, nil
			}
		}
		return NewSceneTool(), xerrors.Errorf("シーン '%s' が .blend ファイルに存在しません", scene)
	}
	st := b.Tool.ActiveScene()
	if st.Start == -1 {
		return st, xerrors.New("アクティブシーンが見つかりません")
	}
	return st, nil
}

// ResolveFrameRange は後方互換のためのラッパー
func ResolveFrameRange(cmd, filePath, scene string) (start, end int, err error) {
	st, err := ResolveScene(cmd, filePath, scene)
	return st.Start, st.End, err
}

func RunCameras(cmd, filePath string) ([]CameraTool, error) {
	b, err := NewBlender(cmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender: %w", err)
	}
	b.File = filePath
	if err := b.RunTool(); err != nil {
		return nil, xerrors.Errorf("RunTool: %w", err)
	}
	return b.Tool.Cameras, nil
}

func RunEngines(cmd string) ([]string, error) {

	b, err := NewBlender(cmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender() error: %w", err)
	}

	var w strings.Builder
	b.Writer = &w
	b.ErrorWriter = &w

	err = b.Run("-E", "help", "-b")
	if err != nil {
		return nil, xerrors.Errorf("blender command error: %w", err)
	}

	return parseEngines(&w)
}

/**
 * 文字列（-E help -b 出力）からエンジンリストを抜き出す
 */
func parseEngines(b *strings.Builder) ([]string, error) {

	r := strings.NewReader(b.String())
	s := bufio.NewScanner(r)

	engines := make([]string, 0, 10)
	start := false
	for s.Scan() {
		line := s.Text()
		if strings.Index(line, "Blender Engine Listing:") == 0 {
			start = true
		} else if start {
			engines = append(engines, strings.Trim(line, " \t"))
		}
	}
	return engines, nil
}

func IsProjectThumbnailLock(pId string) bool {
	logDir := getLogDir(pId)
	lockFile := filepath.Join(logDir, ProjectThumbJobName+".lock")
	if _, err := os.Stat(lockFile); err == nil {
		return true
	}
	return false
}

func IsWorkspaceThumbnailLock(pId string, wId string) bool {
	logDir := getLogDir(pId)
	jobId := fmt.Sprintf(WorkspaceThumbJobName, wId)
	lockFile := filepath.Join(logDir, jobId+".lock")
	if _, err := os.Stat(lockFile); err == nil {
		return true
	}
	return false
}

func getWorkspaceRenderingFile(pId string, wId string) string {
	logDir := getLogDir(pId)
	reg := fmt.Sprintf(RenderingJobNameGlob, wId)

	files, err := filepath.Glob(filepath.Join(logDir, reg))
	if err != nil {
		return ""
	}

	if len(files) == 0 {
		return ""
	}
	if len(files) > 1 {
		log.Println("LockFile duplicate")
	}
	return files[0]
}

func IsWorkspaceRendering(pId string, wId string) bool {
	file := getWorkspaceRenderingFile(pId, wId)
	if file == "" {
		return false
	}
	return true
}

func GetRenderingTime(pId string, wId string) *RenderingTime {
	file := getWorkspaceRenderingFile(pId, wId)
	if file == "" {
		return nil
	}
	rt, err := createRenderingTime(file)
	if err != nil {
		return nil
	}
	return rt
}

func GetBlenderFile(p *model.Project) string {
	f, err := model.FirstFile(p.ID)
	if err != nil || f == nil {
		return ""
	}
	return f.Path
}

func generateDateId() string {
	return time.Now().Format("20060102150405")
}
