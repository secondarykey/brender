package api

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/secondarykey/brender/model"
)

// admin 限定の api 関数が、関数の中で admin を確かめているかを見る。
// サービス(Wails のバインディング)はブラウザからも呼べるため、REST の registerAdmin だけに頼れない。
func TestAdminOnlyFunctions(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "test.db")
	if err := model.Init(dsn); err != nil {
		t.Fatalf("Init: %v", err)
	}
	// Windows では接続を閉じないと TempDir のクリーンアップが失敗する。
	t.Cleanup(func() { model.Close() })

	// アクセス制御はサーバモードかつユーザ管理オンのときだけ効く
	if err := model.SetEnvironment(&model.Environment{Server: true, ServerAuth: true}); err != nil {
		t.Fatalf("SetEnvironment: %v", err)
	}
	creator, err := model.CreateUser("creator", "Creator", model.UserRoleCreator)
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	admins := map[string]func(ctx context.Context) error{
		"SetServer":              func(ctx context.Context) error { return SetServer(ctx, true, "", 8080, true) },
		"SetFfmpegSettings":      func(ctx context.Context) error { return SetFfmpegSettings(ctx, FfmpegSettings{}) },
		"SetOutputFormat":        func(ctx context.Context) error { return SetOutputFormat(ctx, "png") },
		"SetMaxConcurrentJobs":   func(ctx context.Context) error { return SetMaxConcurrentJobs(ctx, 2) },
		"RegisterBlender":        func(ctx context.Context) error { _, err := RegisterBlender(ctx, "x"); return err },
		"DeleteBlender":          func(ctx context.Context) error { return DeleteBlender(ctx, 1) },
		"BlenderReferences":      func(ctx context.Context) error { _, err := BlenderReferences(ctx, 1); return err },
		"ResetBlenderReferences": func(ctx context.Context) error { _, err := ResetBlenderReferences(ctx, 1); return err },
		"ReorderBlenders":        func(ctx context.Context) error { return ReorderBlenders(ctx, nil) },
		"OpenBlenderFile":        func(ctx context.Context) error { return OpenBlenderFile(ctx, 1, "x.blend") },
		"KillRunningQueuesByUser": func(ctx context.Context) error {
			return KillRunningQueuesByUser(ctx)
		},
		"CreateWorkDir":      func(ctx context.Context) error { _, err := CreateWorkDir(ctx, "x", 0); return err },
		"UpdateWorkDir":      func(ctx context.Context) error { _, err := UpdateWorkDir(ctx, 1, "x", 0, ""); return err },
		"ReorderWorkDirs":    func(ctx context.Context) error { return ReorderWorkDirs(ctx, nil) },
		"DeleteWorkDir":      func(ctx context.Context) error { return DeleteWorkDir(ctx, 1) },
		"CheckWorkDir":       func(ctx context.Context) error { _, err := CheckWorkDir(ctx, "x"); return err },
		"StartChangeWorkDir": func(ctx context.Context) error { return StartChangeWorkDir(ctx, 1, "x") },
		"SaveImageFormats":   func(ctx context.Context) error { return SaveImageFormats(ctx, nil) },
		"SaveVideoFormats":   func(ctx context.Context) error { return SaveVideoFormats(ctx, nil) },
		"SaveResolutionPresets": func(ctx context.Context) error {
			return SaveResolutionPresets(ctx, nil)
		},
		"ResetImageFormats":      func(ctx context.Context) error { return ResetImageFormats(ctx) },
		"ResetVideoFormats":      func(ctx context.Context) error { return ResetVideoFormats(ctx) },
		"ResetResolutionPresets": func(ctx context.Context) error { return ResetResolutionPresets(ctx) },
		"CreateUser":             func(ctx context.Context) error { _, err := CreateUser(ctx, "x", "", ""); return err },
		"UpdateUser":             func(ctx context.Context) error { _, err := UpdateUser(ctx, "x", "x", "", ""); return err },
		"DeleteUser":             func(ctx context.Context) error { return DeleteUser(ctx, "x") },
		"CreateGroup":            func(ctx context.Context) error { _, err := CreateGroup(ctx, "x"); return err },
		"UpdateGroup":            func(ctx context.Context) error { _, err := UpdateGroup(ctx, "x", "x"); return err },
		"DeleteGroup":            func(ctx context.Context) error { return DeleteGroup(ctx, "x") },
		"AddUserToGroup":         func(ctx context.Context) error { return AddUserToGroup(ctx, "x", "x") },
		"RemoveUserFromGroup":    func(ctx context.Context) error { return RemoveUserFromGroup(ctx, "x", "x") },
		"ListUsersWithStatus":    func(ctx context.Context) error { _, err := ListUsersWithStatus(ctx); return err },
		"GetActiveResetToken":    func(ctx context.Context) error { _, err := GetActiveResetToken(ctx, "x"); return err },
		"GenerateResetToken":     func(ctx context.Context) error { _, err := GenerateResetToken(ctx, "x"); return err },
	}

	for _, userID := range []string{creator.ID, model.UserIDGuest} {
		ctx := model.WithUser(context.Background(), userID)
		for name, fn := range admins {
			if err := fn(ctx); !errors.Is(err, ErrAccessDenied) {
				t.Errorf("%s(user=%s): want ErrAccessDenied, got %v", name, userID, err)
			}
		}
	}

	// owner(デスクトップのウィンドウからの呼び出し)は通る
	owner := model.WithUser(context.Background(), model.UserIDOwner)
	if _, err := CreateGroup(owner, "group"); err != nil {
		t.Errorf("CreateGroup(owner): %v", err)
	}
	if _, err := ListUsersWithStatus(context.Background()); err != nil {
		t.Errorf("ListUsersWithStatus(no user = owner): %v", err)
	}
}
