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

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/api/wails"
	"github.com/ikascrew/brender/log"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"

	"github.com/wailsapp/wails/v3/pkg/application"
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
		},
		Assets: application.AssetOptions{
			Handler: &movieAwareHandler{fallback: application.AssetFileServerFS(assets)},
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	dev := app.Env.Info().Debug
	if dev {
		log.SetLevel(slog.LevelInfo)
		//ログをInfoに落とす
		log.Info("Develop Mode")
	}

	//サムネイル表示を３にした場合 1140x700 程度
	//4 は 1450x850 程度？

	app.Window.NewWithOptions(application.WebviewWindowOptions{
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

	// キュー変化イベントをフロントエンドへ通知
	api.QueueChangedHook = func(count int64) {
		application.Get().Event.Emit("queue:changed", count)
	}

	// 移行進捗イベントをフロントエンドへ通知
	api.MigrationHook = func(projectID string, status string, pct float64) {
		application.Get().Event.Emit("workdir:migrate", map[string]interface{}{
			"project_id": projectID,
			"status":     status,
			"pct":        pct,
		})
	}

	if err := app.Run(); err != nil {
		return xerrors.Errorf("app.Run() error: %w", err)
	}
	return nil
}
