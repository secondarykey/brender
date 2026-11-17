package api

import (
	"archive/zip"
	"context"
	"encoding/base64"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

// dirSize はディレクトリ以下の全ファイルのサイズ合計をバイトで返す（読めないものは飛ばす）。
// ジョブの DiskSize・掃除の前の実測・プロジェクトの容量を同じ数え方にするため、容量はここだけで数える。
// 画像だけでなくログや動画も足す（ジョブを消したときに空く量と合わせる）。
func dirSize(dir string) int64 {
	var total int64
	filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if info, e := d.Info(); e == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}

// removeOutputDirs は出力フォルダ一覧を存在確認の上で削除する。
func removeOutputDirs(dirs []string) {
	for _, dir := range dirs {
		if dir == "" {
			continue
		}
		if _, err := os.Stat(dir); err == nil {
			if err := os.RemoveAll(dir); err != nil {
				log.Errorf("removeOutputDirs: %v", err)
			}
		}
	}
}

// ListJobImages はジョブの出力ディレクトリにある画像ファイルのパス一覧を昇順で返す。
func ListJobImages(ctx context.Context, id string) ([]string, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return nil, xerrors.Errorf("ListJobImages GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return nil, err
	}
	if j.OutputDir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(j.OutputDir)
	if err != nil {
		return nil, xerrors.Errorf("ListJobImages ReadDir: %w", err)
	}
	var paths []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext == ".png" || ext == ".jpg" || ext == ".jpeg" {
			paths = append(paths, filepath.Join(j.OutputDir, e.Name()))
		}
	}
	return paths, nil
}

// JobFileInfo はジョブ出力ディレクトリのファイル情報。
type JobFileInfo struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
	IsDir   bool      `json:"is_dir"`
}

// ListJobFiles はジョブの出力ディレクトリにある全ファイルの情報を返す。
func ListJobFiles(ctx context.Context, id string) ([]*JobFileInfo, error) {
	j, err := model.GetJob(id)
	if err != nil {
		log.Errorf("[ListJobFiles] GetJob error: %v", err)
		return nil, xerrors.Errorf("ListJobFiles GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return nil, err
	}
	log.Debugf("[ListJobFiles] job=%s outputDir=%q dataStatus=%d", id, j.OutputDir, j.DataStatus)
	if j.OutputDir == "" {
		log.Debug("[ListJobFiles] outputDir is empty, returning nil")
		return nil, nil
	}
	entries, err := os.ReadDir(j.OutputDir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Debugf("[ListJobFiles] dir not found: %s", j.OutputDir)
			return nil, nil
		}
		return nil, xerrors.Errorf("ListJobFiles ReadDir: %w", err)
	}
	list := make([]*JobFileInfo, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		log.Debugf("[ListJobFiles] file: %s (isDir=%v, size=%d)", e.Name(), e.IsDir(), info.Size())
		list = append(list, &JobFileInfo{
			Name:    e.Name(),
			Path:    filepath.Join(j.OutputDir, e.Name()),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			IsDir:   e.IsDir(),
		})
	}
	log.Debugf("[ListJobFiles] returning %d files", len(list))
	return list, nil
}

// GetImageBase64 は指定パスの画像を base64 データ URI として返す。
// 任意ファイル読み取りを防ぐため、パスは登録済み作業ディレクトリ配下に限定する。
func GetImageBase64(ctx context.Context, path string) (string, error) {
	if err := requireWorkDirFileAccess(ctx, path); err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", xerrors.Errorf("GetImageBase64: %w", err)
	}
	mime := "image/png"
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

// ZipJobData は job の OutputDir 全体を ZIP 圧縮して savePath に書き出す。
func ZipJobData(ctx context.Context, id string, savePath string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("ZipJobData GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return err
	}
	// none(0/1) または deleted(4/5) はデータなし。modified(8/9) は一部残存のため許可。
	if j.DataStatus == model.JobDataNone || j.DataStatus == model.JobDataNoneLocked ||
		j.DataStatus == model.JobDataDeleted || j.DataStatus == model.JobDataDeletedLocked {
		return xerrors.New("data is not available")
	}
	if j.OutputDir == "" {
		return xerrors.New("output directory is not set")
	}
	if _, err := os.Stat(j.OutputDir); os.IsNotExist(err) {
		return xerrors.New("output directory does not exist")
	}

	f, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("ZipJobData Create: %w", err)
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	defer zw.Close()

	return filepath.Walk(j.OutputDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		rel, err := filepath.Rel(j.OutputDir, path)
		if err != nil {
			return err
		}
		w, err := zw.Create(filepath.ToSlash(rel))
		if err != nil {
			return err
		}
		src, err := os.Open(path)
		if err != nil {
			return err
		}
		defer src.Close()
		_, err = io.Copy(w, src)
		return err
	})
}

// GetJobLog は job の OutputDir にある render.log の内容を返す。
// ファイルが存在しない場合は空文字を返す。
func GetJobLog(ctx context.Context, id string) (string, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return "", xerrors.Errorf("GetJobLog GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return "", err
	}
	if j.OutputDir == "" {
		return "", nil
	}
	logPath := filepath.Join(j.OutputDir, "render.log")
	data, err := os.ReadFile(logPath)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", xerrors.Errorf("GetJobLog ReadFile: %w", err)
	}
	return string(data), nil
}

// ZipJobSelectedFiles は job の OutputDir 内の指定ファイルのみを ZIP 圧縮して savePath に書き出す。
// OutputDir 外を指すパスは無視する（任意ファイルの吸い出しを防ぐ）。
func ZipJobSelectedFiles(ctx context.Context, id string, filePaths []string, savePath string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return err
	}
	absOut, err := filepath.Abs(j.OutputDir)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles Abs: %w", err)
	}
	f, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles Create: %w", err)
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()
	for _, path := range filePaths {
		absP, absErr := filepath.Abs(path)
		if absErr != nil {
			continue
		}
		rel, relErr := filepath.Rel(absOut, absP)
		if relErr != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			continue // OutputDir 外は無視
		}
		w, err := zw.Create(filepath.ToSlash(rel))
		if err != nil {
			return err
		}
		src, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(w, src)
		src.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

// DeleteJobFiles は job の OutputDir 内の指定ファイルを削除する。
// ロック中のジョブは削除不可。OutputDir 外のパスは無視する。
// 削除後、ファイルが残っていれば JobDataModified、全削除なら JobDataDeleted にステータスを更新する。
func DeleteJobFiles(ctx context.Context, id string, filePaths []string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJobFiles GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 1 {
		return xerrors.New("ロック中のジョブのファイルは削除できません")
	}
	absOut, err := filepath.Abs(j.OutputDir)
	if err != nil {
		return xerrors.Errorf("DeleteJobFiles Abs: %w", err)
	}
	for _, p := range filePaths {
		absP, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		rel, err := filepath.Rel(absOut, absP)
		if err != nil || len(rel) >= 2 && rel[:2] == ".." {
			continue // OutputDir 外は無視
		}
		os.Remove(absP)
	}
	// 残存ファイルを確認してステータスを更新
	hasFiles := false
	_ = filepath.WalkDir(absOut, func(_ string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			hasFiles = true
		}
		return nil
	})
	newStatus := model.JobDataModified
	if !hasFiles {
		newStatus = model.JobDataDeleted
	}
	return model.UpdateJobDataStatus(ctx, id, newStatus)
}
