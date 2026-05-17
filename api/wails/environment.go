package wails

import (
	"log/slog"
	"os"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/log"
	"github.com/ikascrew/brender/model"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type Environment struct{}

func NewEnvironment() *Environment {
	var env Environment
	return &env
}

func (s *Environment) Get() (*model.Environment, error) {
	return api.GetEnvironment()
}

func (s *Environment) SetFfmpeg(cmd string, fps int, outExt string, args string) error {
	return api.SetFfmpegSettings(api.FfmpegSettings{
		Cmd:    cmd,
		FPS:    fps,
		OutExt: outExt,
		Args:   args,
	})
}

func (s *Environment) SetOutputFormat(format string) error {
	return api.SetOutputFormat(format)
}

func (s *Environment) SetMaxConcurrentJobs(n int) error {
	return api.SetMaxConcurrentJobs(n)
}

// GetSystemLog returns the contents of today's system log file.
func (s *Environment) GetSystemLog() (string, error) {
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
func (s *Environment) GetLogLevel() string {
	return levelToName(log.GetLevel())
}

// GetLogLevels returns all available log level names in order.
func (s *Environment) GetLogLevels() []string {
	return logLevelNames
}

// SetLogLevel changes the log level by name.
func (s *Environment) SetLogLevel(level string) error {
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
func (s *Environment) OpenSystemLogWindow() error {
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
