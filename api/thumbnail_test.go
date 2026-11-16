package api

import (
	"context"
	"image"
	"image/png"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/secondarykey/brender/model"
)

// サムネイルはウィンドウには base64 のデータ URI、ブラウザには URL で返す。取得も設定も同じ形。
func TestThumbnailRefByCaller(t *testing.T) {
	fx := newMoveFixture(t)
	// ブラウザからは作業ディレクトリの中の画像しか使えない（requireImageSource）
	src := filepath.Join(fx.oldWd.Path, fx.projectID, "src.png")
	f, err := os.Create(src)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(f, image.NewRGBA(image.Rect(0, 0, 32, 18))); err != nil {
		f.Close()
		t.Fatal(err)
	}
	f.Close()

	window := context.Background()
	browser := WithBrowser(window)

	// 設定
	got, err := SetProjectThumbnail(window, fx.projectID, src)
	if err != nil {
		t.Fatalf("SetProjectThumbnail(window): %v", err)
	}
	if !strings.HasPrefix(got, "data:image/jpeg;base64,") {
		t.Errorf("SetProjectThumbnail(window) = %.40q, want a data URI", got)
	}
	got, err = SetProjectThumbnail(browser, fx.projectID, src)
	if err != nil {
		t.Fatalf("SetProjectThumbnail(browser): %v", err)
	}
	checkThumbnailURL(t, got, fx.projectID)

	// 取得
	got, err = GetProjectThumbnail(window, fx.projectID)
	if err != nil || !strings.HasPrefix(got, "data:image/jpeg;base64,") {
		t.Errorf("GetProjectThumbnail(window) = %.40q, %v; want a data URI", got, err)
	}
	got, err = GetProjectThumbnail(browser, fx.projectID)
	if err != nil {
		t.Fatalf("GetProjectThumbnail(browser): %v", err)
	}
	checkThumbnailURL(t, got, fx.projectID)

	// 無ければ空文字（エラーなし）
	p, err := model.CreateProject("Empty", nil, fx.oldWd.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, ctx := range []context.Context{window, browser} {
		if got, err := GetProjectThumbnail(ctx, p.Project.ID); got != "" || err != nil {
			t.Errorf("GetProjectThumbnail(no thumbnail) = %q, %v; want empty", got, err)
		}
	}
}

func checkThumbnailURL(t *testing.T, got, projectID string) {
	t.Helper()
	u, err := url.Parse(got)
	if err != nil || u.Path != "/thumbnail" {
		t.Fatalf("got %q, want a /thumbnail URL", got)
	}
	q := u.Query()
	if q.Get("project_id") != projectID || q.Get("v") == "" {
		t.Errorf("query = %v, want project_id=%s and v", q, projectID)
	}
}
