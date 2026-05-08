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
        ↕ Wails3 JS bindings (frontend/bindings/)
    *service.go  (thin Wails service wrappers)
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

### Wails3 services (`_cmd/brender/`)
| File | Service | Wraps |
|---|---|---|
| `blenderservice.go` | `BlenderService` | `api/blender.go` |
| `environmentservice.go` | `EnvironmentService` | `api/environment.go` |
| `projectservice.go` | `ProjectService` | `api/project.go` |
| `workspaceservice.go` | `WorkspaceService` | `api/workspace.go` |
| `queueservice.go` | `QueueService` | `api/queue.go` |

Services are registered in `main.go`. After adding or changing a service, run `wails3 generate bindings` to update the frontend JS bindings.

## Data Model

### Hierarchy
`BlenderInstall` → `Environment` (project root dir) → `Project` + `ProjectFile` (`.blend` files) → `Workspace` (render settings) → `Job` (history) / `Queue` (active execution)

### Key model notes
- `Environment`: `ProjectRoot string`, `Server bool`. No `BlenderCmd`/`BlenderVersion`/`Hash` fields (removed).
- `Project`: `ID string` (UUID), `Name`, `BlenderInstallID uint`, `Scene string`. No `Archive` or `ThumbnailFrame` fields (removed).
- `ProjectFile`: `ID uint`, `ProjectID`, `Path`, `Name`, `FileModifiedAt *time.Time`. `FileModifiedAt` is set from `os.Stat().ModTime()` on add; intended for future "file changed?" detection.
- `Workspace`: `ProjectFileID uint` is set at creation and never changed by Update (file association is fixed). `BlenderInstallID=0` means use project default.
- `Job`: permanent history record. Shares UUID v7 with its `Queue` record. Has `ProjectFileID uint` for direct file-based query. Status: `completed` / `error` / `cancelled`.
- `Queue`: ephemeral active-execution record. Deleted by `finishJob()` on completion/error/cancel.

### Navigation hierarchy (frontend)
プロジェクト一覧 → プロジェクト詳細（ファイル一覧タブ） → ファイル詳細（ワークスペース/履歴/設定タブ） → ワークスペース設定

## Key Concepts

### Async rendering flow (`api/queue.go`)
`Enqueue()` resolves the Blender executable (workspace → project → FirstBlender fallback), resolves the `.blend` file (workspace's `ProjectFileID` → project's first file), creates a `Job` + `Queue` sharing the same UUID v7, then spawns `executeQueue()` as a goroutine. The goroutine creates a `ProcessingWriter`, writes `render.log` to the output dir, calls `b.RunWithPID()`, and on completion calls `finishJob()` which updates Job status and deletes the Queue record.

Output directory: `{env.ProjectRoot}/{projectID}/{workspaceID}/{queueID}/`
- `frame_####.png` — rendered frames
- `render.log` — full Blender output

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
On startup, `App.jsx` calls `EnvironmentService.Get()`. If `ProjectRoot` is not set, it automatically navigates to the settings page. `ProjectListPage` also shows a warning banner and disables project creation until a root directory is configured.

`EnvironmentService.GetWorkDir()` returns `os.Getwd()` for use as the default directory in the folder picker dialog.

### Scene / engine discovery
- `BlenderService.GetScenes(installID, fileID)` — runs `exec.RunTool()` (Python `--tool` script) on the `.blend` file to extract scene names.
- `BlenderService.GetEngines(installID)` — runs `blender -E help -b` and parses the engine list.
- Both fall back to `model.FirstBlender()` when `installID == 0`.

### CLI terminal display (`_cmd/brender-tool/main.go`)
`runTerminalDisplay` polls `pw.Result()` every 200ms and calls `printTerminal` to render a fixed-height status block using ANSI cursor-up escape sequences. `exec.Terminal` handles line width and refresh. No JSON is output — the terminal display IS the output.

## Frontend Page Structure

```
App.jsx
  MainLayout (sidebar nav)
    ProjectListPage        (/projects)
    ProjectDetailPage      (/project/:id)
      tabs: ファイル一覧 / 設定
    FileDetailPage         (/file)
      tabs: ワークスペース / 履歴 / 設定
    WorkspaceDetailPage    (/workspace)
      tab: 設定（削除左・保存右）
    QueuePage              (/queue)
      tabs: 実行中 / 実行履歴
    SettingsPage           (/settings)
      tabs: 環境 / Blender
```

Breadcrumb: プロジェクト › プロジェクト名 › ファイル名 › ワークスペース名

After `Enqueue()` succeeds, the app navigates to the queue page (`navigate('queue')`).

## CSS Conventions (`frontend/public/style.css`)
- `.page:has(.tab-nav)` → flex column, overflow hidden; `.tab-content` → flex:1, min-height:0, overflow-y:auto (tab content scrolls, header fixed)
- `.page` without tabs → overflow-y:auto (whole page scrolls)
- `.form-actions` → `justify-content: space-between` (delete left, save right)
- `#app, #root` must both have `width/height: 100%` for the height chain to work
