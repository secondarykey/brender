# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ドキュメント分割

このファイルには常時必要な情報のみを置く。詳細は以下に分割されている:

| 内容 | 場所 | ロードのされ方 |
|---|---|---|
| フロントエンド規約（ページ構成・API ラッパー層・イベントバス・ダイアログ・トースト・i18n・テーマ・CSS） | `_cmd/brender/frontend/CLAUDE.md` | frontend 配下のファイルを扱うと自動ロード |
| レンダリングパイプライン詳細（キュー実行・リカバリ・ProcessingWriter・進捗・ETA・サムネイル生成・CLI 表示） | Skill `brender-render-pipeline` | 該当作業時に Skill を参照 |
| コード管理 `code/`（フォーマット・解像度プリセット、新カテゴリ追加手順） | Skill `brender-codes` | 該当作業時に Skill を参照 |

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

The DB is stored at `~/.brender/brender.db` (SQLite, created automatically on first run).

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

### HTTP server (legacy / server mode)
```bash
go run ./server/_cmd/                          # Run (listens on :8080)
go build -o brender-server ./server/_cmd/      # Build binary
```

The server's DB path is hardcoded to `../test4.db` (relative to `server/`) — known issue, not yet migrated. On startup it clears all lock files from prior runs.
**Note:** `server/handler/api/` references removed model fields and does not build with `./...`. Build with `go build ./exec/... ./api/... ./model/...` to avoid server errors.

### Tests
```bash
go test ./...
go test ./exec/...
```

## Architecture

```
_cmd/brender/  (Wails3 desktop app)
    frontend/  (React + Vite)
        src/lib/api/       ← API ラッパー層（Wails/HTTP 切り替え）
        src/lib/appEvents.js ← イベントバス（Wails Events/SSE 切り替え）
        ↕ Wails3 JS bindings (frontend/bindings/)
    main.go
        ↓
api/wails/     (Wails サービス層 — thin wrappers registered in main.go)
api/rest/      (REST サービス層 — サーバモード用、未実装)
        ↓
api/           (business logic, framework-agnostic)
        ↓
model/         (GORM models + CRUD, SQLite via glebarez/sqlite)
exec/          (Blender subprocess management + output parsing)

_cmd/brender-tool/  (CLI, uses exec/ + api/ directly)

server/        (legacy HTTP server, still functional but handler/api/ is stale)
```

### Module layout
- Root module `github.com/ikascrew/brender` (`go.mod` at project root) is authoritative.
- `_cmd/brender/` has its own `go.mod` (`github.com/ikascrew/brender/cmd/brender`) with a `replace` directive pointing to the root module.
- `server/` has its own `go.mod` and `replace` directive pointing to the root module.
- `_cmd/old/` — archived previous server implementation, not built.

### Wails3 services (`api/wails/`)
| File | Type | Wraps |
|---|---|---|
| `api/wails/blender.go` | `Blender` | `api/blender.go` |
| `api/wails/environment.go` | `Environment` | `api/environment.go` |
| `api/wails/project.go` | `Project` | `api/project.go` + `api/thumbnail.go` |
| `api/wails/workspace.go` | `Workspace` | `api/workspace.go` |
| `api/wails/queue.go` | `Queue` | `api/queue.go` |
| `api/wails/work_dir.go` | `WorkDir` | `api/work_dir.go` |
| `api/wails/codes.go` | `Codes` | `code/`（Skill `brender-codes` 参照） |

Services are registered in `_cmd/brender/main.go`. After adding or changing a service, run `wails3 generate bindings` to update the frontend JS bindings.

`wails.Blender.OpenFile(installID, filePath)` — Blender を GUI モードで起動（`-b` なし、`cmd.Start()` で非同期）。

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

- **非同期レンダリング** (`api/queue.go`): `Enqueue()` → `PreviewRender()` → `EnqueueWithPreview()`。`MaxConcurrentJobs`（デフォルト 1）で同時実行制御、`scheduleMu` でレース防止、同一ワークスペースの重複投入は禁止。
- **起動時キューリカバリ**: クラッシュ後に残った `running` Queue を `RecoverStaleQueues()` が検出。旧 Job を `interrupted` で閉じ、新 Job+Queue（`recovering`）を作成して `StartRecoveredQueues()` で再実行する。
- **Queue changed hook**: `api.QueueChangedHook func(count int64)` — キュー件数変化時に呼ばれる。`main.go` で Wails イベント `queue:changed` の Emit にセット。サーバモードでは SSE に差し替え予定。
- **Job deletion**: `DeleteJob(id)` は `OutputDir` を `os.RemoveAll` してから DB レコードを削除する。
- **ProcessingWriter** (`exec/writer.go`): Blender stdout/stderr をリアルタイムパース。Blender 4.x/5.x 両対応、Cycles/EEVEE/Workbench のエンジン別検出、スレッドセーフ（`Result()` でスナップショット取得）。
- **進捗トラッキング** (`exec/progress.go`): Queue ID キーの in-memory map。`ListQueueItems()` が進捗フィールドを `QueueItem` に付与してフロントエンドへ渡す。
- **サムネイル自動生成** (`api/thumbnail.go`): `AddProjectFile` 時に非同期で `IsSystem=true` ワークスペースを作成し、中間フレームを 1 枚レンダリング → 640×360 JPEG で `thumbnail.jpg` に保存。

### Scene / engine discovery
- `BlenderApi.getScenes({ installID, fileID })` — runs `exec.RunTool()` (Python `--tool` script) on the `.blend` file to extract scene names.
- `BlenderApi.getEngines({ installID })` — runs `blender -E help -b` and parses the engine list.
- Both fall back to `model.FirstBlender()` when `installID == 0`.
