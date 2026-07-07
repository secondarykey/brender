package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	stdDraw "image/draw"
	"image/jpeg"
	"image/png"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/anthonynsimon/bild/blur"
	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	xdraw "golang.org/x/image/draw"
	"golang.org/x/xerrors"
)

// thumbnailPath はサムネイル種別ごとの thumbnail.jpg のパスを返す（必要なら生成する）。
// workspaceID != "" → ワークスペース、fileID != "" → ファイル、どちらも "" → プロジェクト。
// 生成できない場合は ok=false。base64 版・URL 版・HTTP 配信で共用する。
func thumbnailPath(projectID, fileID, workspaceID string) (string, bool) {
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", false
	}

	switch {
	case workspaceID != "":
		dir := filepath.Join(baseDir, projectID, fileID, workspaceID)
		p := filepath.Join(dir, "thumbnail.jpg")
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
		job, err := model.GetLatestJobForThumbnail(workspaceID)
		if err != nil || job == nil {
			return "", false
		}
		img, _ := findFirstImage(job.OutputDir)
		if img == "" || convertToJPEG(img, dir, p) != nil {
			return "", false
		}
		return p, true

	case fileID != "":
		dir := filepath.Join(baseDir, projectID, fileID)
		p := filepath.Join(dir, "thumbnail.jpg")
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
		ws, err := model.GetSystemWorkspaceByFile(fileID)
		if err != nil || ws == nil {
			return "", false
		}
		job, err := model.GetLatestJobForThumbnail(ws.ID)
		if err != nil || job == nil {
			return "", false
		}
		img, _ := findFirstImage(job.OutputDir)
		if img == "" || convertToJPEG(img, dir, p) != nil {
			return "", false
		}
		return p, true

	default:
		p := filepath.Join(baseDir, projectID, "thumbnail.jpg")
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
		return "", false
	}
}

// thumbnailURL はサーバモードでサムネイルを配信する相対URLを返す。
// 生成できない場合は "" を返す（フロントは空ならプレースホルダ表示・再取得する）。
// mtime を v クエリに付けて再生成時にブラウザキャッシュを更新する。
func thumbnailURL(projectID, fileID, workspaceID string) string {
	p, ok := thumbnailPath(projectID, fileID, workspaceID)
	if !ok {
		return ""
	}
	q := url.Values{}
	q.Set("project_id", projectID)
	if fileID != "" {
		q.Set("file_id", fileID)
	}
	if workspaceID != "" {
		q.Set("workspace_id", workspaceID)
	}
	if info, err := os.Stat(p); err == nil {
		q.Set("v", fmt.Sprintf("%d", info.ModTime().Unix()))
	}
	return "/thumbnail?" + q.Encode()
}

// GetFileThumbnailURL はファイルサムネイルの配信URLを返す（サーバモード用）。
func GetFileThumbnailURL(ctx context.Context, projectID, fileID string) (string, error) {
	if err := requireFileAccess(ctx, fileID); err != nil {
		return "", err
	}
	return thumbnailURL(projectID, fileID, ""), nil
}

// GetProjectThumbnailURL はプロジェクトサムネイルの配信URLを返す（サーバモード用）。
func GetProjectThumbnailURL(ctx context.Context, projectID string) (string, error) {
	if err := requireProjectAccess(ctx, projectID); err != nil {
		return "", err
	}
	return thumbnailURL(projectID, "", ""), nil
}

// GetWorkspaceThumbnailURL はワークスペースサムネイルの配信URLを返す（サーバモード用）。
func GetWorkspaceThumbnailURL(ctx context.Context, projectID, fileID, workspaceID string) (string, error) {
	if err := requireFileAccess(ctx, fileID); err != nil {
		return "", err
	}
	return thumbnailURL(projectID, fileID, workspaceID), nil
}

// ServeThumbnailPath は HTTP 配信用にサムネイルの実パスを返す（アクセス権限チェック込み）。
// プロジェクト配下（fileID あり）はファイルアクセス、それ以外はプロジェクトアクセスで判定する。
func ServeThumbnailPath(ctx context.Context, projectID, fileID, workspaceID string) (string, error) {
	if fileID != "" {
		if err := requireFileAccess(ctx, fileID); err != nil {
			return "", err
		}
	} else {
		if err := requireProjectAccess(ctx, projectID); err != nil {
			return "", err
		}
	}
	p, ok := thumbnailPath(projectID, fileID, workspaceID)
	if !ok {
		return "", nil
	}
	return p, nil
}

func CreateThumbnailWorkspace(ctx context.Context, projectID string, file *model.ProjectFile) error {
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

	ws, err := model.CreateSystemWorkspace(projectID, file.ID, name, mid, mid, 8)
	if err != nil {
		return err
	}

	_, err = TestEnqueue(ctx, projectID, ws.ID, TestRenderParams{
		StartFrame: mid,
		EndFrame:   mid,
	})
	return err
}

// GetFileThumbnail はファイルのサムネイル画像を base64 データURIで返す。
// {baseDir}/{projectID}/{fileID}/thumbnail.jpg が存在すればそれを返す。
// 存在しない場合は IsSystem ワークスペースの完了済みジョブ出力から JPEG を生成して保存する。
// サムネイルが作れない場合は空文字を返す（エラーなし）。
func GetFileThumbnail(projectID string, fileID string) (string, error) {
	p, ok := thumbnailPath(projectID, fileID, "")
	if !ok {
		return "", nil
	}
	return imageToBase64(p)
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

const (
	thumbW = 640
	thumbH = 360
)

// makeBlurredBackground は元画像をカバースケールで 640×360 に拡大クロップし、
// bild/blur でガウスブラーをかけた背景を返す。
func makeBlurredBackground(src image.Image, bounds image.Rectangle, srcW, srcH int) *image.RGBA {
	coverScaleX := float64(thumbW) / float64(srcW)
	coverScaleY := float64(thumbH) / float64(srcH)
	coverScale := coverScaleX
	if coverScaleY > coverScale {
		coverScale = coverScaleY
	}
	coverW := int(float64(srcW) * coverScale)
	coverH := int(float64(srcH) * coverScale)

	covered := image.NewRGBA(image.Rect(0, 0, coverW, coverH))
	xdraw.BiLinear.Scale(covered, covered.Bounds(), src, bounds, xdraw.Src, nil)

	cropX := (coverW - thumbW) / 2
	cropY := (coverH - thumbH) / 2
	cropped := image.NewRGBA(image.Rect(0, 0, thumbW, thumbH))
	xdraw.Copy(cropped, image.Point{}, covered, image.Rect(cropX, cropY, cropX+thumbW, cropY+thumbH), xdraw.Src, nil)

	blurred := blur.Gaussian(cropped, 20)
	canvas := image.NewRGBA(image.Rect(0, 0, thumbW, thumbH))
	stdDraw.Draw(canvas, canvas.Bounds(), blurred, image.Point{}, stdDraw.Src)
	return canvas
}

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

	bounds := src_img.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	scaleX := float64(thumbW) / float64(srcW)
	scaleY := float64(thumbH) / float64(srcH)
	scale := scaleX
	if scaleY < scale {
		scale = scaleY
	}
	fitW := int(float64(srcW) * scale)
	fitH := int(float64(srcH) * scale)

	canvas := makeBlurredBackground(src_img, bounds, srcW, srcH)

	offsetX := (thumbW - fitW) / 2
	offsetY := (thumbH - fitH) / 2
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

// SetProjectThumbnail は imagePath の画像を 640x360 JPEG に変換してプロジェクトサムネイルとして保存し、base64 データURIを返す。
func SetProjectThumbnail(projectID, imagePath string) (string, error) {
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetProjectThumbnail: %w", err)
	}
	thumbDir := filepath.Join(baseDir, projectID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetProjectThumbnail: %w", err)
	}
	return imageToBase64(thumbPath)
}

// SetFileThumbnail は imagePath の画像を 640x360 JPEG に変換してファイルサムネイルとして保存し、base64 データURIを返す。
func SetFileThumbnail(projectID, fileID, imagePath string) (string, error) {
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetFileThumbnail: %w", err)
	}
	thumbDir := filepath.Join(baseDir, projectID, fileID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetFileThumbnail: %w", err)
	}
	return imageToBase64(thumbPath)
}

// SetWorkspaceThumbnail は imagePath の画像を 640x360 JPEG に変換してワークスペースサムネイルとして保存し、base64 データURIを返す。
func SetWorkspaceThumbnail(ctx context.Context, projectID, fileID, workspaceID, imagePath string) (string, error) {
	// editor 以上の権限が必要（サムネイル設定）
	if err := requireFileRole(ctx, fileID, rolesEditorUp...); err != nil {
		return "", err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetWorkspaceThumbnail: %w", err)
	}
	thumbDir := filepath.Join(baseDir, projectID, fileID, workspaceID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetWorkspaceThumbnail: %w", err)
	}
	return imageToBase64(thumbPath)
}

// SetFileThumbnailFromWorkspace はワークスペースのサムネイル（またはジョブ出力）をファイルサムネイルとして保存し、base64 データURIを返す。
func SetFileThumbnailFromWorkspace(ctx context.Context, projectID, fileID, workspaceID string) (string, error) {
	// editor 以上の権限が必要（サムネイル設定）
	if err := requireFileRole(ctx, fileID, rolesEditorUp...); err != nil {
		return "", err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetFileThumbnailFromWorkspace: %w", err)
	}

	wsThumbPath := filepath.Join(baseDir, projectID, fileID, workspaceID, "thumbnail.jpg")
	fileThumbDir := filepath.Join(baseDir, projectID, fileID)
	fileThumbPath := filepath.Join(fileThumbDir, "thumbnail.jpg")

	srcPath := ""
	if _, err := os.Stat(wsThumbPath); err == nil {
		srcPath = wsThumbPath
	} else {
		job, err := model.GetLatestJobForThumbnail(workspaceID)
		if err != nil || job == nil {
			return "", xerrors.New("サムネイルにする画像が見つかりません")
		}
		imagePath, err := findFirstImage(job.OutputDir)
		if err != nil || imagePath == "" {
			return "", xerrors.New("サムネイルにする画像が見つかりません")
		}
		srcPath = imagePath
	}

	if err := convertToJPEG(srcPath, fileThumbDir, fileThumbPath); err != nil {
		return "", xerrors.Errorf("SetFileThumbnailFromWorkspace: %w", err)
	}
	return imageToBase64(fileThumbPath)
}

// SetProjectThumbnailFromFile はファイルのサムネイル（またはジョブ出力）をプロジェクトサムネイルとして保存し、base64 データURIを返す。
func SetProjectThumbnailFromFile(projectID, fileID string) (string, error) {
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetProjectThumbnailFromFile: %w", err)
	}

	fileThumbPath := filepath.Join(baseDir, projectID, fileID, "thumbnail.jpg")
	projectThumbDir := filepath.Join(baseDir, projectID)
	projectThumbPath := filepath.Join(projectThumbDir, "thumbnail.jpg")

	srcPath := ""
	if _, err := os.Stat(fileThumbPath); err == nil {
		srcPath = fileThumbPath
	} else {
		ws, err := model.GetSystemWorkspaceByFile(fileID)
		if err != nil || ws == nil {
			return "", xerrors.New("サムネイルにする画像が見つかりません")
		}
		job, err := model.GetLatestJobForThumbnail(ws.ID)
		if err != nil || job == nil {
			return "", xerrors.New("サムネイルにする画像が見つかりません")
		}
		imagePath, err := findFirstImage(job.OutputDir)
		if err != nil || imagePath == "" {
			return "", xerrors.New("サムネイルにする画像が見つかりません")
		}
		srcPath = imagePath
	}

	if err := convertToJPEG(srcPath, projectThumbDir, projectThumbPath); err != nil {
		return "", xerrors.Errorf("SetProjectThumbnailFromFile: %w", err)
	}
	return imageToBase64(projectThumbPath)
}

// GetProjectThumbnail はプロジェクトのサムネイル画像を base64 データURIで返す。
// {baseDir}/{projectID}/thumbnail.jpg が存在すればそれを返す。存在しない場合は空文字を返す。
func GetProjectThumbnail(projectID string) (string, error) {
	p, ok := thumbnailPath(projectID, "", "")
	if !ok {
		return "", nil
	}
	return imageToBase64(p)
}

// GetWorkspaceThumbnail はワークスペースのサムネイル画像を base64 データURIで返す。
// {baseDir}/{projectID}/{fileID}/{workspaceID}/thumbnail.jpg が存在すればそれを返す。
// 存在しない場合はそのワークスペースの完了済みジョブ出力から JPEG を生成して保存する。
// サムネイルが作れない場合は空文字を返す（エラーなし）。
func GetWorkspaceThumbnail(projectID, fileID, workspaceID string) (string, error) {
	p, ok := thumbnailPath(projectID, fileID, workspaceID)
	if !ok {
		return "", nil
	}
	return imageToBase64(p)
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
