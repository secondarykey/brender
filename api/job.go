package api

import (
	"context"
	"path/filepath"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

// MovieCreatedHook は動画作成完了時に呼ばれる。jobID, path, error を受け取る。
var MovieCreatedHook func(jobID string, path string, errMsg string)

func CreateMovie(ctx context.Context, projectID string, fileID string, workspaceID string, jobID string, fps int, outext string, extraArgs string) (string, chan error, error) {
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, fileID, rolesRunnerUp...); err != nil {
		return "", nil, err
	}

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

	// 入力拡張子はジョブの OutputExt から取得
	j, err := model.GetJob(jobID)
	if err != nil {
		return "", nil, xerrors.Errorf("model.GetJob() error: %w", err)
	}
	inext := j.OutputExt
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
