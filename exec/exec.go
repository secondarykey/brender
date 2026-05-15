package exec

import (
	"bufio"
	"context"
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
func ResolveScene(cmd, filePath, scene string) (*SceneTool, error) {
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

func RunToolData(cmd, filePath string) (*Tool, error) {
	b, err := NewBlender(cmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender: %w", err)
	}
	b.File = filePath
	if err := b.RunTool(); err != nil {
		return nil, xerrors.Errorf("RunTool: %w", err)
	}
	return &b.Tool, nil
}

func RunCameras(cmd, filePath string) ([]*CameraTool, error) {
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

// RunEnginesFromTool は Python ツール経由でレンダリングエンジン一覧を取得する。
// filePath には解析対象の .blend ファイルパスを渡す。
func RunEnginesFromTool(cmd, filePath string) ([]string, error) {
	b, err := NewBlender(cmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender: %w", err)
	}
	b.File = filePath
	if err := b.RunTool(); err != nil {
		return nil, xerrors.Errorf("RunTool: %w", err)
	}
	return b.Tool.Engines, nil
}

// Deprecated: RunEngines は Blender 4.5 以降で -E help -b がクラッシュするため使用不可。
// RunEnginesFromTool を使うこと。
func RunEngines(cmd string) ([]string, error) {

	b, err := NewBlender(cmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender() error: %w", err)
	}

	var w strings.Builder
	b.Writer = &w
	b.ErrorWriter = &w

	ctx := context.Background()
	ch, err := b.RunAsync(ctx, "-E", "help", "-b")
	if err != nil {
		return nil, xerrors.Errorf("blender command error: %w", err)
	}

	err = <-ch
	if err != nil && !strings.Contains(w.String(), "Blender Engine Listing:") {
		return nil, xerrors.Errorf("blender running error: %w", err)
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
