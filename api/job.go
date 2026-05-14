package api

import (
	"context"
	"path/filepath"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func CreateMovie(projectID string, fileID string, workspaceID string, jobID string) (string, error) {

	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("GetProjectBaseDir error: %w", err)
	}

	env, err := model.GetEnv()
	if err != nil {
		return "", xerrors.Errorf("model.GetEnv() error: %w", err)
	}
	if env == nil {
		env = &model.Environment{}
	}

	cmd := env.FfmpegCmd
	if cmd == "" {
		cmd = "ffmpeg"
	}
	fps := env.FfmpegFPS
	if fps == 0 {
		fps = 30
	}
	inext := env.FfmpegExt
	if inext == "" {
		inext = "png"
	}

	outext := env.FfmpegOutExt
	if outext == "" {
		outext = "mp4"
	}
	out := "movie." + outext

	jobDir := filepath.Join(baseDir, projectID, fileID, workspaceID, jobID)
	mvFile := filepath.Join(jobDir, out)

	mp := exec.NewFFmpeg(cmd)
	if env.FfmpegArgs != "" {
		mp.ExtraArgs = env.FfmpegArgs
	}
	err = mp.CreateMovie(context.Background(), mvFile, fps, jobDir, inext)
	if err != nil {
		return "", xerrors.Errorf("ffmpeg.CreateMovie() error: %w", err)
	}
	return mvFile, nil
}
