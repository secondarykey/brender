package main

import (
	"context"
	"embed"
	_ "embed"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/api/rest"
	"github.com/ikascrew/brender/api/wails"
	"github.com/ikascrew/brender/log"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed version
var appVersion string

func initDB() error {

	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(home, ".brender")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return model.Init(filepath.Join(dir, "brender.db"))
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

func main() {

	err := run()
	if err != nil {
		fmt.Fprintf(os.Stderr, "run() error: %+v", err)
		os.Exit(1)
	}
}

func run() error {

	logger, err := log.Init(context.Background())
	if err != nil {
		return xerrors.Errorf("log.Init() error: %w", err)
	}

	log.Notice("= Brender Version: %s", strings.TrimSpace(appVersion))

	err = initDB()
	if err != nil {
		return xerrors.Errorf("initDB() error: %w", err)
	}

	// 前回終了時に running のまま残ったキューを waiting に戻す
	api.RecoverStaleQueues()

	//国際化関連の初期処理

	//移行処理

	app := application.New(application.Options{
		Name:        "Brender",
		Description: "Blender rendering manager",
		Logger:      logger,
		Services: []application.Service{
			application.NewService(wails.NewBlender()),
			application.NewService(wails.NewEnvironment()),
			application.NewService(wails.NewProject()),
			application.NewService(wails.NewWorkspace()),
			application.NewService(wails.NewQueue()),
			application.NewService(wails.NewWorkDir()),
			application.NewService(wails.NewCodes()),
			application.NewService(wails.NewTag()),
			application.NewService(wails.NewAuth()),
		},
		Assets: application.AssetOptions{
			Handler: &movieAwareHandler{fallback: application.AssetFileServerFS(assets)},
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	wails.AppVersion = strings.TrimSpace(appVersion)
	dev := app.Env.Info().Debug
	wails.DevMode = dev
	if dev {
		log.SetLevel(slog.LevelInfo)
		//ログをInfoに落とす
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
		api.KillRunningQueues()
		model.Close()
		application.Get().Quit()
	})

	// キュー変化イベントをフロントエンドへ通知
	api.QueueChangedHook = func(count int64) {
		application.Get().Event.Emit("queue:changed", count)
	}

	// リカバリされたキューのスケジューリングを開始
	api.StartRecoveredQueues()

	// 登録済み Blender のバージョン検証（バックグラウンド）
	api.BlenderWarningHook = func(warnings []string) {
		application.Get().Event.Emit("blender:warning", warnings)
	}
	go api.VerifyBlenderInstalls()

	// 移行進捗イベントをフロントエンドへ通知
	api.MigrationHook = func(projectID string, status string, pct float64) {
		application.Get().Event.Emit("workdir:migrate", map[string]interface{}{
			"project_id": projectID,
			"status":     status,
			"pct":        pct,
		})
	}

	// 動画作成完了イベントをフロントエンドへ通知
	api.MovieCreatedHook = func(jobID string, path string, errMsg string) {
		application.Get().Event.Emit("movie:created", map[string]interface{}{
			"job_id": jobID,
			"path":   path,
			"error":  errMsg,
		})
	}

	// パス変更進捗イベントをフロントエンドへ通知
	api.WorkDirChangeDirHook = func(workDirID uint, status string, pct float64) {
		application.Get().Event.Emit("workdir:changedir", map[string]interface{}{
			"work_dir_id": workDirID,
			"status":      status,
			"pct":         pct,
		})
	}

	// サーバモードの起動
	var restServer *rest.Server
	if env, err := model.GetEnv(); err == nil && env != nil && env.Server {
		host := env.ServerHost
		port := env.ServerPort
		if port < 1 || port > 65535 {
			port = 8080
		}
		rest.SetVersionInfo(strings.TrimSpace(appVersion), dev)
		restServer = rest.NewServer(assets, host, port)
		broker := restServer.Broker()

		origQueueHook := api.QueueChangedHook
		api.QueueChangedHook = func(count int64) {
			if origQueueHook != nil {
				origQueueHook(count)
			}
			broker.Emit("queue:changed", count)
		}

		origMigrationHook := api.MigrationHook
		api.MigrationHook = func(projectID string, status string, pct float64) {
			if origMigrationHook != nil {
				origMigrationHook(projectID, status, pct)
			}
			broker.Emit("workdir:migrate", map[string]interface{}{
				"project_id": projectID,
				"status":     status,
				"pct":        pct,
			})
		}

		origChangeDirHook := api.WorkDirChangeDirHook
		api.WorkDirChangeDirHook = func(workDirID uint, status string, pct float64) {
			if origChangeDirHook != nil {
				origChangeDirHook(workDirID, status, pct)
			}
			broker.Emit("workdir:changedir", map[string]interface{}{
				"work_dir_id": workDirID,
				"status":      status,
				"pct":         pct,
			})
		}

		origMovieHook := api.MovieCreatedHook
		api.MovieCreatedHook = func(jobID string, path string, errMsg string) {
			if origMovieHook != nil {
				origMovieHook(jobID, path, errMsg)
			}
			broker.Emit("movie:created", map[string]interface{}{
				"job_id": jobID,
				"path":   path,
				"error":  errMsg,
			})
		}

		if err := restServer.Start(); err != nil {
			log.Error("Failed to start HTTP server: %v", err)
		} else {
			log.Notice("= HTTP Server started on port %d", port)
		}
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
