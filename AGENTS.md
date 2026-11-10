# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## ドキュメント分割

このファイルには常時必要な情報のみを置く。詳細は以下に分割されている:

| 内容 | 場所 | ロードのされ方 |
|---|---|---|
| フロントエンド規約（ページ構成・API ラッパー層・イベントバス・ダイアログ・トースト・i18n・テーマ・CSS） | `_cmd/brender/frontend/AGENTS.md` | frontend 配下のファイルを扱うときに参照 |
| レンダリングパイプライン詳細（キュー実行・リカバリ・ProcessingWriter・進捗・ETA・サムネイル生成・CLI 表示） | `_docs/skills/brender-render-pipeline/SKILL.md`（Skill `brender-render-pipeline`） | 該当作業時に参照 |
| 権限・アクセス制御（ロール体系・ctx ユーザ・ブラウザから呼ばれるサービスの守り・フロント制御） | `_docs/skills/brender-access-control/SKILL.md`（Skill `brender-access-control`） | 該当作業時に参照 |
| サーバモード（起動フロー・Wails の Transport・HTTP ルーティング・メソッド追加手順・認証/セッション・SSE・考慮事項チェックリスト） | `_docs/skills/brender-server-mode/SKILL.md`（Skill `brender-server-mode`） | 該当作業時に参照 |
| コード管理 `code/`（フォーマット・解像度プリセット、新カテゴリ追加手順） | `_docs/skills/brender-codes/SKILL.md`（Skill `brender-codes`） | 該当作業時に参照 |

Skill の正本は `_docs/skills/<名前>/SKILL.md`（git 管理。エージェントに依存しない参考資料としても読める）。`.claude/skills/` は git 管理外で、使うスキルはそこに置いてある名前で決まる。セッション開始時にユーザー環境のフックが、`.claude/skills` にある名前だけをそのチェックアウトの `_docs/skills` の版で置き直す（`_docs/skills` にあっても `.claude/skills` に無いものは配らない）。Skill を更新するときは必ず `_docs/skills` 側を編集してコミットすること（`.claude/skills` のコピーを編集しても次のセッション開始で上書きされる）。

## Project Overview

**Brender** is a Blender rendering management system. It has two runtime modes that share a common library:

- **Desktop app** (`_cmd/brender/`) — Wails3 GUI application. Manages Blender installations, projects, workspaces, and rendering queues via a React (Vite) frontend calling Go service bindings.
- **CLI tool** (`_cmd/brender-tool/`) — Standalone command-line renderer. Accepts a `.blend` file and renders it with live progress display in the terminal.

Both modes share the root-module packages (`exec/`, `model/`, `api/`).

## Build & Run Commands

### Desktop app (Wails3)
```bash
cd _cmd/brender
wails3 dev                 # Development (hot reload)
wails3 build               # Production build
wails3 generate bindings   # Regenerate Go<->JS bindings after adding/changing services
```

#### ローカルデプロイ（`local:deploy`、任意）

`_cmd/brender/Taskfile.local.yml`（**git 管理外**。各自が作る）を置くと、`wails3 task local:deploy` で
「起動中の brender を止める → パッチの自動 bump → バージョン・アプリ情報の反映 → `wails3 build` → ビルド情報だけのコミット → `v`+バージョンのタグ → `bin/*` を常用の場所へコピー」をまとめて行える。
`Taskfile.yml` が `optional: true` で include しているので、ファイルが無ければ何も起きない。中身は Skill `wails3` の `references/local-deploy.md` の標準テンプレート（`APP_NAME` は `brender`、製品名は `brender`）。

```bash
cd _cmd/brender
wails3 task local:deploy                           # Taskfile.local.yml の DEPLOY_DEST へ
wails3 task local:deploy DEPLOY_DEST="D:/tmp/app"  # コピー先を指定
wails3 task local:build-info                       # ビルド情報の反映だけ
go run _cmd/version.go -auto                       # （リポジトリルートで）v+現在の版のタグがあれば patch を上げる
```

- **CI とタグが重なる点に注意**: `main` への PR マージで versionup.yml も patch を上げて `v`+版のタグを打つ（release.yml がそのタグでビルド）。手元の deploy で打ったタグは push しない（軽量タグ）ので、CI は知らずに同じ名前のタグを別のコミットに打とうとする。手元のタグを push するか、CI の版上げの前に手元のタグを消す（`git tag -d v0.3.1`）かを決めてから進める
- deploy はアプリを起動していなくても通る（停止に `ignore_error: true`）。同じコミットで再 deploy してもパッチは上がる（直前の deploy がタグを打っているため）

The DB is stored at `~/.brender/brender.db` (SQLite, created automatically on first run). パスは `~/.brender/brender.ini` の `db_path` で上書き可（[起動設定ファイル](#起動設定ファイル-config-brenderini) 参照）。`model.Init` は DSN に `_pragma=journal_mode(WAL)` / `synchronous(NORMAL)` を付与し、サーバモードの同時アクセス時の `database is locked` を避ける（glebarez ドライバは接続ごとに `busy_timeout=5000ms` を既定で適用）。WAL 有効時は `brender.db-wal` / `-shm` が併設される。

### CLI tool
```bash
go build -o brender-tool ./_cmd/brender-tool/

brender-tool [-b <blender>] [-S <scene>] [-E <engine>] [-s <start>] [-e <end>] [-o <outdir>] [-v] [-a] <file.blend>
#   -b   Blender executable path (default: $BRENDER_BLENDER, then "blender")
#   -S   Scene name / -E   Render engine (e.g. CYCLES, BLENDER_EEVEE)
#   -s/-e  Start/end frame (default: read from .blend via --tool)
#   -o   Output directory
#   -v   Verbose: pipe all Blender stdout directly to terminal
#   -a   Analysis mode: render a 3-frame sample to estimate time
#   --engines / --scenes  List engines / scenes and exit
```

### Tests
```bash
go test ./...
go test ./exec/...
```
`exec/` の `TestVersion`/`TestEngines` はローカルにハードコードされた Blender インストールパスに依存するため、実機に該当バージョンが無い環境では失敗する（既知の環境依存、CI 想定外）。

フロントエンド（Vitest + Testing Library、`_cmd/brender/frontend/src/test/setup.js` で jsdom セットアップ）:
```bash
cd _cmd/brender/frontend
npm test          # vitest run（CI 向け一括実行）
npm run test:watch  # vitest（watch モード）
```

## Architecture

```
_cmd/brender/  (Wails3 desktop app)
    frontend/  (React + Vite)
        src/lib/api/       ← API ラッパー層（ウィンドウ・ブラウザとも同じバインディングを呼ぶ）
        src/lib/appEvents.js ← イベントバス（Wails Events/SSE 切り替え）
        ↕ Wails3 JS bindings (frontend/bindings/)
    services/  (Wails サービス層 — thin wrappers registered in main.go。メソッドは第1引数 ctx を api 層へ渡す。wails3依存はこのモジュール内に閉じる)
    transport.go (サーバモード用の自作 Transport — ブラウザからのバインディング呼び出しを api/rest のサーバへつなぐ)
    main.go
        ↓
api/rest/      (サーバモードの HTTP サーバ — 認証・SSE・アップロード・/wails/runtime の守り。サービスのディスパッチは持たない)
        ↓
api/           (business logic, framework-agnostic。権限判定は context.Context 経由のユーザで行う。wails3非依存)
        ↓
model/         (GORM models + CRUD, SQLite via glebarez/sqlite)
exec/          (Blender subprocess management + output parsing)

_cmd/brender-tool/  (CLI, uses exec/ + api/ directly)
```

**ヘッドレス運用は不可**: サーバモードの HTTP サーバは Wails アプリのプロセス内（`app.Run()` が前提）で起動する。GUI なしの純ヘッドレスサーバとしては動かせない（設計上の制約）。(今の実装はいつもメインのウィンドウを作り、閉じるとアプリが終わる。ウィンドウを作らなくても `app.Run()` は動き続けると分かったので、`TODO.md` の「ウィンドウを出さずに動かす」で変える予定)

### Module layout
- Root モジュール `github.com/secondarykey/brender`（プロジェクトルートの `go.mod`）が正。`exec/`・`model/`・`api/`（`api/rest/` 含む）はwails3に依存しない。
- `_cmd/brender/` は独自の `go.mod`（`module main`）を持ち、root モジュールへの `replace` ディレクティブでローカル参照する。**wails3への依存はこのモジュール内（`_cmd/brender/services/` 等）にのみ許可する** — rootパッケージにwails3 importを持ち込まない。

### Wails3 services (`_cmd/brender/services/`)
| File | Type | Wraps |
|---|---|---|
| `services/blender.go` | `Blender` | `api/blender.go` |
| `services/environment.go` | `Environment` | `api/environment.go` |
| `services/project.go` | `Project` | `api/project.go` + `api/thumbnail.go` |
| `services/workspace.go` | `Workspace` | `api/workspace.go` |
| `services/queue.go` | `Queue` | `api/queue.go` |
| `services/work_dir.go` | `WorkDir` | `api/work_dir.go` |
| `services/codes.go` | `Codes` | `code/`（Skill `brender-codes` 参照） |

Services are registered in `_cmd/brender/main.go`（`main/services` としてimport）。After adding or changing a service, run `wails3 generate bindings` to update the frontend JS bindings.

`services.Blender.OpenFile(installID, filePath)` — Blender を GUI モードで起動（`-b` なし、`cmd.Start()` で非同期）。

### wails3バージョンのピン留め (`.github/variables`)
CI が使う wails3 CLI のバージョンは `.github/variables` の `WAILS_VERSION` 1箇所で固定する。`.github/workflows/release.yml`・`versionup.yml` が `cat .github/variables >> "$GITHUB_ENV"` で読み込む。バージョン整合性チェックはリポジトリ固有のツールを持たず、Skill `wails3`（`references/advanced.md`）の一般化された手順を使う。

## Data Model

### Hierarchy
`BlenderInstall` + `WorkDir` → `Project` + `ProjectFile` (`.blend` files) → `Workspace` (render settings) → `Job` (history) / `Queue` (active execution)

`Environment` はシステム全体の設定（`ProjectRoot` はデフォルト参照用のみ）。出力先は `Project.WorkDirID` → `WorkDir.Path` で解決する。

### Key model notes
- `Environment`: `ProjectRoot string`, `Server bool`, `MaxConcurrentJobs int` (デフォルト 1). No `BlenderCmd`/`BlenderVersion`/`Hash` fields (removed).
- `WorkDir`: `ID uint`, `Path string`, `Priority int`, `Status string` (`active`/`inactive`/`lock`). `GetDefaultWorkDir()` は `active` かつ `Priority` 最小を返す。
- `Project`: `ID string` (UUID v4), `Name`, `BlenderInstallID uint`, `Scene string`, `WorkDirID uint`. No `Archive` or `ThumbnailFrame` fields (removed).
- `ProjectFile`: `ID string` (UUID v4), `ProjectID`, `Path`, `Name`, `BlenderInstallID uint`, `Scene string`, `FileModifiedAt *time.Time`. `FileModifiedAt` is set from `os.Stat().ModTime()` on add.
- `Workspace`: `ID string` (UUID v4), `ProjectFileID string` (固定、Update では変更不可), `BlenderInstallID=0` means use project default, `IsSystem bool` (サムネイル自動生成ワークスペースは `true`)。
- `Job`: permanent history record. Shares UUID v7 with its `Queue` record. Has `ProjectFileID string` for direct file-based query.
  - `Status`: `completed` / `error` / `cancelled` / `interrupted`（システム中断）
  - `DiskSize int64`: 完了時に出力ディレクトリの容量を保存
  - `DataStatus int`: `0`=none / `1`=none+locked / `2`=available / `3`=available+locked / `4`=deleted / `5`=deleted+locked
  - `OutputDir string`: 出力先ディレクトリパス
- `Queue`: ephemeral active-execution record. Deleted by `finishJob()` on completion/error/cancel.
  - `Status`: `waiting` / `recovering`（リカバリ再実行待ち） / `running`

### UUID 発行ルール
| エンティティ | 関数 | バージョン |
|---|---|---|
| ProjectID / ProjectFileID / WorkspaceID | `uuid.NewRandom()` | v4 |
| QueueID / JobID | `uuid.NewV7()` | v7（時刻順ソート可） |

### ディレクトリ構造
```
{workDir.Path}/
  {projectID}/
    {fileID}/
      thumbnail.jpg          ← サムネイル画像（640×360 JPEG）
      {workspaceID}/
        {jobID}/
          frame_####.png     ← レンダリング出力フレーム
          render.log         ← Blender 標準出力ログ
```

## Key Concepts（要約）

詳細（実行フロー・パース仕様・ETA 計算・進捗バー計算式・リカバリ手順）は Skill `brender-render-pipeline` を参照。

- **非同期レンダリング** (`api/queue.go`): `Enqueue()` → `PreviewRender()` → `EnqueueWithPreview()`。Blender/シーン/エンジン/カメラのフォールバック解決は `resolveRenderBase()` に集約（優先順位を変える場合はここ一箇所を直す）。`MaxConcurrentJobs`（デフォルト 1）で同時実行制御、`scheduleMu` でレース防止。同一ワークスペースの重複投入は禁止で、重複チェック〜`CreateQueue` は `enqueueMu` で直列化。
- **起動時キューリカバリ**: クラッシュ後に残った `running` Queue を `RecoverStaleQueues()` が検出。旧 Job を `interrupted` で閉じ、新 Job+Queue（`recovering`）を作成して `StartRecoveredQueues()` で再実行する。孤立プロセスの kill は `killQueueProcess()` が実行ファイルを検証してから行う（PID 再利用による誤殺防止）。
- **イベント配信フック**: `api` 層は `var XxxHook func(...)` の関数変数でイベントを公開（`QueueChangedHook` / `BlenderWarningHook` / `MigrationHook` / `MovieCreatedHook` / `WorkDirChangeDirHook` / `SystemStatsHook`）。`main.go` は単一の `emit(name, data)` クロージャにまとめて Wails Event と SSE broker の両方へ配る。**新しいイベントも必ず `emit` を経由させる**（フックごとに SSE ラップを書くと漏れる）。
- **Job deletion**: `DeleteJob(id)` は `OutputDir` を `os.RemoveAll` してから DB レコードを削除する。
- **ProcessingWriter** (`exec/writer.go`): Blender stdout/stderr をリアルタイムパース。Blender 4.x/5.x 両対応、Cycles/EEVEE/Workbench のエンジン別検出、スレッドセーフ（`Result()` でスナップショット取得）。
- **進捗トラッキング** (`exec/progress.go`): Queue ID キーの in-memory map。`ListQueueItems()` が進捗フィールドを `QueueItem` に付与してフロントエンドへ渡す。
- **サムネイル自動生成** (`api/thumbnail.go`): `AddProjectFile` 時に非同期で `IsSystem=true` ワークスペースを作成し、中間フレームを 1 枚レンダリング → 640×360 JPEG で `thumbnail.jpg` に保存。取得は Wails=base64 データURI / サーバモード=URL 配信（`GET /thumbnail`）の 2 形態。
- **権限・アクセス制御**: `Environment.Server=true` かつ `ServerAuth=true` のときのみ有効（無効時は全員フルアクセス）。api 層の関数は第1引数 `ctx` の操作ユーザ（`model.WithUser` / `currentUser(ctx)`）で判定し、**`api/access.go` の共通ヘルパー（`fullAccess` / `requireProjectRole` / `requireAdmin` 等）を使う — 自前で `if userID != owner {...}` を書かない**。**サービスのメソッドは全部ブラウザからも呼べる**ため、admin 操作は api の関数の中で `requireAdmin(ctx)` を通し、ウィンドウを開く操作は `api.FromBrowser(ctx)` で断る。ロール体系・守り・フロント制御の詳細は Skill `brender-access-control` を参照。

### ログ (`log/`)

土台は `github.com/wenteasy/log`。作り方の決まりごとの正は wenteasy/log の README「使う側のやり方（自分の log パッケージを作る）」（ライブラリとしても使われる形）。

- **brender のコードは `brender/log` の関数でログを出す**（標準の `log`・`slog`・wenteasy/log を直接使わない）。`log.Info("msg", "key", v)` は slog と同じキーと値の形、printf は `log.Infof(...)`。混ぜない（`Info` に書式を渡すと整形されず `!BADKEY` になる）
- **wenteasy/log を import するのは `log/` の中だけ。** brender を使う人に見せるのは `slog.Level` と `*slog.Logger`（`log.SetLogger` / `log.Logger`）だけ
- **出口を組む（`log.Init` / `slog.SetDefault`）のは `_cmd/brender` と `_cmd/brender-tool` の main だけ。** `exec/`・`api/` などからは呼ばない。ログが書けなくてもアプリは止めない（`Init` は出せる出口で組み、理由を error で返す）
- ⚠️ `log/log.go` の `output` は公開関数から直接呼ぶ（間に関数を挟むと、記録される位置が全部 `log` パッケージになる）。歯止めは `log/log_test.go` の `TestCallerIsTheCaller`
- 出し先: デスクトップは `brender_<日付>.log`（`wails3 dev` は Info からでターミナルにも出す、配る exe は Notice から）、brender-tool は `brender-tool_<日付>.log`（ファイルだけ、`-v` で Debug）。dev かどうかは `-tags production` の有無（`_cmd/brender/devmode_*.go`）で見分ける。Wails 自身のログも `application.Options.Logger: log.Logger()` で同じ出口へ
- 設定画面のレベル変更は `log.SetLevel`（`Init` で組んだ出口にだけ効く。`SetLogger` で別の Logger を渡したときは効かない）。GORM のログは `log.NewDBLogger()` で `logger=db` の印付き

### 起動設定ファイル (`config/`, `~/.brender/brender.ini`)

DB（`Environment`）を読む**前**に確定したい設定の受け皿。`log.Init()` が `initDB()` より先に呼ばれるため、ログ出力先のような早期設定は DB に置けない。`config.Get()` がプロセス起動時に1回だけ `~/.brender/brender.ini` を読む（**変更は再起動で反映**）。デスクトップ・サーバ両モード共通。ファイルが無ければ各呼び出し側のデフォルトにフォールバックする。

形式は INI 風の最小仕様（フラットな `key = value`、`#`/`;` コメント、`[section]` 行は無視）:
```ini
log_dir = D:\brender\logs
db_path = D:\brender\brender.db
```

| キー | 反映先 | 未設定時のデフォルト |
|---|---|---|
| `log_dir` | `log.DefaultDir()`（`log.Init` に渡すログのフォルダ） | `{TempDir}/brender/logs` |
| `db_path` | `main.initDB()` の SQLite パス | `~/.brender/brender.db` |

新しいキーを足す場合: `config.Config` にフィールド追加 → `load()` の `switch` に case 追加 → 読みたい箇所で `config.Get().Xxx`。

### Temp ディレクトリ構成
```
{TempDir}/brender/
  logs/                  ← アプリログ（brender_YYYYMMDD.log / brender-tool_YYYYMMDD.log、日次・追記。2 日より古いものは .log.gz、100 日分を残す）。brender.ini の log_dir で変更可
  scripts/               ← Blender 用 Python 生成スクリプト
    tool_*.py            ← シーン/エンジン解析（getToolPythonFile でプロセス内1回キャッシュ）
    run_*.py             ← レンダリング実行（毎回生成）
    samples_*.py         ← サンプル比較（毎回生成）
```
スクリプトは生成のみで削除しない（クリーンアップ方針）。常駐するサーバモードでの無制限な蓄積を防ぐため、起動時に `api.ClearScripts()`（→ `exec.ClearScripts()`）が `scripts/` を一掃する。生成は `exec.createScript(tmplName, pattern, dto)` に集約。

### Scene / engine discovery
- `BlenderApi.getScenes({ installID, fileID })` — runs `exec.RunTool()` (Python `--tool` script) on the `.blend` file to extract scene names.
- `BlenderApi.getEngines({ installID })` — runs `blender -E help -b` and parses the engine list.
- Both fall back to `model.FirstBlender()` when `installID == 0`.
- `RunTool()` の解析結果は `(cmd, filePath)` キー + ファイル更新時刻でインメモリキャッシュされる（`exec/toolcache.go`、詳細は Skill `brender-render-pipeline`）。
