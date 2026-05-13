package wails

import (
	"os"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/log"
	"github.com/ikascrew/brender/model"
)

type Environment struct{}

func NewEnvironment() *Environment {
	var env Environment
	return &env
}

func (s *Environment) Get() (*model.Environment, error) {
	return api.GetEnvironment()
}

func (s *Environment) SetRoot(root string) error {
	return api.SetProjectRoot(root)
}

func (s *Environment) SetFfmpeg(cmd string, fps int, ext string, outExt string, args string) error {
	return api.SetFfmpegSettings(api.FfmpegSettings{
		Cmd:    cmd,
		FPS:    fps,
		Ext:    ext,
		OutExt: outExt,
		Args:   args,
	})
}

// GetWorkDir returns the process working directory for use as a dialog default.
func (s *Environment) GetWorkDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	return dir
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
