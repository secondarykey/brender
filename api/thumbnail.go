package api

import (
	"bytes"
	"encoding/base64"
	"image"
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

	ws, err := model.CreateSystemWorkspace(projectID, file.ID, name, mid, mid, 8)
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
func GetFileThumbnail(projectID string, fileID string) (string, error) {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", nil
	}

	thumbDir := filepath.Join(env.ProjectRoot, projectID, fileID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")

	if _, err := os.Stat(thumbPath); err == nil {
		return imageToBase64(thumbPath)
	}

	ws, err := model.GetSystemWorkspaceByFile(fileID)
	if err != nil || ws == nil {
		return "", nil
	}

	job, err := model.GetLatestJobForThumbnail(ws.ID)
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

const (
	thumbW = 640
	thumbH = 360
)

// makeBlurredBackground は元画像をカバースケールで 640×360 に拡大クロップし、
// 極小サイズへのダウンスケール→アップスケールでブラー効果を付けた背景を返す。
func makeBlurredBackground(src image.Image, bounds image.Rectangle, srcW, srcH int) *image.RGBA {
	// cover スケール: 短辺ではなく長辺基準で全面を埋める
	coverScaleX := float64(thumbW) / float64(srcW)
	coverScaleY := float64(thumbH) / float64(srcH)
	coverScale := coverScaleX
	if coverScaleY > coverScale {
		coverScale = coverScaleY
	}
	coverW := int(float64(srcW) * coverScale)
	coverH := int(float64(srcH) * coverScale)

	// 元画像を cover サイズにスケール
	covered := image.NewRGBA(image.Rect(0, 0, coverW, coverH))
	xdraw.BiLinear.Scale(covered, covered.Bounds(), src, bounds, xdraw.Src, nil)

	// 中央クロップで 640×360 を切り出す
	cropX := (coverW - thumbW) / 2
	cropY := (coverH - thumbH) / 2
	cropped := image.NewRGBA(image.Rect(0, 0, thumbW, thumbH))
	xdraw.Copy(cropped, image.Point{}, covered, image.Rect(cropX, cropY, cropX+thumbW, cropY+thumbH), xdraw.Src, nil)

	// ブラー: 極小サイズへダウンスケールしてから元サイズへアップスケール
	const blurW, blurH = 32, 18
	tiny := image.NewRGBA(image.Rect(0, 0, blurW, blurH))
	xdraw.BiLinear.Scale(tiny, tiny.Bounds(), cropped, cropped.Bounds(), xdraw.Src, nil)
	blurred := image.NewRGBA(image.Rect(0, 0, thumbW, thumbH))
	xdraw.BiLinear.Scale(blurred, blurred.Bounds(), tiny, tiny.Bounds(), xdraw.Src, nil)

	return blurred
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

	// アスペクト比を保ったまま 640x360 内に収めるスケールを計算 (contain)
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
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", xerrors.New("作業ディレクトリが設定されていません")
	}
	thumbDir := filepath.Join(env.ProjectRoot, projectID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetProjectThumbnail: %w", err)
	}
	return imageToBase64(thumbPath)
}

// SetFileThumbnail は imagePath の画像を 640x360 JPEG に変換してファイルサムネイルとして保存し、base64 データURIを返す。
func SetFileThumbnail(projectID, fileID, imagePath string) (string, error) {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", xerrors.New("作業ディレクトリが設定されていません")
	}
	thumbDir := filepath.Join(env.ProjectRoot, projectID, fileID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetFileThumbnail: %w", err)
	}
	return imageToBase64(thumbPath)
}

// SetWorkspaceThumbnail は imagePath の画像を 640x360 JPEG に変換してワークスペースサムネイルとして保存し、base64 データURIを返す。
func SetWorkspaceThumbnail(projectID, fileID, workspaceID, imagePath string) (string, error) {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", xerrors.New("作業ディレクトリが設定されていません")
	}
	thumbDir := filepath.Join(env.ProjectRoot, projectID, fileID, workspaceID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetWorkspaceThumbnail: %w", err)
	}
	return imageToBase64(thumbPath)
}

// SetFileThumbnailFromWorkspace はワークスペースのサムネイル（またはジョブ出力）をファイルサムネイルとして保存し、base64 データURIを返す。
func SetFileThumbnailFromWorkspace(projectID, fileID, workspaceID string) (string, error) {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", xerrors.New("作業ディレクトリが設定されていません")
	}

	wsThumbPath := filepath.Join(env.ProjectRoot, projectID, fileID, workspaceID, "thumbnail.jpg")
	fileThumbDir := filepath.Join(env.ProjectRoot, projectID, fileID)
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
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", xerrors.New("作業ディレクトリが設定されていません")
	}

	fileThumbPath := filepath.Join(env.ProjectRoot, projectID, fileID, "thumbnail.jpg")
	projectThumbDir := filepath.Join(env.ProjectRoot, projectID)
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
// {ProjectRoot}/{projectID}/thumbnail.jpg が存在すればそれを返す。存在しない場合は空文字を返す。
func GetProjectThumbnail(projectID string) (string, error) {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", nil
	}
	thumbPath := filepath.Join(env.ProjectRoot, projectID, "thumbnail.jpg")
	if _, err := os.Stat(thumbPath); err != nil {
		return "", nil
	}
	return imageToBase64(thumbPath)
}

// GetWorkspaceThumbnail はワークスペースのサムネイル画像を base64 データURIで返す。
// {ProjectRoot}/{projectID}/{fileID}/{workspaceID}/thumbnail.jpg が存在すればそれを返す。
// 存在しない場合はそのワークスペースの完了済みジョブ出力から JPEG を生成して保存する。
// サムネイルが作れない場合は空文字を返す（エラーなし）。
func GetWorkspaceThumbnail(projectID, fileID, workspaceID string) (string, error) {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.ProjectRoot == "" {
		return "", nil
	}

	thumbDir := filepath.Join(env.ProjectRoot, projectID, fileID, workspaceID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")

	if _, err := os.Stat(thumbPath); err == nil {
		return imageToBase64(thumbPath)
	}

	job, err := model.GetLatestJobForThumbnail(workspaceID)
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
