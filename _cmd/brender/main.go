package main

import (
	"embed"
	_ "embed"
	"log"
	"os"
	"path/filepath"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

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

func main() {
	if err := initDB(); err != nil {
		log.Fatal(err)
	}

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
