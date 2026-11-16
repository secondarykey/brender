package api

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/secondarykey/brender/model"
)

// resourceFixture は権限の確認に使うプロジェクト・ファイル・ワークスペースの組。
//
//	hidden: owner だけのプロジェクト（user は見られない）
//	shared: user が viewer のプロジェクト（見られるが変えられない）
type resourceFixture struct {
	workDir   string
	user      string
	hiddenPrj string
	hiddenFil string
	hiddenWs  string
	sharedPrj string
	sharedFil string
	sharedWs  string
}

func newResourceFixture(t *testing.T) *resourceFixture {
	t.Helper()
	if err := model.Init(filepath.Join(t.TempDir(), "test.db")); err != nil {
		t.Fatalf("Init: %v", err)
	}
	// Windows では接続を閉じないと TempDir のクリーンアップが失敗する。
	t.Cleanup(func() { model.Close() })

	// アクセス制御はサーバモードかつユーザ管理オンのときだけ効く
	if err := model.SetEnvironment(&model.Environment{Server: true, ServerAuth: true}); err != nil {
		t.Fatalf("SetEnvironment: %v", err)
	}
	fx := &resourceFixture{workDir: t.TempDir()}
	wd := &model.WorkDir{Path: fx.workDir, Status: model.WorkDirStatusActive}
	if err := model.CreateWorkDir(wd); err != nil {
		t.Fatalf("CreateWorkDir: %v", err)
	}
	u, err := model.CreateUser("creator", "Creator", model.UserRoleCreator)
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	fx.user = u.ID

	mk := func(name string, viewer bool) (string, string, string) {
		p, err := model.CreateProject(name, []string{filepath.Join(fx.workDir, name+".blend")}, wd.ID)
		if err != nil {
			t.Fatalf("CreateProject: %v", err)
		}
		pid, fid := p.Project.ID, p.Files[0].ID
		if err := model.SetProjectPermission(pid, model.UserIDOwner, model.RoleOwner); err != nil {
			t.Fatalf("SetProjectPermission: %v", err)
		}
		if viewer {
			if err := model.SetProjectPermission(pid, fx.user, model.RoleViewer); err != nil {
				t.Fatalf("SetProjectPermission: %v", err)
			}
		}
		if err := model.CopyProjectPermissionsToFile(pid, fid); err != nil {
			t.Fatalf("CopyProjectPermissionsToFile: %v", err)
		}
		ws, err := model.CreateWorkspace(pid, fid, "Default")
		if err != nil {
			t.Fatalf("CreateWorkspace: %v", err)
		}
		return pid, fid, ws.ID
	}
	fx.hiddenPrj, fx.hiddenFil, fx.hiddenWs = mk("hidden", false)
	fx.sharedPrj, fx.sharedFil, fx.sharedWs = mk("shared", true)
	return fx
}

// ブラウザから呼べる api の関数が、見られない・変えられないプロジェクトやファイルを断るかを見る。
func TestResourceFunctionsDenyWithoutRole(t *testing.T) {
	fx := newResourceFixture(t)
	ctx := WithBrowser(model.WithUser(context.Background(), fx.user))

	hp, hf, hw := fx.hiddenPrj, fx.hiddenFil, fx.hiddenWs
	sp, sf, sw := fx.sharedPrj, fx.sharedFil, fx.sharedWs
	hiddenImage := filepath.Join(fx.workDir, hp, hf, hw, "job", "frame_0001.png")

	denied := map[string]func() error{
		// 見られないもの
		"PreviewRender":          func() error { _, err := PreviewRender(ctx, hp, hw); return err },
		"EnqueueWithPreview":     func() error { _, err := EnqueueWithPreview(ctx, hp, hw, &RenderPreview{}); return err },
		"GetScenes":              func() error { _, err := GetScenes(ctx, 0, hf); return err },
		"GetCameras":             func() error { _, err := GetCameras(ctx, 0, hf); return err },
		"GetToolData":            func() error { _, err := GetToolData(ctx, 0, hf); return err },
		"ListProjectPermissions": func() error { _, err := ListProjectPermissions(ctx, hp); return err },
		"GetUserProjectRole":     func() error { _, err := GetUserProjectRole(ctx, hp, fx.user); return err },
		"ListFilePermissions":    func() error { _, err := ListFilePermissions(ctx, hf); return err },
		"GetUserFileRole":        func() error { _, err := GetUserFileRole(ctx, hf, fx.user); return err },
		"GetProjectDiskSize":     func() error { _, err := GetProjectDiskSize(ctx, hp); return err },
		"GetFileTags":            func() error { _, err := GetFileTags(ctx, hf); return err },
		"GetImageBase64":         func() error { _, err := GetImageBase64(ctx, hiddenImage); return err },
		"GetFileThumbnail":       func() error { _, err := GetFileThumbnail(ctx, hp, hf); return err },
		"GetProjectThumbnail":    func() error { _, err := GetProjectThumbnail(ctx, hp); return err },
		"GetWorkspaceThumbnail":  func() error { _, err := GetWorkspaceThumbnail(ctx, hp, hf, hw); return err },

		// 見られるが変えられないもの（viewer）
		"PreviewRender(viewer)": func() error { _, err := PreviewRender(ctx, sp, sw); return err },
		"SetProjectThumbnail":   func() error { _, err := SetProjectThumbnail(ctx, sp, "x.png"); return err },
		"SetFileThumbnail":      func() error { _, err := SetFileThumbnail(ctx, sp, sf, "x.png"); return err },
		"SetProjectThumbnailFromFile": func() error {
			_, err := SetProjectThumbnailFromFile(ctx, sp, sf)
			return err
		},
		"AddTagToFile":      func() error { return AddTagToFile(ctx, sf, 1) },
		"RemoveTagFromFile": func() error { return RemoveTagFromFile(ctx, sf, 1) },
		"AssignTagByInput":  func() error { _, err := AssignTagByInput(ctx, sf, "tag"); return err },

		// admin だけのもの
		"ListAllProjectFiles":     func() error { _, err := ListAllProjectFiles(ctx); return err },
		"GetCleanableJobStats":    func() error { _, err := GetCleanableJobStats(ctx, &model.CleanFilter{}); return err },
		"MeasureFilteredDiskSize": func() error { _, err := MeasureFilteredDiskSize(ctx, &model.CleanFilter{}); return err },
		"GetWorkDirStats":         func() error { _, err := GetWorkDirStats(ctx, 1); return err },
		"CreateTagCategory":       func() error { _, err := CreateTagCategory(ctx, "c", ""); return err },
		"UpdateTagCategory":       func() error { _, err := UpdateTagCategory(ctx, 1, "c", ""); return err },
		"DeleteTagCategory":       func() error { return DeleteTagCategory(ctx, 1) },
		"ReorderTagCategories":    func() error { return ReorderTagCategories(ctx, nil) },
		"MergeTagCategories":      func() error { return MergeTagCategories(ctx, 1, 2) },
		"MergeTags":               func() error { return MergeTags(ctx, 1, 2) },
		"CreateTag":               func() error { _, err := CreateTag(ctx, "t", nil, ""); return err },
		"UpdateTag":               func() error { _, err := UpdateTag(ctx, 1, "t", nil, ""); return err },
		"DeleteTag":               func() error { return DeleteTag(ctx, 1) },
		"SetTagCategory":          func() error { return SetTagCategory(ctx, 1, nil) },
	}
	for name, fn := range denied {
		if err := fn(); !errors.Is(err, ErrAccessDenied) {
			t.Errorf("%s: want ErrAccessDenied, got %v", name, err)
		}
	}

	// 見られるものは読める
	if _, err := ListProjectPermissions(ctx, sp); err != nil {
		t.Errorf("ListProjectPermissions(shared): %v", err)
	}
	if _, err := GetFileTags(ctx, sf); err != nil {
		t.Errorf("GetFileTags(shared): %v", err)
	}
}

// 別々に受け取る ID の組み合わせで、見られないものに届かないことを見る。
func TestResourceIDsMustMatch(t *testing.T) {
	fx := newResourceFixture(t)
	ctx := WithBrowser(model.WithUser(context.Background(), fx.user))

	// 見られるファイルに、見られないファイルのワークスペースを組み合わせる
	if _, ok := thumbnailPath(fx.sharedPrj, fx.sharedFil, fx.hiddenWs); ok {
		t.Error("thumbnailPath: workspace of another file must not resolve")
	}
	if err := checkResourceIDs(fx.sharedPrj, fx.sharedFil, fx.hiddenWs); !errors.Is(err, ErrAccessDenied) {
		t.Errorf("checkResourceIDs(other workspace): want ErrAccessDenied, got %v", err)
	}
	// 見られるプロジェクトの下に、見られないファイルを置いたパス
	p := filepath.Join(fx.workDir, fx.sharedPrj, fx.hiddenFil, "thumbnail.jpg")
	if err := requireWorkDirFileAccess(ctx, p); !errors.Is(err, ErrAccessDenied) {
		t.Errorf("requireWorkDirFileAccess(file of another project): want ErrAccessDenied, got %v", err)
	}
	// パスになる ID に DB に無い値を入れても通らない
	if err := checkResourceIDs(fx.sharedPrj, "../"+fx.hiddenFil, ""); !errors.Is(err, ErrAccessDenied) {
		t.Errorf("checkResourceIDs(unknown file): want ErrAccessDenied, got %v", err)
	}

	// 見られるファイルの画像は読める（ファイルが無いので読み込みのエラーになる）
	ok := filepath.Join(fx.workDir, fx.sharedPrj, fx.sharedFil, fx.sharedWs, "job", "frame_0001.png")
	if err := requireWorkDirFileAccess(ctx, ok); err != nil {
		t.Errorf("requireWorkDirFileAccess(shared): %v", err)
	}
	// 作業ディレクトリの外は読めない
	if err := requireWorkDirFileAccess(ctx, filepath.Join(t.TempDir(), "x.png")); !errors.Is(err, ErrPathOutsideWorkDir) {
		t.Errorf("requireWorkDirFileAccess(outside): want ErrPathOutsideWorkDir, got %v", err)
	}
	// ブラウザからのサムネイルの元画像も、作業ディレクトリの外は断る
	if err := requireImageSource(ctx, filepath.Join(t.TempDir(), "x.png")); !errors.Is(err, ErrPathOutsideWorkDir) {
		t.Errorf("requireImageSource(browser, outside): want ErrPathOutsideWorkDir, got %v", err)
	}
	// ウィンドウからはダイアログで選んだ手元の画像なので、どこでもよい
	if err := requireImageSource(context.Background(), filepath.Join(t.TempDir(), "x.png")); err != nil {
		t.Errorf("requireImageSource(window): %v", err)
	}
}
