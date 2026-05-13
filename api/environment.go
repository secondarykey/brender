package api

import (
	"os"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func GetEnvironment() (*model.Environment, error) {
	return model.GetEnv()
}

func SetProjectRoot(root string) error {

	if _, err := os.Stat(root); err != nil {
		return xerrors.Errorf("directory not found: %s", root)
	}

	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("GetEnv error: %w", err)
	}

	if env == nil {
		env = &model.Environment{}
	}
	env.ProjectRoot = root
	return model.SetEnvironment(env)
}

type FfmpegSettings struct {
	Cmd    string `json:"ffmpeg_cmd"`
	FPS    int    `json:"ffmpeg_fps"`
	Ext    string `json:"ffmpeg_ext"`
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
	env.FfmpegExt = s.Ext
	env.FfmpegOutExt = s.OutExt
	env.FfmpegArgs = s.Args
	return model.SetEnvironment(env)
}
