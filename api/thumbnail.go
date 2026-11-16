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
	"github.com/secondarykey/brender/model"
	xdraw "golang.org/x/image/draw"
	"golang.org/x/xerrors"
)

// thumbnailPath はサムネイル種別ごとの thumbnail.jpg のパスを返す（必要なら生成する）。
// workspaceID != "" → ワークスペース、fileID != "" → ファイル、どちらも "" → プロジェクト。
// 生成できない場合は ok=false。取得・設定・HTTP 配信で共用する。
func thumbnailPath(projectID, fileID, workspaceID string) (string, bool) {
	// 権限はファイル単位で見るので、ID の組が正しいことをここで確かめる（checkResourceIDs）
	if checkResourceIDs(projectID, fileID, workspaceID) != nil {
		return "", false
	}
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
		job, err := model.GetLatestTestJobByFile(fileID)
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

// thumbnailRef は path のサムネイルを画面へ渡す形にする。ウィンドウには base64 のデータ URI、
// ブラウザには URL（GET /thumbnail）。URL ならブラウザのキャッシュ（304）が効く。
// 返す形はここだけで決める（取得・設定のどの関数もここを通す）。
func thumbnailRef(ctx context.Context, path, projectID, fileID, workspaceID string) (string, error) {
	if !FromBrowser(ctx) {
		return imageToBase64(path)
	}
	q := url.Values{}
	q.Set("project_id", projectID)
	if fileID != "" {
		q.Set("file_id", fileID)
	}
	if workspaceID != "" {
		q.Set("workspace_id", workspaceID)
	}
	// 作り直したら URL を変えてキャッシュを使わせない。秒では、同じ秒に2回設定したときに古い画像が出る
	if info, err := os.Stat(path); err == nil {
		q.Set("v", fmt.Sprintf("%d", info.ModTime().UnixNano()))
	}
	return "/thumbnail?" + q.Encode(), nil
}

// getThumbnail はサムネイルを画面へ渡す形で返す（必要なら作る）。作れなければ空文字（エラーなし）。
func getThumbnail(ctx context.Context, projectID, fileID, workspaceID string) (string, error) {
	p, ok := thumbnailPath(projectID, fileID, workspaceID)
	if !ok {
		return "", nil
	}
	return thumbnailRef(ctx, p, projectID, fileID, workspaceID)
}

// GetFileThumbnail はファイルのサムネイルを返す（{baseDir}/{projectID}/{fileID}/thumbnail.jpg）。
// 無ければそのファイルの最新の完了した Test ジョブの出力から作って保存する。作れなければ空文字（エラーなし）。
func GetFileThumbnail(ctx context.Context, projectID, fileID string) (string, error) {
	if err := requireFileAccess(ctx, fileID); err != nil {
		return "", err
	}
	return getThumbnail(ctx, projectID, fileID, "")
}

// GetProjectThumbnail はプロジェクトのサムネイルを返す（{baseDir}/{projectID}/thumbnail.jpg）。無ければ空文字。
func GetProjectThumbnail(ctx context.Context, projectID string) (string, error) {
	if err := requireProjectAccess(ctx, projectID); err != nil {
		return "", err
	}
	return getThumbnail(ctx, projectID, "", "")
}

// GetWorkspaceThumbnail はワークスペースのサムネイルを返す（{baseDir}/{projectID}/{fileID}/{workspaceID}/thumbnail.jpg）。
// 無ければそのワークスペースの完了済みジョブの出力から作って保存する。作れなければ空文字（エラーなし）。
func GetWorkspaceThumbnail(ctx context.Context, projectID, fileID, workspaceID string) (string, error) {
	if err := requireFileAccess(ctx, fileID); err != nil {
		return "", err
	}
	return getThumbnail(ctx, projectID, fileID, workspaceID)
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

// defaultWorkspaceName はファイル登録時に作るワークスペースの名前。
const defaultWorkspaceName = "Default"

// CreateDefaultWorkspace はファイル登録時に、ワークスペース「Default」（既定の設定）を作り、
// そこで Test 出力（中間フレーム1枚・サンプル8）を投入する。
// ファイルのサムネイルは、このファイルの Test ジョブの出力から作る（thumbnailPath）。
func CreateDefaultWorkspace(ctx context.Context, projectID string, file *model.ProjectFile) error {
	ws, err := model.CreateWorkspace(projectID, file.ID, defaultWorkspaceName)
	if err != nil {
		return err
	}
	// 開始 0・終了 -1 はシーンのフレーム範囲を使う（TestEnqueue がその中間の1枚を出す）
	_, err = TestEnqueue(ctx, projectID, ws.ID, TestRenderParams{StartFrame: 0, EndFrame: -1})
	return err
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

// SetProjectThumbnail は imagePath の画像を 640x360 JPEG に変換してプロジェクトサムネイルとして保存し、画面へ渡す形（thumbnailRef）で返す。
// プロジェクトの owner・editor だけ。
func SetProjectThumbnail(ctx context.Context, projectID, imagePath string) (string, error) {
	if err := requireProjectRole(ctx, projectID, model.RoleOwner, model.RoleEditor); err != nil {
		return "", err
	}
	if err := requireImageSource(ctx, imagePath); err != nil {
		return "", err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetProjectThumbnail: %w", err)
	}
	thumbDir := filepath.Join(baseDir, projectID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetProjectThumbnail: %w", err)
	}
	return thumbnailRef(ctx, thumbPath, projectID, "", "")
}

// SetFileThumbnail は imagePath の画像を 640x360 JPEG に変換してファイルサムネイルとして保存し、画面へ渡す形（thumbnailRef）で返す。
func SetFileThumbnail(ctx context.Context, projectID, fileID, imagePath string) (string, error) {
	// editor 以上の権限が必要（サムネイル設定）
	if err := requireFileRole(ctx, fileID, rolesEditorUp...); err != nil {
		return "", err
	}
	if err := checkResourceIDs(projectID, fileID, ""); err != nil {
		return "", err
	}
	if err := requireImageSource(ctx, imagePath); err != nil {
		return "", err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetFileThumbnail: %w", err)
	}
	thumbDir := filepath.Join(baseDir, projectID, fileID)
	thumbPath := filepath.Join(thumbDir, "thumbnail.jpg")
	if err := convertToJPEG(imagePath, thumbDir, thumbPath); err != nil {
		return "", xerrors.Errorf("SetFileThumbnail: %w", err)
	}
	return thumbnailRef(ctx, thumbPath, projectID, fileID, "")
}

// SetWorkspaceThumbnail は imagePath の画像を 640x360 JPEG に変換してワークスペースサムネイルとして保存し、画面へ渡す形（thumbnailRef）で返す。
func SetWorkspaceThumbnail(ctx context.Context, projectID, fileID, workspaceID, imagePath string) (string, error) {
	// editor 以上の権限が必要（サムネイル設定）
	if err := requireFileRole(ctx, fileID, rolesEditorUp...); err != nil {
		return "", err
	}
	if err := checkResourceIDs(projectID, fileID, workspaceID); err != nil {
		return "", err
	}
	if err := requireImageSource(ctx, imagePath); err != nil {
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
	return thumbnailRef(ctx, thumbPath, projectID, fileID, workspaceID)
}

// SetFileThumbnailFromWorkspace はワークスペースのサムネイル（またはジョブ出力）をファイルサムネイルとして保存し、画面へ渡す形（thumbnailRef）で返す。
func SetFileThumbnailFromWorkspace(ctx context.Context, projectID, fileID, workspaceID string) (string, error) {
	// editor 以上の権限が必要（サムネイル設定）
	if err := requireFileRole(ctx, fileID, rolesEditorUp...); err != nil {
		return "", err
	}
	if err := checkResourceIDs(projectID, fileID, workspaceID); err != nil {
		return "", err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetFileThumbnailFromWorkspace: %w", err)
	}

	// ワークスペースのサムネイル（無ければジョブの出力から作る）を元にする
	srcPath, ok := thumbnailPath(projectID, fileID, workspaceID)
	if !ok {
		return "", xerrors.New("サムネイルにする画像が見つかりません")
	}
	fileThumbDir := filepath.Join(baseDir, projectID, fileID)
	fileThumbPath := filepath.Join(fileThumbDir, "thumbnail.jpg")
	if err := convertToJPEG(srcPath, fileThumbDir, fileThumbPath); err != nil {
		return "", xerrors.Errorf("SetFileThumbnailFromWorkspace: %w", err)
	}
	return thumbnailRef(ctx, fileThumbPath, projectID, fileID, "")
}

// SetProjectThumbnailFromFile はファイルのサムネイル（またはジョブ出力）をプロジェクトサムネイルとして保存し、画面へ渡す形（thumbnailRef）で返す。
// プロジェクトの owner・editor で、そのファイルを見られる人だけ。
func SetProjectThumbnailFromFile(ctx context.Context, projectID, fileID string) (string, error) {
	if err := requireProjectRole(ctx, projectID, model.RoleOwner, model.RoleEditor); err != nil {
		return "", err
	}
	if err := requireFileInProjectAccess(ctx, projectID, fileID); err != nil {
		return "", err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("SetProjectThumbnailFromFile: %w", err)
	}

	// ファイルのサムネイル（無ければ Test ジョブの出力から作る）を元にする
	srcPath, ok := thumbnailPath(projectID, fileID, "")
	if !ok {
		return "", xerrors.New("サムネイルにする画像が見つかりません")
	}
	projectThumbDir := filepath.Join(baseDir, projectID)
	projectThumbPath := filepath.Join(projectThumbDir, "thumbnail.jpg")
	if err := convertToJPEG(srcPath, projectThumbDir, projectThumbPath); err != nil {
		return "", xerrors.Errorf("SetProjectThumbnailFromFile: %w", err)
	}
	return thumbnailRef(ctx, projectThumbPath, projectID, "", "")
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
