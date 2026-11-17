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
// サービス（Wails のバインディング）は呼び出しの ctx をそのまま api 層へ渡す。
//   - ブラウザ（サーバモード）から: 認証ミドルウェアが検証済みユーザを ctx に載せる（api/rest/auth.go）
//   - デスクトップのウィンドウから: ctx にユーザが無い → currentUser が owner とみなす
// バックグラウンド処理は SystemContext（owner）を使う。
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

// RequireWorkDirFileAccess は requireWorkDirFileAccess の公開ラッパー。
// サーバモードの /_movie など、生パスを配信するハンドラで使う。
func RequireWorkDirFileAccess(ctx context.Context, path string) error {
	return requireWorkDirFileAccess(ctx, path)
}

// workDirRel は path を、それを含む作業ディレクトリからの相対パスにして返す。
// どの作業ディレクトリの配下でもなければ ErrPathOutsideWorkDir。作業ディレクトリ自身は ".".
func workDirRel(path string) (string, error) {
	if path == "" {
		return "", ErrPathOutsideWorkDir
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", xerrors.Errorf("workDirRel: %w", err)
	}
	abs = filepath.Clean(abs)
	dirs, err := model.ListWorkDirs()
	if err != nil {
		return "", xerrors.Errorf("workDirRel: %w", err)
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
			return rel, nil
		}
	}
	return "", ErrPathOutsideWorkDir
}

// requireWorkDirFileAccess は作業ディレクトリの中のファイルを読む権限を確かめる。
// 作業ディレクトリの外なら ErrPathOutsideWorkDir。中なら置き場所
// （{workDir}/{projectID}/{fileID}/...、または {workDir}/{projectID}/thumbnail.jpg）から
// どのファイル・プロジェクトのものかを決め、その参照権限を求める。
// 置き場所の分からない（プロジェクトの外の）ファイルは owner だけが読める。
func requireWorkDirFileAccess(ctx context.Context, path string) error {
	rel, err := workDirRel(path)
	if err != nil {
		return err
	}
	if fullAccess(ctx) {
		return nil
	}
	parts := strings.Split(rel, string(filepath.Separator))
	switch {
	case len(parts) >= 3:
		return requireFileInProjectAccess(ctx, parts[0], parts[1])
	case len(parts) == 2:
		return requireProjectAccess(ctx, parts[0])
	default:
		return ErrAccessDenied
	}
}

// requireImageSource はサムネイルの元にする画像のパスを読んでよいかを確かめる。
// ウィンドウからは利用者がファイルのダイアログで選んだ手元の画像なので、どこでもよい。
// ブラウザからのパスはサーバの上のパスなので、作業ディレクトリの中の読める画像だけにする
// （サーバの任意の画像を JPEG にして受け取られないように）。
func requireImageSource(ctx context.Context, path string) error {
	if !FromBrowser(ctx) {
		return nil
	}
	return requireWorkDirFileAccess(ctx, path)
}

// requireFileInProjectAccess は fileID がプロジェクト projectID のファイルであることと、その参照権限を求める。
func requireFileInProjectAccess(ctx context.Context, projectID, fileID string) error {
	if err := checkResourceIDs(projectID, fileID, ""); err != nil {
		return err
	}
	return requireFileAccess(ctx, fileID)
}

// checkResourceIDs は別々に受け取った ID の組が正しいか（fileID がプロジェクト projectID のもの、
// workspaceID がファイル fileID のもの）を確かめる。空の ID は確かめない。
// 権限はファイル単位で見るため、権限のあるファイルの ID に別のファイルのワークスペースや
// 別のプロジェクトを組み合わせて、見えないはずのものに届かないようにする。
// ID はパスにもなるので、DB に無い ID（"../.." など）もここで断る。
func checkResourceIDs(projectID, fileID, workspaceID string) error {
	if fileID != "" {
		f, err := model.GetProjectFile(fileID)
		if err != nil {
			return xerrors.Errorf("checkResourceIDs: %w", err)
		}
		if f == nil || f.ProjectID != projectID {
			return ErrAccessDenied
		}
	}
	if workspaceID != "" {
		w, err := model.SelectWorkspace(projectID, workspaceID)
		if err != nil || w == nil || (fileID != "" && w.ProjectFileID != fileID) {
			return ErrAccessDenied
		}
	}
	return nil
}

// SystemContext はシステムが自分で行う処理（起動時の確認など）の操作コンテキストを返す。
// owner として振る舞う。監査カラムにも owner が残る。
func SystemContext() context.Context {
	return model.WithUser(context.Background(), model.UserIDOwner)
}

// backgroundContext は、利用者の操作から始まってバックグラウンドで続く処理（サムネイルの自動生成・
// データの移動など）の ctx を返す。権限は owner（SystemContext）で、記録（監査カラム）には操作した人を残す。
// 呼び出しの ctx は呼び出しが終わると取り消されることがあるので、goroutine にはそのまま渡さずこれを渡す。
func backgroundContext(ctx context.Context) context.Context {
	return model.WithAuditUser(SystemContext(), model.AuditUser(ctx))
}

// jobContext は、キューの実行・リカバリなど、ジョブについてシステムが行う処理の ctx を返す。
// 権限は owner で、記録にはジョブを投入した人（Job.CreatedBy）を残す。
func jobContext(j *model.Job) context.Context {
	if j == nil || j.CreatedBy == "" {
		return SystemContext()
	}
	return model.WithAuditUser(SystemContext(), j.CreatedBy)
}

// runner 以上（レンダリング実行・キャンセル・ジョブ操作）。
var rolesRunnerUp = []string{model.RoleOwner, model.RoleWorkspaceCreator, model.RoleEditor, model.RoleRunner}

// editor 以上（設定変更・サムネイル設定）。
var rolesEditorUp = []string{model.RoleOwner, model.RoleWorkspaceCreator, model.RoleEditor}

// workspace_creator 以上（ワークスペース作成・削除・コピー）。
var rolesWorkspaceCreatorUp = []string{model.RoleOwner, model.RoleWorkspaceCreator}
