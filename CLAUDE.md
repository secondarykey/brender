# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Brender** is a Blender rendering management system. It has two runtime modes that share a common library:

- **Desktop app** (`_cmd/brender/`) — Wails3 GUI application. Manages Blender installations, projects, workspaces, and rendering queues via a React (Vite) frontend calling Go service bindings.
- **CLI tool** (`_cmd/brender-tool/`) — Standalone command-line renderer. Accepts a `.blend` file and renders it with live progress display in the terminal.

Both modes share the root-module packages (`exec/`, `model/`, `api/`).

## Build & Run Commands

### Desktop app (Wails3)
```bash
cd _cmd/brender

# Development (hot reload)
wails3 dev

# Production build
wails3 build

# Regenerate Go<->JS bindings after adding/changing services
wails3 generate bindings
```

The DB is stored at `~/.brender/brender.db` (SQLite, created automatically on first run).

### CLI tool
```bash
# Build
go build -o brender-tool ./_cmd/brender-tool/

# Usage
brender-tool [-b <blender>] [-S <scene>] [-E <engine>] [-s <start>] [-e <end>] [-o <outdir>] [-v] [-a] <file.blend>

# Flags
#   -b   Blender executable path (default: $BRENDER_BLENDER, then "blender")
#   -S   Scene name
#   -E   Render engine (e.g. CYCLES, BLENDER_EEVEE)
#   -s/-e  Start/end frame (default: read from .blend via --tool)
#   -o   Output directory
#   -v   Verbose: pipe all Blender stdout directly to terminal
#   -a   Analysis mode: render a 3-frame sample to estimate time
#   --engines  List available render engines and exit
#   --scenes   List scenes in the .blend file and exit
```

### HTTP server (legacy / server mode)
```bash
# Run
go run ./server/_cmd/

# Build binary
go build -o brender-server ./server/_cmd/
```

The server listens on `:8080`. On startup it clears all lock files from prior runs.
The server's DB path is hardcoded to `../test4.db` (relative to `server/`) — known issue, not yet migrated.
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
  - `Status`: `completed` / `error` / `cancelled`
  - `DiskSize int64`: 完了時に出力ディレクトリの容量を保存
  - `DataStatus int`: `0`=none / `1`=none+locked / `2`=available / `3`=available+locked / `4`=deleted / `5`=deleted+locked
  - `OutputDir string`: 出力先ディレクトリパス
- `Queue`: ephemeral active-execution record. Deleted by `finishJob()` on completion/error/cancel.
  - `Status`: `waiting` / `running`

### UUID 発行ルール
| エンティティ | 関数 | バージョン |
|---|---|---|
| ProjectID | `uuid.NewRandom()` | v4 |
| ProjectFileID | `uuid.NewRandom()` | v4 |
| WorkspaceID | `uuid.NewRandom()` | v4 |
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

### Navigation hierarchy (frontend)
プロジェクト一覧 → プロジェクト詳細（ファイル一覧タブ） → ファイル詳細（ワークスペース左/履歴右の分割レイアウト・設定タブ） → ワークスペース設定（設定左/履歴右の分割レイアウト）

## Key Concepts

### サムネイル自動生成 (`api/thumbnail.go`)
ファイル登録時（`AddProjectFile`）に非同期で `CreateThumbnailWorkspace` を呼び出す。

**フロー**:
1. `IsSystem=true` のワークスペース「`ファイル名 Thumbnail`」を作成
2. Blender で `.blend` のデフォルトシーンを解析し、中間フレーム（`(start+end)/2`）を1枚レンダリング
3. 出力 PNG を `convertToJPEG` で 640×360 JPEG に変換して `thumbnail.jpg` として保存
4. エラーはログ出力のみ（ファイル登録をブロックしない）

**変換ロジック** (`convertToJPEG`):
- キャンバス 640×360（黒背景）
- 元画像をアスペクト比保持でキャンバスに収まる最大サイズに縮小（長辺基準 `min(W/srcW, H/srcH)`）
- 中央配置、JPEG quality 85

`GetFileThumbnail(projectID, fileID)` — `thumbnail.jpg` を base64 data URI で返す。存在しない場合は `IsSystem` ワークスペースの完了ジョブから画像を検索して変換・保存してから返す。

**IsSystem ワークスペース**: 現在はワークスペース一覧に表示したまま。将来 `ListWorkspacesByProject` の WHERE 句に `is_system = false` を追加して除外する予定。

### Async rendering flow (`api/queue.go`)
`Enqueue()` → `PreviewRender()` でパラメータ解決 → `EnqueueWithPreview()` でジョブ作成・キュー投入。

**同時実行制御**:
- `getMaxConcurrentJobs()` が `model.GetEnv().MaxConcurrentJobs` を読む（デフォルト 1、0 以下も 1 扱い）。設定画面の Blender タブで変更可能。
- `scheduleMu sync.Mutex` でスケジューラのレース防止
- 投入時: 実行中キュー数が上限未満なら `MarkQueueStarting()`（DB で status を running に変更）してから `go executeQueue()` を起動。上限以上なら `waiting` のまま保留。
- 完了・キャンセル時: `startNextWaiting()` を呼び出し、最古の `waiting` ジョブを昇格して起動。
- 同一ワークスペースの重複投入禁止: `ExistsQueueByWorkspace` で事前チェック。

**`executeQueue` の流れ**:
1. `ProcessingWriter` 作成、`exec.RegisterProgress` 登録
2. `render.log` を出力ディレクトリに作成（stdout/stderr を MultiWriter で書き込む）
3. `b.RunWithPID()` で Blender 起動
4. `model.UpdateQueueRunning(id, pid)` で PID・開始時刻を記録
5. `errCh` から完了を待ち、`finishJob()` を呼ぶ

`finishJob()` は完了時に `calcDirSize()` で出力ディレクトリ容量を計算して `Job.DiskSize` に保存、Queue レコードを削除後 `startNextWaiting()` → `notifyQueueChanged()` を呼ぶ。

### Queue changed hook (`api/queue.go`)
```go
var QueueChangedHook func(count int64)
```
キューの件数が変化したとき（Enqueue・finishJob・CancelQueue 後）に呼ばれる。`main.go` で Wails イベント送信にセットしている：
```go
api.QueueChangedHook = func(count int64) {
    application.Get().Event.Emit("queue:changed", count)
}
```
将来のサーバモードでは SSE ブロードキャストに差し替えるだけで `api/queue.go` 本体は変更不要。

### Job deletion (`api/queue.go`)
`DeleteJob(id)` — ジョブの `OutputDir` を `os.RemoveAll` で削除してから DB レコードを削除する（ディレクトリが存在する場合のみ）。

### ProcessingWriter (`exec/writer.go`)
Parses Blender's stdout/stderr in real time. Thread-safe — `Result()` returns a `ProcessingResult` snapshot.

**Blender output format compatibility:**
- Blender 4.x (`formatLegacy`): `Fra:N Mem:... | Time:... | ...`
- Blender 5.x (`formatStructured`): `HH:MM.SS  category  | Fra: N | Mem: ... | detail`

**Engine-specific frame detection:**
- **Cycles / EEVEE**: `Fra: N` segment → `parseLog()` → resets sub-frame state, sets `everSawFra=true`
- **Workbench**: `Rendering frame N` segment → `parseWorkbenchFrame()` (no `Fra:` lines at all)
- **EEVEE**: outputs BOTH `Rendering frame N` (frame transition) AND `Fra: N | Rendering M/K samples`

**Sub-frame progress tracking (`NowTile`, `TotalTiles`, `NowSample`, `TotalSamples`):**
- Cycles (tiles): `Rendered N/M Tiles, Sample P/Q` — completed tiles + sample within current tile
- Cycles (no tiles): `Sample N/M`
- EEVEE: `Rendering N / M samples`
- Workbench: no sub-frame data

**`frameActive` / `everSawFra` flags:**
- `everSawFra`: sticky flag, set `true` on first `Fra:` line, never reset. Distinguishes Workbench (never set) from Cycles/EEVEE (set during frame 1 sync).
- `frameActive`: `false` during Cycles init/sync phase (before first sample), `true` once sub-frame data arrives. For Workbench, set `true` immediately in `parseWorkbenchFrame`. On EEVEE/Cycles frame transitions (`Rendering frame N` with `everSawFra=true`): resets samples but keeps `frameActive` as-is (no "準備中..." flicker between frames).
- Frontend uses `q.frame_active` to show "準備中..." vs frame number.

**ETA calculation:**
- Frame-complete ETA: `updateAverageTime()` — averages per-frame `Time:` values, scales by remaining frames.
- Sub-frame ETA: `updateExpectedFromSubFrame()` — called on each sample update; uses `elapsed / overallPct` where `overallPct = (framesDone + subPct) / totalFrames`. Provides ETA during long single-frame Cycles renders.

### Progress tracking (`exec/progress.go`)
`RegisterProgress(id, pw)` / `GetProgress(id)` / `UnregisterProgress(id)` — in-memory map keyed by Queue ID. `ListQueueItems()` in `api/queue.go` attaches live progress fields (`NowFrame`, `NowTile`, `TotalTiles`, `NowSample`, `TotalSamples`, `FrameActive`, `AverageSec`, `ExpectedAt`, `Log1`, `Log2`) to `QueueItem` for the frontend.

### Frontend progress bar (`QueuePage.jsx`)
```js
// Sub-frame progress 0.0–1.0
function subFramePct(q) {
  if (q.total_tiles > 0 && q.total_samples > 0)
    return (q.now_tile * q.total_samples + q.now_sample) / (q.total_tiles * q.total_samples)
  if (q.total_samples > 0)
    return q.now_sample / q.total_samples
  return 0
}
// Overall % (capped at 99.99 while running)
pct = ((framesDone + subFramePct(q)) / totalFrames) * 100
```
Progress displays with 2 decimal places. Log text (`q.log2`) is shown as-is from Blender output.

### Environment setup guard
On startup, `App.jsx` calls `EnvironmentApi.get()`. If `ProjectRoot` is not set, it automatically navigates to the settings page. `ProjectListPage` also shows a warning banner and disables project creation until a root directory is configured.

`EnvironmentApi.getWorkDir()` returns `os.Getwd()` for use as the default directory in the folder picker dialog.

### Scene / engine discovery
- `BlenderApi.getScenes({ installID, fileID })` — runs `exec.RunTool()` (Python `--tool` script) on the `.blend` file to extract scene names.
- `BlenderApi.getEngines({ installID })` — runs `blender -E help -b` and parses the engine list.
- Both fall back to `model.FirstBlender()` when `installID == 0`.

### CLI terminal display (`_cmd/brender-tool/main.go`)
`runTerminalDisplay` polls `pw.Result()` every 200ms and calls `printTerminal` to render a fixed-height status block using ANSI cursor-up escape sequences. `exec.Terminal` handles line width and refresh. No JSON is output — the terminal display IS the output.

## Frontend Page Structure

```
App.jsx
  MainLayout (sidebar nav + queue badge)
    ProjectListPage        (/projects)
      プロジェクト新規作成: 「New Project」デフォルト値・フォーカス・全選択状態
    ProjectDetailPage      (/project/:id)
      tabs: ファイル一覧 / 設定
    FileDetailPage         (/file)
      tab: ワークスペース → 左右分割
        左: ワークスペース一覧（各行に「▶ 実行」・名称・›）
             新規作成: 「New Workspace」デフォルト値・全選択状態
        右: 実行履歴（HistoryTab）
      tab: 設定 → 左右分割
        左: ファイル設定フォーム
        右: ThumbnailPanel（thumbnail.jpg 表示）
    WorkspaceDetailPage    (/workspace)
      左右分割（左: 設定フォーム, 右: 実行履歴）
      ※ props に fileID/fileName がない場合、detail.project_files から補完してパンクズに表示
    QueuePage              (/queue)
      tabs: キュー（waiting/running 一覧、登録順昇順） / 実行履歴
    SettingsPage           (/settings)
      tabs: 環境 / Blender
```

Breadcrumb: プロジェクト › プロジェクト名 › ファイル名 › ワークスペース名

After `Enqueue()` succeeds, the app navigates to the queue page (`navigate('queue')`).

### ファイル一覧タイル表示 (`WorkspaceTab.jsx`)
- デフォルト表示: カード（タイル）表示
- 表示切り替えボタン: 左寄せ
- 「+ .blend ファイルを追加」ボタン: `.list-fab`（`position: sticky; bottom: 16px`）で画面下部に常時表示
- 「ディレクトリからファイルを追加」機能: プロジェクト設定タブ（SettingsTab）の作業ディレクトリセクション下に配置
- タイルサイズ: 幅 320px、縦レイアウト（サムネイル上 180px + 名称のみ下）
- サムネイル: `ProjectApi.getFileThumbnail({ projectID, fileID })` で base64 data URI を取得して表示

### サイドバー
- アイコンのみ表示（ラベルなし）、`title` 属性でツールチップ
- アイコンサイズ 32px、ナビアイテム 48×48px
- キューアイコン右上に実行中件数バッジ（オレンジ丸）を表示
  - 初期値は `QueueApi.list()` で取得、以後 `queue:changed` イベントで更新

### ページネーション (`src/components/Pagination.jsx`)
- `page`, `totalPages`, `onChange` に加えて `pageSize`, `onPageSizeChange`, `total` を受け付ける
- `pageSize` / `onPageSizeChange` が渡された場合、左端に表示件数セレクタ（5/10/20/100）と全件数を表示
- `totalPages` が 1 でもページ情報行は常に表示

## Internationalization (`src/languages.jsx`, `src/locale/`)

フロントエンドは `react-i18next` で国際化されている。

### 対応言語
| コード | 表示名 | 言語ファイル |
|---|---|---|
| `ja` | 日本語 | `src/locale/languages/ja.json` |
| `en` | English | `src/locale/languages/en.json` |

### 言語の切り替えと永続化
- 設定画面の「環境」タブにセレクタを表示
- `i18n.changeLanguage(code)` を呼ぶと即座に全UIが切り替わる
- 選択言語は `localStorage`（キー: `brender-language`）に自動保存
- 起動時は localStorage の値を読み込む。未設定の場合デフォルトは `ja`

### 使い方（コンポーネント内）
```js
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t, i18n } = useTranslation()
  // t('common.save') → "保存" / "Save"
  // i18n.language     → "ja" / "en"
}
```

### 翻訳キー構造 (`src/locale/languages/*.json`)
| セクション | 用途 |
|---|---|
| `common` | 汎用ラベル（保存・削除・キャンセルなど） |
| `menu` | サイドバーナビゲーション |
| `title` | タイトルバーボタン（最小化・最大化・閉じる） |
| `status` | ジョブ実行ステータス（waiting/running/completed/error/cancelled） |
| `dataStatus` | データ状態バッジ（none/locked/available/deleted） |
| `tabs` | タブラベル（ファイル一覧・設定・キュー・履歴・環境・Blender） |
| `breadcrumb` | パンくずリスト |
| `project` | プロジェクト操作 |
| `file` | ファイル（.blend）設定 |
| `workspace` | ワークスペース設定（フレーム・スレッド・サンプル数など） |
| `queue` | キュー画面 |
| `job` | ジョブ詳細・削除操作 |
| `dialog` | ダイアログ内ラベル（ステータス・フレーム・Blenderパスなど） |
| `settings` | 設定画面（言語・作業ディレクトリ・Blender登録など） |
| `table` | テーブルヘッダ |
| `time` | 時間単位（秒・分・時間） |
| `pagination` | ページネーション |
| `viewer` | 画像ビューア（再生・停止） |
| `render` | レンダリング確認ダイアログ |

### 新しいキーを追加するとき
1. `en.json` と `ja.json` の両方に同じキーを追加する
2. コンポーネントで `t('section.key')` を使う
3. 言語ファイルは Vite の動的 `import()` で読み込まれる（ビルド時にバンドル済み）

### `LANGUAGES` 定数
`src/languages.jsx` からエクスポートされる配列。設定画面のセレクタで使用。
```js
export const LANGUAGES = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
]
```
新しい言語を追加する場合はここに追記し、対応する JSON ファイルを `src/locale/languages/` に置く。

## Frontend API Layer (`src/lib/api/`)

**重要**: フロントエンドから Wails Service を直接呼ばないこと。必ずこのラッパー経由で呼ぶ。

```
src/lib/api/
  _client.js      isWails() 判定 + serverCall() fetch ヘルパー
  blender.js      BlenderApi
  environment.js  EnvironmentApi
  project.js      ProjectApi  ← getFileThumbnail({ projectID, fileID }) を含む
  workspace.js    WorkspaceApi
  queue.js        QueueApi
  work_dir.js     WorkDirApi
  index.js        re-export
```

- **Wailsモード** (`window._wails` が存在): `@wailsio/runtime` を動的インポートして既存 Service を呼ぶ
- **サーバモード**: `POST /api/{service}/{method}` + JSON ボディ、レスポンス `{ data } | { error }` 形式
- 引数は常にオブジェクト形式: `ProjectApi.get({ id })`, `QueueApi.cancel({ id })` など
- サーバモードの REST エンドポイントは snake_case: `list_by_project`, `get_engines` など

## Event Bus (`src/lib/appEvents.js`)

```js
import { onAppEvent } from '../lib/appEvents'
const off = onAppEvent('queue:changed', data => { ... })
return off  // useEffect cleanup
```

- **Wailsモード**: `@wailsio/runtime` の `Events.On` を動的インポートして使用
- **サーバモード**: `EventSource('/events')` のシングルトンを維持し SSE で受信
  - 複数コンポーネントが `onAppEvent` を呼んでも接続は 1 本のみ
- 現在使用しているイベント名:
  - `queue:changed` (data: number — アクティブキュー件数)
  - `workdir:migrate` (data: `{ project_id, status, pct }` — 移行進捗。status: `running`/`done`/`error`)

## CSS Conventions (`frontend/public/style.css`)

### カラーパレット（黒系）
- 本体背景: `#1a1a1a`
- サイドバー/タイトルバー: `#111111`
- 入力・セレクト背景: `#1e1e1e`
- アクセント（青）: `#4a7cdc`
- 実行ボタン（オレンジ）: `#d15904` / hover `#e86a10`
- エラー赤: `#c0392b`

### レイアウトルール
- `.page:has(.tab-nav)` → flex column, overflow hidden; `.tab-content` → flex:1, min-height:0, overflow-y:auto (タブコンテンツのみスクロール、ヘッダ固定)
- `.page` without tabs → overflow-y:auto (ページ全体スクロール)
- `.form-actions` → `justify-content: space-between` (削除ボタン左・保存ボタン右)
- `#app, #root` must both have `width/height: 100%` for the height chain to work

### 左右分割レイアウト (`.ws-detail-split`)
ファイル詳細・ワークスペース詳細で使用：
```css
.ws-detail-split  { display: flex; gap: 32px; flex: 1; min-height: 0; overflow: hidden; }
.ws-detail-left   { flex: 3; min-width: 0; overflow-y: auto; }   /* 約60% */
.ws-detail-right  { flex: 2; min-width: 0; overflow-y: auto; }   /* 約40% */
```
- `.page:has(.ws-detail-split)` → `display: flex; flex-direction: column; overflow: hidden`
- `.tab-content:has(.ws-detail-split)` → `overflow: hidden; display: flex`

### ボタンスタイル
- `.btn-run` — オレンジ (`#d15904`)、実行・開くボタン共用
- `.btn-sm` — 高さ 28px、小型ボタン
- `.btn-ghost` — 透明背景、キャンセル等
- `.btn-danger` — 赤、削除操作
