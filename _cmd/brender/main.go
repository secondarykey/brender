package main

import (
	"context"
	"embed"
	_ "embed"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/api/rest"
	"github.com/secondarykey/brender/config"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"github.com/secondarykey/brender/sysmon"
	"golang.org/x/xerrors"

	"main/services"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed version
var appVersion string

// dbPath は DB のパスを返す。brender.ini の db_path を優先し、未設定なら ~/.brender/brender.db。
func dbPath() (string, error) {
	dir, err := config.Dir()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	if p := config.Get().DBPath; p != "" {
		return p, nil
	}
	return filepath.Join(dir, "brender.db"), nil
}

func initLocale() error {
	return nil
}

// movieAwareHandler は /_movie パスでローカル動画ファイルを配信する。
// Range リクエスト（シーク）は http.ServeFile が自動で処理する。
type movieAwareHandler struct {
	fallback http.Handler
}

func (h *movieAwareHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/_movie" {
		p := r.URL.Query().Get("path")
		if p == "" || !filepath.IsAbs(p) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		http.ServeFile(w, r, p)
		return
	}
	h.fallback.ServeHTTP(w, r)
}

// startupLog は起動時の大事な知らせをログとターミナル（標準出力・標準エラー）の両方に出す。
// 配る exe のログはファイルにしか出ないため、ターミナルから起動したときにも見えるようにする
// （wails3 dev はログがターミナルにも出るので、二重に出さない）。
func startupLog(isErr bool, format string, args ...any) {
	if isErr {
		log.Errorf(format, args...)
	} else {
		log.Noticef(format, args...)
	}
	if isDev {
		return
	}
	out := os.Stdout
	if isErr {
		out = os.Stderr
	}
	fmt.Fprintln(out, fmt.Sprintf(format, args...))
}

// startLog はログの出口を組む。ファイルはいつも（brender.ini の log_dir、無ければ一時フォルダ）、
// wails3 dev ではターミナルにも出し、Info から残す。配る exe は Notice から残す（設定画面で変えられる）。
func startLog() (io.Closer, error) {
	root := log.LevelNotice
	if isDev {
		root = log.LevelInfo
	}
	return log.Init(log.Options{
		Dir:          log.DefaultDir(),
		Root:         root,
		Console:      isDev,
		KeepDays:     log.DefaultKeepDays,
		CompressDays: log.DefaultCompressDays,
	})
}

func main() {

	err := run()
	if err != nil {
		fmt.Fprintf(os.Stderr, "run() error: %+v", err)
		os.Exit(1)
	}
}

func run() error {

	// 最初に組む（DB の初期化のログから残すため）。ログが書けなくてもアプリは止めない
	logs, logErr := startLog()
	defer logs.Close()
	if logErr != nil {
		log.Warnf("startLog: %v", logErr)
	}

	log.Noticef("= Brender Version: %s", services.RunVersion(appVersion, isDev))
	background := services.HasBackgroundArg(os.Args[1:])

	path, err := dbPath()
	if err != nil {
		return xerrors.Errorf("dbPath() error: %w", err)
	}

	// application.New（二重起動の確認がある）は、DB を開く・リカバリするより前に呼ぶ。
	// 同じ DB で2つ目が起動したら、ここで1つ目にウィンドウを出させて終わる（DB には触らない）。
	// そのため Transport はサーバモードかどうか分かる前に作り、サーバは DB を読んでからつなぐ。
	transport := newBrowserTransport(application.HTTPTransportWithLogger(log.Logger()))
	var restServer *rest.Server // サーバモードなら DB を読んだあとで入る（shutdown が使う）
	var showMain func()         // メインのウィンドウを出す（無ければ作る）。ウィンドウの用意ができてから入る
	var showMu sync.Mutex

	app := application.New(application.Options{
		Name:        "Brender",
		Description: "Blender rendering manager",
		// ⚠️ Wails 自身のログも同じ出口へ。渡さないと、配る exe（production）では Wails のログ（エラーを含む）が捨てられる
		Logger: log.Logger(),
		Services: []application.Service{
			application.NewService(services.NewBlender()),
			application.NewService(services.NewEnvironment()),
			application.NewService(services.NewProject()),
			application.NewService(services.NewWorkspace()),
			application.NewService(services.NewQueue()),
			application.NewService(services.NewWorkDir()),
			application.NewService(services.NewCodes()),
			application.NewService(services.NewTag()),
			application.NewService(services.NewFavorite()),
			application.NewService(services.NewAuth()),
			application.NewService(services.NewSysMon()),
		},
		Assets: application.AssetOptions{
			Handler: &movieAwareHandler{fallback: application.AssetFileServerFS(assets)},
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		Transport: transport,
		// 後始末はウィンドウのフックではなくここに置く。メインのウィンドウを閉じたときだけでなく、
		// macOS の Cmd+Q・OS のシャットダウン・シグナルなど、どの終わり方でも Wails が呼ぶ
		OnShutdown: func() { shutdown(restServer) },
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: services.InstanceID(path),
			// 2つ目の起動は、動いている方のウィンドウを出す合図にする（--background で起動したアプリを、
			// 画面から操作・終了する入口）。2つ目も --background なら何もしない
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				if services.HasBackgroundArg(data.Args) {
					log.Notice("second instance launched with " + services.BackgroundArg + ": already running")
					return
				}
				log.Notice("second instance launched: showing the main window")
				showMu.Lock()
				show := showMain
				showMu.Unlock()
				if show != nil {
					show()
				}
			},
		},
	})

	if err := model.Init(path); err != nil {
		return xerrors.Errorf("model.Init() error: %w", err)
	}

	// 常駐中に溜まった生成済みスクリプトを起動時に一掃する
	if err := api.ClearScripts(); err != nil {
		log.Noticef("ClearScripts: %v", err)
	}

	// 前回終了時に running のまま残ったキューを waiting に戻す
	api.RecoverStaleQueues()

	//国際化関連の初期処理

	//移行処理

	// サーバモードなら HTTP サーバ（と SSE broker）を用意して Transport につなぐ。
	// broker はイベント配信フックより前に確定させ、全イベントが SSE へ届くようにする。
	// Transport がブラウザからのバインディング呼び出しをこのサーバへつなぐ。
	var broker *rest.SSEBroker
	var serverPort int
	var serverAuth bool
	env, err := model.GetEnv()
	if err != nil {
		log.Errorf("GetEnv: %v (server mode is treated as off)", err)
	}
	if err == nil && env != nil && env.Server {
		serverAuth = env.ServerAuth
		serverPort = env.ServerPort
		if serverPort < 1 || serverPort > 65535 {
			serverPort = 8080
		}
		restServer = rest.NewServer(assets, env.ServerHost, serverPort)
		broker = restServer.Broker()
		transport.attach(restServer)
	}

	dev := app.Env.Info().Debug
	services.AppVersion = services.RunVersion(appVersion, dev)
	services.DevMode = dev
	if dev {
		log.Info("Develop Mode")
	}

	//サムネイル表示を３にした場合 1140x700 程度
	//4 は 1450x850 程度？

	// メインのウィンドウ。--background で起動したときは、2つ目の起動の合図で初めて作る
	var mainWin *application.WebviewWindow
	newMainWindow := func() *application.WebviewWindow {
		w := app.Window.NewWithOptions(application.WebviewWindowOptions{
			Name:      "main",
			Title:     "brender",
			Width:     1460,
			Height:    840,
			Frameless: true,
			Mac: application.MacWindow{
				Backdrop: application.MacBackdropTranslucent,
				TitleBar: application.MacTitleBarHidden,
			},
			BackgroundColour: application.NewRGB(26, 26, 26),
			URL:              "/",
		})
		// メインウィンドウが閉じられたらアプリ全体を終了する（ログウィンドウも閉じる）。後始末は OnShutdown の shutdown。
		// サーバモードでも同じ（閉じればブラウザから使っている人のレンダリングも止まる。閉じる前に画面が確かめる）
		w.RegisterHook(events.Common.WindowClosing, func(_ *application.WindowEvent) {
			application.Get().Quit()
		})
		return w
	}
	if background && restServer == nil {
		// サーバモードでなければ、ウィンドウが無いと使う手立てが無い
		startupLog(true, "= %s is ignored: server mode is off", services.BackgroundArg)
		background = false
	}
	if !background {
		mainWin = newMainWindow()
	}
	showMu.Lock()
	showMain = func() {
		showMu.Lock()
		defer showMu.Unlock()
		if mainWin == nil {
			mainWin = newMainWindow()
		}
		mainWin.Show()
		mainWin.Restore()
		mainWin.Focus()
	}
	showMu.Unlock()

	// イベント配信を一元化する。Wails Event へ送り、サーバモードなら SSE へも配る。
	// 新しいイベントを足す場合もこの emit を通せば両トランスポートへ確実に届く。
	emit := func(name string, data any) {
		application.Get().Event.Emit(name, data)
		if broker != nil {
			broker.Emit(name, data)
		}
	}

	// キュー変化イベント
	api.QueueChangedHook = func(count int64) {
		emit("queue:changed", count)
	}
	// 登録済み Blender のバージョン検証結果
	api.BlenderWarningHook = func(warnings []string) {
		emit("blender:warning", warnings)
	}
	// 移行進捗イベント
	api.MigrationHook = func(projectID string, status string, pct float64, errMsg string) {
		emit("workdir:migrate", map[string]interface{}{
			"project_id": projectID,
			"status":     status,
			"pct":        pct,
			"error":      errMsg,
		})
	}
	// 動画作成完了イベント
	api.MovieCreatedHook = func(jobID string, path string, errMsg string) {
		emit("movie:created", map[string]interface{}{
			"job_id": jobID,
			"path":   path,
			"error":  errMsg,
		})
	}
	// パス変更進捗イベント
	api.WorkDirChangeDirHook = func(workDirID uint, status string, pct float64, errMsg string) {
		emit("workdir:changedir", map[string]interface{}{
			"work_dir_id": workDirID,
			"status":      status,
			"pct":         pct,
			"error":       errMsg,
		})
	}
	// システムモニタリング（CPU/GPU 使用率）
	api.SystemStatsHook = func(stats sysmon.Stats) {
		emit("system:stats", stats)
	}

	// フック設定後にスケジューラ・検証を開始する
	// （システムモニタは起動時には動かさない。画面が KeepSystemMonitor を呼んでいるあいだだけ動く）
	api.StartRecoveredQueues()
	go api.VerifyBlenderInstalls()

	// サーバモードの状態は起動のたびに必ず出す（オフでも出す。設定の変更は再起動で反映されるため）
	if restServer == nil {
		startupLog(false, "= Server mode: off")
	} else if err := restServer.Start(); err != nil {
		startupLog(true, "= Server mode: failed to start on %s: %v", restServer.Addr(), err)
	} else {
		url, all := restServer.URL()
		where := ""
		if all {
			where = " (all interfaces)"
		}
		auth := "off"
		if serverAuth {
			auth = "on"
		}
		startupLog(false, "= Server mode: on, listening on %s%s, user management: %s [Experimental]", url, where, auth)
	}
	if background {
		startupLog(false, "= Started without a window (%s). Launch brender again to open the window", services.BackgroundArg)
	}

	if err := app.Run(); err != nil {
		return xerrors.Errorf("app.Run() error: %w", err)
	}
	return nil
}

// shutdown は終わるときの後始末（application.Options.OnShutdown から呼ぶ）。
// 外からの呼び出しを止めてから、レンダリングを止め、最後に DB を閉じる
// （先に DB を閉じると、まだ受け付けているブラウザからの呼び出しが DB を使えずに失敗する）。
func shutdown(restServer *rest.Server) {
	log.Notice("= Brender shutdown")
	if restServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := restServer.Shutdown(ctx); err != nil {
			log.Warnf("shutdown: server: %v", err)
		}
	}
	api.StopSystemMonitor()
	api.KillRunningQueues()
	if err := model.Close(); err != nil {
		log.Warnf("shutdown: model.Close: %v", err)
	}
}
