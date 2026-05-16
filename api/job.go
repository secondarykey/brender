package api

import (
	"context"
	"path/filepath"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func CreateMovie(projectID string, fileID string, workspaceID string, jobID string, fps int, inext string, outext string, extraArgs string) (string, chan error, error) {

	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", nil, xerrors.Errorf("GetProjectBaseDir error: %w", err)
	}

	env, err := model.GetEnv()
	if err != nil {
		return "", nil, xerrors.Errorf("model.GetEnv() error: %w", err)
	}
	if env == nil {
		env = &model.Environment{}
	}

	cmd := env.FfmpegCmd
	if cmd == "" {
		cmd = "ffmpeg"
	}
	if fps <= 0 {
		fps = 30
	}
	if inext == "" {
		inext = "png"
	}
	if outext == "" {
		outext = "mp4"
	}
	out := jobID + "." + outext

	jobDir := filepath.Join(baseDir, projectID, fileID, workspaceID, jobID)
	mvFile := filepath.Join(jobDir, out)

	mp := exec.NewFFmpeg(cmd)
	if extraArgs != "" {
		mp.ExtraArgs = extraArgs
	}
	ch, err := mp.CreateMovie(context.Background(), mvFile, fps, jobDir, inext)
	if err != nil {
		return "", nil, xerrors.Errorf("ffmpeg.CreateMovie() error: %w", err)
	}
	return mvFile, ch, nil
}
