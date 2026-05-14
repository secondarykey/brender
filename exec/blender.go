package exec

import (
	"context"
	"fmt"
	"io"
	"runtime"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

type Blender struct {
	cmd     string
	version string
	Python  string

	Start int
	End   int

	Thread int

	File   string
	Result string

	Writer      io.Writer
	ErrorWriter io.Writer

	Scene     string
	Engine    string
	Skip      int
	RunScript string // レンダリング実行時に渡す Python スクリプト（-P）

	Tool Tool
}

func NewBlender(cmd string) (*Blender, error) {

	var b Blender

	b.cmd = cmd
	b.Start = -1
	b.End = -1
	b.Thread = 0

	return &b, nil
}

/**
 * Blenderのバージョンを取得する
 */
func (b *Blender) runVersion() error {

	beforeW := b.Writer
	beforeEW := b.ErrorWriter

	var w strings.Builder
	b.Writer = &w
	b.ErrorWriter = &w

	err := b.Run("-v")
	if err != nil {
		return xerrors.Errorf("blender run() error: %w", err)
	}

	v, err := parseVersion(&w)
	if err != nil {
		return xerrors.Errorf("parseVersion() error: %w", err)
	}
	b.version = v

	//戻す
	b.Writer = beforeW
	b.ErrorWriter = beforeEW
	return nil
}

func (b *Blender) Version() string {
	if b.version == "" {
		b.runVersion()
	}
	return b.version
}

func (b *Blender) SetFrame(f int) {
	b.Start = f
	b.End = f
}

// 同期実行
func (b *Blender) Run(args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, errCh, err := b.run(ctx, args...)
	if err != nil {
		return xerrors.Errorf("blender command error: %w", err)
	}
	err = <-errCh
	if err != nil {
		return xerrors.Errorf("blender running error: %w", err)
	}
	return nil
}

func (b *Blender) RunAsync(ctx context.Context, args ...string) (chan error, error) {
	_, errCh, err := b.run(ctx, args...)
	return errCh, err
}

// RunWithPID はBlenderを非同期実行しPIDとエラーチャネルを返す
func (b *Blender) RunWithPID(ctx context.Context) (int, chan error, error) {
	return b.run(ctx)
}

func (b *Blender) run(ctx context.Context, args ...string) (int, chan error, error) {
	if args == nil {
		args = b.createArguments()
	}
	return runCommand(ctx, b.Writer, b.ErrorWriter, b.cmd, args...)
}

func (b *Blender) createArguments() []string {

	args := make([]string, 0, 20)
	// -b は常に必要（バックグラウンドモード）
	args = append(args, "-b")
	if b.File != "" {
		args = append(args, b.File)
	}

	if b.Python != "" {
		args = append(args, "-P")
		args = append(args, b.Python)
		return args
	}

	// レンダリング実行時スクリプト（ツール専用モードでない通常レンダー時のみ）
	if b.RunScript != "" {
		args = append(args, "-P")
		args = append(args, b.RunScript)
	}

	//シーン指定がある場合
	if b.Scene != "" {
		args = append(args, "-S")
		args = append(args, b.Scene)
	}
	//出力指定がある場合
	if b.Result != "" {
		args = append(args, "-o")
		args = append(args, b.Result)
	}
	//フレームスキップ
	if b.Skip > 0 {
		args = append(args, "-j")
		args = append(args, fmt.Sprintf("%d", b.Skip))
	}
	//エンジン指定がある場合
	if b.Engine != "" {
		args = append(args, "-E")
		args = append(args, b.Engine)
	}

	//フォーマット指定
	args = append(args, "-F")
	args = append(args, "PNG")

	//スレッド数
	args = append(args, "-t")
	args = append(args, fmt.Sprintf("%d", b.Thread))

	anim := true
	start := b.Start
	end := b.End
	//フレーム設定
	if start == end {
		if start >= 0 {
			args = append(args, "-f")
			args = append(args, fmt.Sprintf("%d", start))
			anim = false
		}
	}

	if anim {
		if start != -1 && end != -1 {
			args = append(args, "-s")
			args = append(args, fmt.Sprintf("%d", start))
			args = append(args, "-e")
			args = append(args, fmt.Sprintf("%d", end))
		}
		//アニメーションを追加
		args = append(args, "-a")
	}

	//--cycles-device
	//CPU CUDA OPTIX HIP ONEAPI METAL
	// both device

	return args
}

func (b *Blender) RunTool() error {

	p, err := getToolPythonFile()
	if err != nil {
		return xerrors.Errorf("getToolPythonFile() error: %w", err)
	}
	b.Python = p
	//defer os.Remove(p)

	var w strings.Builder
	b.Writer = &w
	b.ErrorWriter = &w

	errCh, err := b.RunAsync(context.Background())
	if err != nil {
		return xerrors.Errorf("RunAsync() error: %w", err)
	}
	//wait
	err = <-errCh
	b.Tool = parseTool(w.String())
	b.Python = ""
	// Blender 4.x (少なくとも 4.5) は Python ツールが正常終了しても非ゼロを返す。
	// パース結果にシーンが含まれていれば成功とみなしエラーを無視する。
	if err != nil && len(b.Tool.Scenes) == 0 {
		return xerrors.Errorf("blender running error: %w", err)
	}

	return nil
}

/**
 * 設定パスの先頭が"/"の場合 Windows用に変換する
 */
func (b *Blender) convertWindowsPath(p string) string {
	if runtime.GOOS == "windows" {
		if strings.Index(p, "/") == 0 {
			return "C:\\" + p[1:]
		}
	}
	return p
}
