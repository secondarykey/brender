package api

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

// アクセス制御の共通ヘルパー。
//
// 権限判定の「唯一の情報源」は context に紐付いたユーザ（model.WithUser）とする。
// REST モードでは認証ミドルウェアが検証済みユーザを ctx に載せる。
// Wails（デスクトップ）モードでは常に owner を載せる（wailsCtx）。
//
// アクセス制御が有効になるのは「サーバモード かつ ユーザ管理オン」のときだけ
// （AGENTS.md「権限・アクセス制御」参照）。それ以外は全チェックをバイパスする。

// ErrAccessDenied は権限不足を表す。
var ErrAccessDenied = xerrors.New("access denied")

// currentUser は ctx から操作ユーザIDを解決する。
// 未設定時は owner にフォールバックする（Wails デスクトップの単一ユーザ運用）。
func currentUser(ctx context.Context) string {
	if id, ok := model.UserFromContext(ctx); ok {
		return id
	}
	return model.UserIDOwner
}

type browserCtxKey struct{}

// WithBrowser は ctx に「ブラウザ（サーバモードの HTTP）からの呼び出し」の印を付ける。
// 印を付けるのはサーバモードの HTTP サーバだけ。デスクトップのウィンドウからの呼び出しは
// そのサーバを通らないので印が無い。ヘッダー等のリクエストの中身からは決めない（偽れるため）。
func WithBrowser(ctx context.Context) context.Context {
	return context.WithValue(ctx, browserCtxKey{}, true)
}

// FromBrowser は ctx がブラウザからの呼び出しかを返す。
// サムネイルを URL で返す・サーバの画面でウィンドウを開く操作を断る、などの分かれ道に使う。
func FromBrowser(ctx context.Context) bool {
	v, _ := ctx.Value(browserCtxKey{}).(bool)
	return v
}

// ErrNotAvailableFromBrowser はブラウザからは使えない操作（サーバの画面でウィンドウを開く等）を表す。
var ErrNotAvailableFromBrowser = xerrors.New("not available from browser")

// authActive はユーザ単位のアクセス制御が有効かを返す。
// サーバモード かつ ServerAuth が true のときのみ有効。
func authActive() bool {
	env, err := model.GetEnv()
	if err != nil || env == nil {
		return false
	}
	return env.Server && env.ServerAuth
}

// fullAccess はチェック不要（全アクセス可）かを返す。
// 操作ユーザが owner、またはアクセス制御が無効のとき true。
// owner 判定を先に行い、デスクトップ（常に owner）では GetEnv を引かずに済ませる。
func fullAccess(ctx context.Context) bool {
	return currentUser(ctx) == model.UserIDOwner || !authActive()
}

// requireAdmin は操作ユーザが admin ロールを持つことを要求する。
// 設定変更・ユーザ管理・Blender 登録など、システム全体に影響する操作に使う。
func requireAdmin(ctx context.Context) error {
	if fullAccess(ctx) {
		return nil
	}
	u, err := model.GetUser(currentUser(ctx))
	if err != nil {
		return xerrors.Errorf("requireAdmin: %w", err)
	}
	if u == nil || u.EffectiveRole() != model.UserRoleAdmin {
		return ErrAccessDenied
	}
	return nil
}

// RequireAdmin は REST の admin 限定エンドポイント用の公開ラッパー。
func RequireAdmin(ctx context.Context) error {
	return requireAdmin(ctx)
}

// requireCreateProject はプロジェクト作成権限を要求する。
func requireCreateProject(ctx context.Context) error {
	ok, err := model.CanCreateProject(currentUser(ctx))
	if err != nil {
		return xerrors.Errorf("requireCreateProject: %w", err)
	}
	if !ok {
		return ErrAccessDenied
	}
	return nil
}

// requireProjectAccess はプロジェクトへの参照権限（いずれかのロール）を要求する。
func requireProjectAccess(ctx context.Context, projectID string) error {
	if fullAccess(ctx) {
		return nil
	}
	ok, err := model.HasProjectAccess(projectID, currentUser(ctx))
	if err != nil {
		return xerrors.Errorf("requireProjectAccess: %w", err)
	}
	if !ok {
		return ErrAccessDenied
	}
	return nil
}

// requireProjectRole はプロジェクトで指定ロールのいずれかを要求する。
func requireProjectRole(ctx context.Context, projectID string, roles ...string) error {
	if fullAccess(ctx) {
		return nil
	}
	ok, err := model.HasProjectRole(projectID, currentUser(ctx), roles)
	if err != nil {
		return xerrors.Errorf("requireProjectRole: %w", err)
	}
	if !ok {
		return ErrAccessDenied
	}
	return nil
}

// requireFileAccess はファイルへの参照権限（いずれかのロール）を要求する。
func requireFileAccess(ctx context.Context, fileID string) error {
	if fullAccess(ctx) {
		return nil
	}
	ok, err := model.HasFileAccess(fileID, currentUser(ctx))
	if err != nil {
		return xerrors.Errorf("requireFileAccess: %w", err)
	}
	if !ok {
		return ErrAccessDenied
	}
	return nil
}

// requireFileRole はファイルで指定ロールのいずれかを要求する。
// fileID が空の場合はチェックをスキップする（ファイル未確定の操作向け）。
func requireFileRole(ctx context.Context, fileID string, roles ...string) error {
	if fullAccess(ctx) || fileID == "" {
		return nil
	}
	ok, err := model.HasFileRole(fileID, currentUser(ctx), roles)
	if err != nil {
		return xerrors.Errorf("requireFileRole: %w", err)
	}
	if !ok {
		return ErrAccessDenied
	}
	return nil
}

// ── よく使うロール集合 ──────────────────────────────────────

// ErrPathOutsideWorkDir はパスが作業ディレクトリ外を指しているエラー。
var ErrPathOutsideWorkDir = xerrors.New("path is outside the work directories")

// ValidateWorkDirPath は validateWorkDirPath の公開ラッパー。
// サーバモードの /_movie など、生パスを配信するハンドラで使う。
func ValidateWorkDirPath(path string) error {
	return validateWorkDirPath(path)
}

// validateWorkDirPath は path が登録済み作業ディレクトリのいずれかの配下にあることを検証する。
// 生パスを受け取る API（画像プレビュー等）の任意ファイルアクセスを防ぐ。
func validateWorkDirPath(path string) error {
	if path == "" {
		return ErrPathOutsideWorkDir
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return xerrors.Errorf("validateWorkDirPath: %w", err)
	}
	abs = filepath.Clean(abs)
	dirs, err := model.ListWorkDirs()
	if err != nil {
		return xerrors.Errorf("validateWorkDirPath: %w", err)
	}
	for _, wd := range dirs {
		base, err := filepath.Abs(wd.Path)
		if err != nil {
			continue
		}
		base = filepath.Clean(base)
		rel, err := filepath.Rel(base, abs)
		if err != nil {
			continue
		}
		// base 自身、または base 配下（".." で始まらない）なら許可
		if rel == "." || (!strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != "..") {
			return nil
		}
	}
	return ErrPathOutsideWorkDir
}

// WailsContext は Wails（デスクトップ）モードの操作コンテキストを返す。
// デスクトップは単一ユーザ運用のため常に owner として振る舞う。
func WailsContext() context.Context {
	return model.WithUser(context.Background(), model.UserIDOwner)
}

// runner 以上（レンダリング実行・キャンセル・ジョブ操作）。
var rolesRunnerUp = []string{model.RoleOwner, model.RoleWorkspaceCreator, model.RoleEditor, model.RoleRunner}

// editor 以上（設定変更・サムネイル設定）。
var rolesEditorUp = []string{model.RoleOwner, model.RoleWorkspaceCreator, model.RoleEditor}

// workspace_creator 以上（ワークスペース作成・削除・コピー）。
var rolesWorkspaceCreatorUp = []string{model.RoleOwner, model.RoleWorkspaceCreator}
