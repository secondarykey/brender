package api

import (
	"context"
	"path/filepath"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func CreateMovie(projectID string, fileID string, workspaceID string, jobID string) error {

	fps := 30
	inext := "png"
	out := "movie.mp4"

	//システムパスを取得
	env, err := model.GetEnv()
	if err != nil {
		return xerrors.Errorf("model.GetEnv() error: %w", err)
	}
	if env == nil || env.ProjectRoot == "" {
		return xerrors.New("作業ディレクトリが設定されていません")
	}

	jobDir := filepath.Join(env.ProjectRoot, projectID, fileID, workspaceID, jobID)
	mvFile := filepath.Join(jobDir, out)

	//ffmpeg を実行
	mp := exec.NewFFmpeg("ffmpeg")
	err = mp.CreateMovie(context.Background(), mvFile, fps, jobDir, inext)
	if err != nil {
		return xerrors.Errorf("ffmpeg.CreateMovie() error: %w", err)
	}
	return nil
}
