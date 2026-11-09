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
	"strings"
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

func initDB() error {

	dir, err := config.Dir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// DB パスは brender.ini の db_path を優先。未設定なら ~/.brender/brender.db。
	dbPath := config.Get().DBPath
	if dbPath == "" {
		dbPath = filepath.Join(dir, "brender.db")
	}

	return model.Init(dbPath)
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
		Dir:      log.DefaultDir(),
		Root:     root,
		Console:  isDev,
		KeepDays: logKeepDays,
	})
}

// logKeepDays はログファイルを残す日数（今日を含む）。
const logKeepDays = 30

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

	log.Noticef("= Brender Version: %s", strings.TrimSpace(appVersion))

	err := initDB()
	if err != nil {
		return xerrors.Errorf("initDB() error: %w", err)
	}

	// 常駐中に溜まった生成済みスクリプトを起動時に一掃する
	if err := api.ClearScripts(); err != nil {
		log.Noticef("ClearScripts: %v", err)
	}

	// 前回終了時に running のまま残ったキューを waiting に戻す
	api.RecoverStaleQueues()

	//国際化関連の初期処理

	//移行処理

	// サーバモードなら先に HTTP サーバ（と SSE broker）を用意する。
	// broker はイベント配信フックより前に確定させ、全イベントが SSE へ届くようにする。
	// サーバは application.New より前に作り、自作の Transport（transport.go）に渡す。
	// Transport がブラウザからのバインディング呼び出しをこのサーバへつなぐ。
	var restServer *rest.Server
	var broker *rest.SSEBroker
	var serverPort int
	var serverAuth bool
	var transport application.Transport // nil なら Wails の既定（ウィンドウだけ）
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
		transport = newBrowserTransport(restServer, application.HTTPTransportWithLogger(log.Logger()))
	}

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
	})

	services.AppVersion = strings.TrimSpace(appVersion)
	dev := app.Env.Info().Debug
	services.DevMode = dev
	if dev {
		log.Info("Develop Mode")
	}

	//サムネイル表示を３にした場合 1140x700 程度
	//4 は 1450x850 程度？

	mainWin := app.Window.NewWithOptions(application.WebviewWindowOptions{
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
	// メインウィンドウが閉じられたらアプリ全体を終了する（ログウィンドウも閉じる）
	mainWin.RegisterHook(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		api.StopSystemMonitor()
		api.KillRunningQueues()
		model.Close()
		application.Get().Quit()
	})

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
	api.MigrationHook = func(projectID string, status string, pct float64) {
		emit("workdir:migrate", map[string]interface{}{
			"project_id": projectID,
			"status":     status,
			"pct":        pct,
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
	api.WorkDirChangeDirHook = func(workDirID uint, status string, pct float64) {
		emit("workdir:changedir", map[string]interface{}{
			"work_dir_id": workDirID,
			"status":      status,
			"pct":         pct,
		})
	}
	// システムモニタリング（CPU/GPU 使用率）
	api.SystemStatsHook = func(stats sysmon.Stats) {
		emit("system:stats", stats)
	}

	// フック設定後にスケジューラ・モニタ・検証を開始する
	api.StartRecoveredQueues()
	go api.VerifyBlenderInstalls()
	api.StartSystemMonitor()

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

	if err := app.Run(); err != nil {
		return xerrors.Errorf("app.Run() error: %w", err)
	}

	if restServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		restServer.Shutdown(ctx)
	}

	return nil
}
