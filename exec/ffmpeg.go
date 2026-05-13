package exec

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/ikascrew/brender/log"
	"golang.org/x/xerrors"
)

type FFmpeg struct {
	cmd       string
	writer    io.Writer
	ExtraArgs string
}

func NewFFmpeg(cmd string) *FFmpeg {
	var ff FFmpeg
	ff.cmd = cmd
	return &ff
}

func (ff *FFmpeg) RunVersion(ctx context.Context) error {

	var w strings.Builder
	ff.writer = &w

	ch, err := ff.run(ctx, "version")
	if err != nil {
		return err
	}

	err = <-ch
	if err != nil {
		return err
	}
	return nil
}

func (ff *FFmpeg) CreateMovie(ctx context.Context, out string, fps int, p string, inext string) error {

	//TODO 削除してないとエラーになる
	//os.Remove(out)

	//glob でファイルを検索
	gp := filepath.Join(p, "*."+inext)

	plist, err := filepath.Glob(gp)
	if err != nil {
		return xerrors.Errorf("filepath.Glob() error: %w", err)
	}
	if len(plist) <= 0 {
		return xerrors.Errorf("filepath not found error: %s", gp)
	}

	//取得できたファイルパスからリストを作成
	listf := filepath.Join(p, "ffmpeg.list")
	lfp, err := os.Create(listf)
	if err != nil {
		return err
	}

	b := []byte(fmt.Sprintf("ffconcat version 1.0\n"))
	_, err = lfp.Write(b)

	frame := 1.0 / float64(fps)
	for _, line := range plist {
		b = []byte(fmt.Sprintf("file '%s'\n", line))
		_, err = lfp.Write(b)
		if err != nil {
			return err
		}
		b = []byte(fmt.Sprintf("duration %f\n", frame))
		_, err = lfp.Write(b)
		if err != nil {
			return err
		}
	}
	lfp.Close()

	//ログ・ファイルを設定
	lf := filepath.Join(p, "ffmpeg.log")
	fp, err := os.Create(lf)
	if err != nil {
		return err
	}
	defer fp.Close()

	ff.writer = fp

	//以下FFmpeg実行の引数説明
	//-nostdin -y 標準入力なしでYesで応える（上書き）

	//-safe 0 ファイルリストに絶対パスを指定
	//-f concat concatの出力形式で指定
	//-i 出力したリストファイルを渡す

	//-r Windowsでうまく認識しないのでFPSを渡しておく
	//-pix_fmt yuv420p 静止画から作る時は入れておく
	// 出力ファイル名

	args := []string{"-nostdin", "y",
		"-safe", "0", "-f", "concat", "-i", listf,
		"-r", fmt.Sprintf("%d", fps), "-pix_fmt", "yuv420p"}
	if ff.ExtraArgs != "" {
		for _, a := range strings.Fields(ff.ExtraArgs) {
			args = append(args, a)
		}
	}
	args = append(args, out)

	ch, err := ff.run(ctx, args...)

	if err != nil {
		return err
	}

	go func() {
		//TODO 相手にchanを返していいかも
		err := <-ch
		if err != nil {
			log.Warn("ffmpeg error: %v", err)
		} else {
			log.Notice("create movie : %s", out)
		}
	}()

	return nil
}

func (ff *FFmpeg) run(ctx context.Context, args ...string) (chan error, error) {
	pId, errCh, err := runCommand(ctx, ff.writer, ff.writer, ff.cmd, args...)
	if err != nil {
		return nil, xerrors.Errorf("runCommand() error: %w", err)
	}

	log.Info("ffmpeg PID:%d", pId)

	return errCh, err
}
