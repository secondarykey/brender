package api

import (
	"context"
	"github.com/secondarykey/brender/model"
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

func SetFfmpegSettings(ctx context.Context, s FfmpegSettings) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
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

func SetOutputFormat(ctx context.Context, format string) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
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

func SetServer(ctx context.Context, enabled bool, host string, port int, auth bool) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
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
	env.ServerHost = host
	env.ServerPort = port
	env.ServerAuth = auth
	return model.SetEnvironment(env)
}

func SetMaxConcurrentJobs(ctx context.Context, n int) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
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
