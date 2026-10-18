package services

import (
	"context"
	"log/slog"
	"os"

	brender "github.com/secondarykey/brender"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"github.com/wailsapp/wails/v3/pkg/application"
)

var AppVersion string
var DevMode bool

type Environment struct{}

func NewEnvironment() *Environment {
	var env Environment
	return &env
}

func (s *Environment) Get(ctx context.Context) (*model.Environment, error) {
	return api.GetEnvironment()
}

type VersionInfo struct {
	Version string `json:"version"`
	Dev     bool   `json:"dev"`
}

func (s *Environment) GetVersion(ctx context.Context) VersionInfo {
	return VersionInfo{
		Version: AppVersion,
		Dev:     DevMode,
	}
}

type LicenseInfo struct {
	App        string `json:"app"`
	ThirdParty string `json:"thirdParty"`
}

func (s *Environment) GetLicenses(ctx context.Context) LicenseInfo {
	return LicenseInfo{
		App:        brender.AppLicense,
		ThirdParty: brender.ThirdPartyLicenses,
	}
}

func (s *Environment) SetFfmpeg(ctx context.Context, cmd string, fps int, outExt string, args string) error {
	return api.SetFfmpegSettings(ctx, api.FfmpegSettings{
		Cmd:    cmd,
		FPS:    fps,
		OutExt: outExt,
		Args:   args,
	})
}

func (s *Environment) SetOutputFormat(ctx context.Context, format string) error {
	return api.SetOutputFormat(ctx, format)
}

func (s *Environment) SetServer(ctx context.Context, enabled bool, host string, port int, auth bool) error {
	return api.SetServer(ctx, enabled, host, port, auth)
}

func (s *Environment) SetMaxConcurrentJobs(ctx context.Context, n int) error {
	return api.SetMaxConcurrentJobs(ctx, n)
}

// GetSystemLog returns the contents of today's system log file.
// ブラウザからも呼べるため admin 限定（デスクトップのウィンドウは owner なので通る）。
func (s *Environment) GetSystemLog(ctx context.Context) (string, error) {
	if err := api.RequireAdmin(ctx); err != nil {
		return "", err
	}
	path := log.Path()
	if path == "" {
		return "", nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

var logLevelNames = []string{"TRACE", "DEBUG", "INFO", "NOTICE", "WARN", "ERROR"}

var logLevelMap = map[string]slog.Level{
	"TRACE":  log.LevelTrace,
	"DEBUG":  slog.LevelDebug,
	"INFO":   slog.LevelInfo,
	"NOTICE": log.LevelNotice,
	"WARN":   slog.LevelWarn,
	"ERROR":  slog.LevelError,
}

func levelToName(lv slog.Level) string {
	switch {
	case lv <= log.LevelTrace:
		return "TRACE"
	case lv <= slog.LevelDebug:
		return "DEBUG"
	case lv < log.LevelNotice:
		return "INFO"
	case lv < slog.LevelWarn:
		return "NOTICE"
	case lv < slog.LevelError:
		return "WARN"
	default:
		return "ERROR"
	}
}

// GetLogLevel returns the current log level name (TRACE/DEBUG/INFO/NOTICE/WARN/ERROR).
func (s *Environment) GetLogLevel(ctx context.Context) string {
	return levelToName(log.GetLevel())
}

// GetLogLevels returns all available log level names in order.
func (s *Environment) GetLogLevels(ctx context.Context) []string {
	return logLevelNames
}

// SetLogLevel changes the log level by name. admin 限定（GetSystemLog と同じ）。
func (s *Environment) SetLogLevel(ctx context.Context, level string) error {
	if err := api.RequireAdmin(ctx); err != nil {
		return err
	}
	lv, ok := logLevelMap[level]
	if !ok {
		return nil
	}
	log.SetLevel(lv)
	return nil
}

const sysLogWindowName = "syslog"

// OpenSystemLogWindow opens the system log in a viewer window.
// If the window is already open, it is focused instead of creating a new one.
// ブラウザから呼ばれるとサーバの機械の画面で開いてしまうため断る。
func (s *Environment) OpenSystemLogWindow(ctx context.Context) error {
	if api.FromBrowser(ctx) {
		return api.ErrNotAvailableFromBrowser
	}
	app := application.Get()
	if win, ok := app.Window.GetByName(sysLogWindowName); ok {
		win.Show()
		win.Focus()
		return nil
	}
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             sysLogWindowName,
		Title:            "system.log",
		Width:            900,
		Height:           700,
		Frameless:        true,
		URL:              "/?syslog=1",
		BackgroundColour: application.NewRGB(26, 26, 26),
	}).Show()
	return nil
}
