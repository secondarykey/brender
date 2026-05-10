package api

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	xdraw "golang.org/x/image/draw"
	"golang.org/x/xerrors"
)

func CreateThumbnailWorkspace(projectID string, file *model.ProjectFile) error {
	blenderPath, err := resolveBlenderPath(file.BlenderInstallID, 0)
	if err != nil {
		return err
	}

	st, err := exec.ResolveScene(blenderPath, file.Path, "")
	if err != nil {
		return err
	}

	mid := (st.Start + st.End) / 2
	name := file.Name + " Thumbnail"

	ws, err := model.CreateSystemWorkspace(projectID, file.ID, name, mid, mid)
	if err != nil {
		return err
	}

	_, err = Enqueue(projectID, ws.ID)
	return err
}

// GetFileThumbnail はファイルのサムネイル画像を base64 データURIで返す。
// {ProjectRoot}/{projectID}/{fileID}/thumbnail.jpg が存在すればそれを返す。
// 存在しない場合は IsSystem ワークスペースの完了済みジョブ出力から JPEG を生成して保存する。
// サムネイルが作れない場合は空文字を返す（エラーなし）。
func GetFileThumbnail(projectID string, fileID uint) (string, error) {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", nil
	}

	thumbDir := filepath.Join(env.ProjectRoot, projectID, fmt.Sprintf("%d", fileID))
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")

	if _, err := os.Stat(thumbPath); err == nil {
		return imageToBase64(thumbPath)
	}

	ws, err := model.GetSystemWorkspaceByFile(fileID)
	if err != nil || ws == nil {
		return "", nil
	}

	job, err := model.GetLatestCompletedJobByWorkspace(ws.ID)
	if err != nil || job == nil {
		return "", nil
	}

	imagePath, err := findFirstImage(job.OutputDir)
	if err != nil || imagePath == "" {
		return "", nil
	}

	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("convertToJPEG: %w", err)
	}

	return imageToBase64(thumbPath)
}

func findFirstImage(dir string) (string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext == ".png" || ext == ".jpg" || ext == ".jpeg" {
			return filepath.Join(dir, e.Name()), nil
		}
	}
	return "", nil
}

const thumbSize = 640

func convertToJPEG(src, dstDir, dstPath string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return xerrors.Errorf("read: %w", err)
	}

	var src_img image.Image
	ext := strings.ToLower(filepath.Ext(src))
	switch ext {
	case ".png":
		src_img, err = png.Decode(bytes.NewReader(data))
	case ".jpg", ".jpeg":
		src_img, err = jpeg.Decode(bytes.NewReader(data))
	default:
		return xerrors.Errorf("unsupported format: %s", ext)
	}
	if err != nil {
		return xerrors.Errorf("decode: %w", err)
	}

	canvas := image.NewRGBA(image.Rect(0, 0, thumbSize, thumbSize))
	// 背景を黒で塗りつぶす
	for y := 0; y < thumbSize; y++ {
		for x := 0; x < thumbSize; x++ {
			canvas.Set(x, y, color.Black)
		}
	}

	// アスペクト比を保ったまま 640x640 内に収めるスケールを計算
	bounds := src_img.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()
	scale := float64(thumbSize) / float64(srcW)
	if h := float64(srcH) * scale; h > thumbSize {
		scale = float64(thumbSize) / float64(srcH)
	}
	fitW := int(float64(srcW) * scale)
	fitH := int(float64(srcH) * scale)

	// 中央に配置するオフセット
	offsetX := (thumbSize - fitW) / 2
	offsetY := (thumbSize - fitH) / 2
	dst_rect := image.Rect(offsetX, offsetY, offsetX+fitW, offsetY+fitH)

	xdraw.BiLinear.Scale(canvas, dst_rect, src_img, bounds, xdraw.Over, nil)

	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return xerrors.Errorf("mkdir: %w", err)
	}

	f, err := os.Create(dstPath)
	if err != nil {
		return xerrors.Errorf("create: %w", err)
	}
	defer f.Close()

	return jpeg.Encode(f, canvas, &jpeg.Options{Quality: 85})
}

func imageToBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", xerrors.Errorf("imageToBase64: %w", err)
	}
	mime := "image/jpeg"
	if strings.ToLower(filepath.Ext(path)) == ".png" {
		mime = "image/png"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}
