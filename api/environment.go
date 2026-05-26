package api

import (
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func GetEnvironment() (*model.Environment, error) {
	return model.GetEnv()
}

type FfmpegSettings struct {
	Cmd    string `json:"ffmpeg_cmd"`
	FPS    int    `json:"ffmpeg_fps"`
	OutExt string `json:"ffmpeg_out_ext"`
	Args   string `json:"ffmpeg_args"`
}

func SetFfmpegSettings(s FfmpegSettings) error {
	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("GetEnv error: %w", err)
	}
	if env == nil {
		env = &model.Environment{}
	}
	env.FfmpegCmd = s.Cmd
	env.FfmpegFPS = s.FPS
	env.FfmpegOutExt = s.OutExt
	env.FfmpegArgs = s.Args
	return model.SetEnvironment(env)
}

func SetOutputFormat(format string) error {
	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("GetEnv error: %w", err)
	}
	if env == nil {
		env = &model.Environment{}
	}
	env.OutputFormat = format
	return model.SetEnvironment(env)
}

func SetServer(enabled bool, port int) error {
	if port < 1 || port > 65535 {
		port = 8080
	}
	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("GetEnv error: %w", err)
	}
	if env == nil {
		env = &model.Environment{}
	}
	env.Server = enabled
	env.ServerPort = port
	return model.SetEnvironment(env)
}

func SetMaxConcurrentJobs(n int) error {
	if n < 1 {
		n = 1
	}
	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("GetEnv error: %w", err)
	}
	if env == nil {
		env = &model.Environment{}
	}
	env.MaxConcurrentJobs = n
	return model.SetEnvironment(env)
}
