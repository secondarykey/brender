---
name: brender-access-control
description: >
  Brender の権限・アクセス制御の詳細仕様。サーバモードのマルチユーザ運用における3階層ロールシステム
  （アプリレベル User.Role、プロジェクトレベル ProjectPermission、ファイルレベル FilePermission）、
  context.Context 経由のユーザ識別（model.WithUser / currentUser）、api/access.go の共通ヘルパー
  （fullAccess / requireProjectRole / requireFileRole / requireAdmin / requireCreateProject）、
  ブラウザから呼ばれるサービスの守り（api 層の requireAdmin・owner 限定・リソース認証・生パス検証・
  api.FromBrowser）、
  フロントエンドの権限制御（PermissionSection・作成権限チェック・HasFileAccess）を扱う。
  api/access.go・model/user.go・model/tag.go・api/rest/ の認証まわり・PermissionSection.jsx を
  変更するとき、または権限・ロール・ユーザ管理・グループ・アクセス制御に関する作業のときは
  必ずこのSkillを参照すること。
---

# Brender 権限・アクセス制御

サーバモードで複数ユーザが利用する場合のアクセス制御。3階層のロールシステムで構成される。

## 前提: ユーザ管理の有効条件

権限チェックは `Environment.Server=true` かつ `Environment.ServerAuth=true` のときのみ有効（`api/access.go` の `authActive()` が判定）。
いずれかが `false`（Wails デスクトップモード、またはサーバモードでユーザ管理オフ）の場合、**全ての権限チェックをバイパス**し全員フルアクセスとなる。

判定は `api/access.go` の共通ヘルパーに集約されている（各 api 関数は自前で `if userID != owner {...}` を書かない）:
- `fullAccess(ctx)` — owner、またはアクセス制御無効ならチェック不要。
- `requireProjectRole` / `requireProjectAccess` / `requireFileRole` / `requireFileAccess` — 指定ロール/参照権限を要求。
- `requireAdmin(ctx)` — admin ロールを要求（設定変更・Blender 登録・ユーザ管理など）。
- `requireCreateProject(ctx)` — プロジェクト作成権限を要求。

## 1. アプリレベルロール (`User.Role`)

ユーザ単位の全体権限。プロジェクト作成や管理操作を制御する。

| ロール | 値 | 操作 |
|---|---|---|
| admin | `"admin"` | 全操作可（設定変更・ユーザ管理・プロジェクト作成） |
| creator | `"creator"` | プロジェクト作成可 |
| viewer | `"viewer"` | 閲覧のみ（プロジェクト作成不可） |

**システムユーザのロールはハードコード**:
- `usr_owner` (BrenderOwner) → 常に `admin`
- `usr_guest` (Guest) → 常に `viewer`
- 一般ユーザの `Role` が空の場合 → `creator`（後方互換）

**判定関数**: `model.CanCreateProject(userID)` — `ServerAuth` が無効なら即 `true`。有効なら `EffectiveRole()` が `admin` または `creator` かチェック。

## 2. プロジェクトレベル権限 (`ProjectPermission`)

プロジェクト単位でユーザ/グループに付与される。

| ロール | 主な操作 |
|---|---|
| `owner` | プロジェクト設定変更・削除・権限管理 |
| `editor` | プロジェクト設定の一部変更 |
| `file_register` | ファイルの追加登録 |
| `viewer` | 閲覧のみ |

**デフォルト権限** (`SetDefaultProjectPermissions`): プロジェクト作成時に自動付与。
- 作成者 → `owner`
- `usr_owner` → `owner`（作成者と異なる場合）
- `grp_all` (All Users) → `viewer`

## 3. ファイルレベル権限 (`FilePermission`)

`.blend` ファイル単位でユーザ/グループに付与される。

| ロール | 優先順位 | 主な操作 |
|---|---|---|
| `owner` | 6 | ファイル設定変更・削除・権限管理 |
| `workspace_creator` | 5 | ワークスペースの作成 |
| `editor` | 4 | ファイル設定の一部変更 |
| `runner` | 3 | レンダリング実行 |
| `viewer` | 1 | 閲覧のみ |

ファイル追加時に `CopyProjectPermissionsToFile()` でプロジェクト権限をコピーする。

## 権限解決の仕組み

- `TargetID` は `usr_*`（ユーザ）または `grp_*`（グループ）のいずれか
- `collectTargetIDs(userID)` — ユーザ自身 + `grp_all` + 所属グループの全ID を収集
- 複数のロールがマッチした場合、**最上位のロールを採用**（`GetUserProjectRole` / `GetUserFileRole`）
- `HasProjectAccess` / `HasFileAccess` — いずれかの権限があるかの bool 判定

## ユーザ識別 (`model/user.go`, `api/access.go`)

**権限判定の唯一の情報源は `context.Context` に載せた操作ユーザ**。api 層の関数は第1引数に `ctx` を受け取り、`currentUser(ctx)`（未設定時は `usr_owner` にフォールバック）で解決する。

```go
model.WithUser(ctx, userID)      // ctx にユーザを紐付ける
model.UserFromContext(ctx)       // ctx からユーザを取り出す
```

サービス（`_cmd/brender/services/`）はメソッドの第1引数 `ctx` を受け、そのまま api 層へ渡す。ウィンドウでもブラウザでも同じメソッドが呼ばれる:

- **ブラウザ（サーバモード）から**: 認証ミドルウェア（`api/rest/auth.go`）がセッション検証後に `model.WithUser(...)` で ctx へ注入し、`POST /wails/runtime` の守り（`api/rest/runtime.go`）が `api.WithBrowser` の印を付けて Wails へ渡す。ユーザ管理が有効なのに ctx に利用者が無い呼び出しは 401 で通さない。
- **デスクトップのウィンドウから**: ctx に利用者が無い → `currentUser` が `usr_owner` とみなす。デスクトップは単一ユーザ運用のため常にフルアクセス。
- **バックグラウンド処理**: `api.SystemContext()`（owner）を使う（サムネイル自動生成など）。

**`model.CurrentUser()` / goroutine-local storage** は監査カラム（`CreatedBy` / `UpdatedBy`）専用のベストエフォート機構に格下げされた。権限判定には使わない（そちらは ctx が唯一の情報源）。GORM の監査コールバックはクエリ ctx のユーザを優先し、なければ goroutine-local にフォールバックする（`model.auditUser`）。

## フロントエンドの権限制御

**PermissionSection コンポーネント** (`src/components/PermissionSection.jsx`):
- `mode='project'` / `mode='file'` で API を切り替え
- Wails モードでは `EnvironmentApi.get()` で `server && server_auth` をチェック → 無効なら `return null`（非表示）
- ブラウザモードでは常に表示

**プロジェクト作成権限チェック** (`ProjectListPage.jsx`):
- ブラウザモードで `AuthApi.me()` を呼びロールを確認
- `me()` が `null`（認証無効 = ユーザ管理オフ）→ フルアクセス
- `role` が `admin` / `creator` → 作成可、`viewer` → 作成不可

**ジョブ履歴のファイルアクセス制御** (`QueuePage.jsx`, `JobManagement.jsx`):
- `Job.HasFileAccess` (`gorm:"-"` フィールド) — `ListJobsPaged` で API 層がファイルID ごとにキャッシュして設定
- `has_file_access === false` のジョブ → 行クリック・ダイアログ・ナビゲーションを抑制、ファイル名をリンクではなく淡色テキストで表示

## ブラウザから呼ばれるサービスの守り

**サービスに登録したメソッドは選別なしに全部ブラウザから呼べる**（Wails の Transport。Skill `brender-server-mode`）。REST 側でまとめて守る口は無いので、守りは api 層とサービスの中に置く。

- **admin 限定の操作**: api の関数の中で `requireAdmin(ctx)` を通す（`api/access_test.go` が admin 以外で `ErrAccessDenied` になることを確かめている。admin 関数を足したらここにも足す）。api を通らない操作（ログの取得・レベル変更）はサービスで `api.RequireAdmin(ctx)`。対象は設定変更（`environment/set_*`）、Blender 登録・削除・並べ替え・GUI 起動（`blender register/delete/reorder/open_file`）、作業ディレクトリ管理（`work_dir create/update/reorder/delete/change_dir/check_dir`）、コード管理（`api/codes.go` の `Save*`/`Reset*`）、キューの強制終了（`KillRunningQueuesByUser`）、システムログ（`Environment.GetSystemLog` / `SetLogLevel`）、ユーザ・グループ管理系（`auth` の create/update/delete/add/remove、リセットトークン、`list_users_with_status`）。
- **プロジェクト/ファイル owner 限定**: 権限付与・剥奪（`project set_permission` / `remove_permission` / `set_file_permission` / `remove_file_permission`）は `api.SetProjectPermission` 等の中で `requireProjectRole(owner)` / `requireFileRole(owner)` を通す（admin ではなく対象リソースの owner）。
- **ブラウザからは断る操作**: ウィンドウを開く・サーバの画面を使うメソッド（`Queue.Open*Window`・`OpenMiniMonitor`・`CloseMiniMonitor`・`Environment.OpenSystemLogWindow`）は `api.FromBrowser(ctx)` なら `api.ErrNotAvailableFromBrowser`。**ヘッダー（`x-wails-window-id`）や `application.WindowKey` で判定しない**（ブラウザが偽れる）
- **Wails の決まった API**: `Application.Quit`・`Events.Emit` などはウィンドウ無しでも通るため、`POST /wails/runtime` の守りで `object` を 0（呼び出し）と 10（取り消し）に絞っている
- **リソースの認証**: `/_movie`（ローカルファイル配信）・`/events`（SSE）・`/wails/*`（バインディング呼び出し）は SPA ではなくリソースのため、未認証時は SPA を返さず 401 を返す（`handleUnauthorized`）。
- **生パスの検証**: 生ファイルパスを受け取る口は登録済み作業ディレクトリ配下に限定する。`queue/get_image_base64` は `validateWorkDirPath`、サーバモード `/_movie` は `api.ValidateWorkDirPath` で検証。`zip_job_selected_files` は OutputDir 外のパスを無視する。
