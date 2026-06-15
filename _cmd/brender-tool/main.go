package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/log"
	"golang.org/x/xerrors"
)

var cmd string
var workbench bool
var scene string
var output string

var engine string

var start int
var end int

var force bool
var verbose bool

var analysis bool
var engines bool
var scenes bool

func init() {

	flag.StringVar(&cmd, "b", "", "Blender command")

	//ignore ... ?
	flag.BoolVar(&workbench, "w", false, "Workbentch mode")
	flag.StringVar(&scene, "S", "", "Scene")
	flag.StringVar(&engine, "E", "", "Engine")

	flag.StringVar(&output, "o", "", "Output directory")

	flag.IntVar(&start, "s", -1, "Start frame")
	flag.IntVar(&end, "e", -1, "End frame")

	flag.BoolVar(&force, "f", false, "(rendring file check))")

	flag.BoolVar(&verbose, "v", false, "Verbose")
	flag.BoolVar(&analysis, "a", false, "Analysis Mode")

	flag.BoolVar(&engines, "engines", false, "Print EngineList")
	flag.BoolVar(&scenes, "scenes", false, "Print SceneList")
}

func main() {

	flag.Parse()

	if _, err := log.Init(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "log.Init() error: %+v\n", err)
		os.Exit(1)
	}
	defer log.Close()

	if verbose {
		log.SetLevel(slog.LevelDebug)
	}

	if engines {
		err := printEngineList()
		if err != nil {
			fmt.Fprintf(os.Stderr, "printEngineList() error:\n%+v\n", err)
			os.Exit(1)
		}
		return
	}

	args := flag.Args()
	if len(args) != 1 {
		fmt.Fprintln(os.Stderr, "brender-tool command arguments error: required blender file.")
		os.Exit(1)
	}

	file := args[0]
	//プロジェクトの日付
	_, err := os.Stat(file)
	if err != nil {
		//return xerrors.Errorf("os.Stat() error: %w", err)
		fmt.Fprintf(os.Stderr, "file is not exists:\n%+v\n", err)
		os.Exit(1)
	}

	//シーンリスト指定
	if scenes {
		err := printTool(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "rendering() error:\n%+v\n", err)
			os.Exit(1)
		}
		os.Exit(0)
	}

	err = rendering(file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "rendering() error:\n%+v\n", err)
		os.Exit(1)
	}

	fmt.Println("Success!")
}

func printEngineList() error {

	p := createCommandPATH()
	names, err := exec.RunEnginesFromTool(p)
	if err != nil {
		return xerrors.Errorf("RunEnginesFromTool() error: %w", err)
	}

	fmt.Printf("Blender Command: %s\n", p)
	fmt.Printf("Rendring Engine List ---------------------------\n")
	for _, n := range names {
		fmt.Printf("%s\n", n)
	}
	fmt.Printf("------------------------------------------------\n")
	return nil
}

/**
 * Blender オブジェクトを生成する
 */
func createBlender() (*exec.Blender, error) {
	wkCmd := createCommandPATH()
	//バージョン解析する？
	b, err := exec.NewBlender(wkCmd)
	if err != nil {
		return nil, xerrors.Errorf("NewBlender() error: %w", err)
	}
	return b, nil
}

func createBlenderWithTool(f string) (*exec.Blender, error) {
	b, err := createBlender()
	if err != nil {
		return nil, xerrors.Errorf("createBlender() error: %w", err)
	}
	b.File = f
	err = b.RunTool()
	if err != nil {
		return nil, xerrors.Errorf("RunTool() error: %w", err)
	}
	return b, nil
}

/**
 * -b 指定がある場合はそれをコマンドにする。
 * そうでない場合は
 * 環境変数(BRENDER_BLENDER)、存在しない場合は"blender"を行ってみる
 */
func createCommandPATH() string {
	wkCmd := cmd
	if wkCmd == "" {
		wkCmd = os.Getenv("BRENDER_BLENDER")
		if wkCmd == "" {
			wkCmd = "blender"
		}
	}
	return wkCmd
}

func printTool(f string) error {

	b, err := createBlenderWithTool(f)
	if err != nil {
		return xerrors.Errorf("createBlenderWithTool() error: %w", err)
	}

	fmt.Printf("Blender Version:%s (%s)\n", b.Tool.Version, b.Tool.Build)
	fmt.Printf("-------------------------------------------------\n")
	fmt.Printf("  %-30s|%7s|%7s|\n", "SceneName", "Start", "End")
	fmt.Printf("-------------------------------------------------\n")
	for _, s := range b.Tool.Scenes {
		active := " "
		if s.Active {
			active = "*"
		}
		fmt.Printf("%s %-30s|%7d|%7d|\n", active, s.Name, s.Start, s.End)
	}
	fmt.Printf("-------------------------------------------------\n")
	return nil
}

func rendering(f string) error {

	b, err := createBlenderWithTool(f)
	if err != nil {
		return xerrors.Errorf("createBlender() error: %w", err)
	}

	tool := b.Tool
	fmt.Printf("Blender Version: %s (%s)\n", tool.Version, tool.Build)
	log.Info("Blender Version: %s (%s)", tool.Version, tool.Build)

	s := tool.ActiveScene()
	if scene == "" {
		scene = s.Name
	}
	b.Scene = scene
	fmt.Printf("Scene: %s\n", b.Scene)
	log.Info("Scene: %s", b.Scene)

	if start == -1 {
		start = s.Start
	}
	if end == -1 {
		end = s.End
	}

	if workbench {
		engine = "BLENDER_WORKBENCH"
	}

	if engine != "" {
		//TODO エンジンチェックを行うか？
	}

	b.Engine = engine
	//ワークベンチだった場合、ディレクトリを１つ下げる
	b.Result = output

	//Project Frame 0-0
	b.Start = start
	b.End = end
	fmt.Printf("Frame: %d-%d\n", b.Start, b.End)
	log.Info("Frame: %d-%d", b.Start, b.End)

	var w []io.Writer
	if verbose {
		w = append(w, os.Stdout)
	}

	if output != "" {
		logPath := filepath.Join(output, "render.log")
		if err := os.MkdirAll(output, 0755); err != nil {
			return xerrors.Errorf("MkdirAll() error: %w", err)
		}
		logFile, err := os.Create(logPath)
		if err != nil {
			return xerrors.Errorf("render.log create error: %w", err)
		}
		defer logFile.Close()
		w = append(w, logFile)
		log.Info("render.log: %s", logPath)
	}

	//処理をまとめてくれるライターを生成
	pw := exec.NewProcessingWriter(start, end)
	//実行モードを選択
	ana := exec.NoneAnalysis
	if analysis {
		ana = exec.AllAnalysis
	}
	pw.SetMode(ana)
	w = append(w, pw)

	//Writer指定で処理
	mw := io.MultiWriter(w...)
	b.Writer = mw
	b.ErrorWriter = mw

	//非同期実行
	errCh, err := b.RunAsync(context.Background())
	if err != nil {
		return xerrors.Errorf("RunAsync() error: %w", err)
	}

	// ターミナル表示ゴルーチンを起動（verboseおよびanalysisモード以外）
	doneCh := make(chan struct{})
	stopDisplay := make(chan struct{})
	if !verbose && !analysis {
		go func() {
			defer close(doneCh)
			runTerminalDisplay(pw, stopDisplay)
		}()
	} else {
		close(doneCh)
	}

	//待受を行う
	err = <-errCh

	//表示ゴルーチンを停止して終了を待つ
	close(stopDisplay)
	<-doneCh

	if err != nil {
		return xerrors.Errorf("blender running error: %w", err)
	}

	return nil
}

// runTerminalDisplay はProcessingWriterの状態をポーリングしてターミナルに表示します。
func runTerminalDisplay(pw *exec.ProcessingWriter, stop <-chan struct{}) {
	t, _ := exec.NewTerminal(exec.LineNum)
	t.Refresh = true

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			printTerminal(t, pw.Result())
			t.NewLine()
			return
		case <-ticker.C:
			printTerminal(t, pw.Result())
		}
	}
}

// printTerminal はProcessingResultの内容をターミナルに整形して表示します。
func printTerminal(t *exec.Terminal, r exec.ProcessingResult) {
	t.Set(exec.StartNum, fmt.Sprintf(exec.StartLine, r.StartTime.Format(exec.ProcessingTimeFormat)))

	if !r.RenderingStartTime.IsZero() {
		t.Set(exec.RenderNum, fmt.Sprintf(exec.RenderingLine, r.RenderingStartTime.Format(exec.ProcessingTimeFormat)))
	} else {
		t.Set(exec.RenderNum, fmt.Sprintf(exec.RenderingLine, "-"))
	}

	t.Set(exec.TotalNum, fmt.Sprintf(exec.TotalLine, r.TotalTime.Round(time.Second)))

	if r.AverageTime > 0 {
		t.Set(exec.AveNum, fmt.Sprintf(exec.AveLine, r.AverageTime.Round(10*time.Millisecond)))
	} else {
		t.Set(exec.AveNum, fmt.Sprintf(exec.AveLine, "-"))
	}

	if !r.ExpectedTime.IsZero() {
		remaining := time.Until(r.ExpectedTime)
		t.Set(exec.ExpectedNum, fmt.Sprintf(exec.ExpectedLine, r.ExpectedTime.Format(exec.ProcessingTimeFormat), remaining.Round(time.Second)))
	} else {
		t.Set(exec.ExpectedNum, fmt.Sprintf(exec.ExpectedLine, "-", "-"))
	}

	if r.LatestFile != "" {
		var frameTime time.Duration
		if len(r.RenderingTimes) > 0 {
			frameTime = r.RenderingTimes[len(r.RenderingTimes)-1]
		}
		t.Set(exec.LatestNum, fmt.Sprintf(exec.LatestLine, r.LatestFile, frameTime))
	} else {
		t.Set(exec.LatestNum, fmt.Sprintf(exec.LatestLine, "-", "-"))
	}

	all := r.EndFrame - r.StartFrame
	now := r.NowFrame - r.StartFrame
	var pct float64
	if all > 0 {
		pct = float64(now) / float64(all) * 100
	}
	t.Set(exec.NowFrameNum, fmt.Sprintf(exec.NowFrameLine, r.NowFrame, pct))

	t.Set(exec.Log1Num, r.Log1)
	t.Set(exec.Log2Num, r.Log2)

	t.Print()
}
