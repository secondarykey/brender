package main

import (
	"embed"
	_ "embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
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

func initLog() error {
	return nil
}

func initLocale() error {
	return nil
}

func main() {

	//ログ関連の処理

	if err := initDB(); err != nil {
		log.Fatal(err)
	}

	//国際化関連の初期処理

	//移行処理

	app := application.New(application.Options{
		Name:        "brender",
		Description: "Blender rendering manager",
		Services: []application.Service{
			application.NewService(&BlenderService{}),
			application.NewService(&EnvironmentService{}),
			application.NewService(&ProjectService{}),
			application.NewService(&WorkspaceService{}),
			application.NewService(&QueueService{}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	dev := app.Env.Info().Debug
	log.Println(fmt.Sprintf("Version: %s(DEVMode:%t)", strings.TrimSpace(appVersion), dev))

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "brender",
		Width:     1280,
		Height:    800,
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

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
