# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Brender** is a Blender rendering management system that supports both local and server-mode async rendering. It manages Blender projects, workspaces, and rendering jobs via a Go HTTP API and React frontend.

## Build & Run Commands

### Server (Go)
```bash
# Run the server (from project root)
go run ./server/_cmd/

# Build the server binary
go build -o brender-server ./server/_cmd/

# Build the CLI tool
go build -o brender-tool ./_cmd/brender-tool/
```

The server listens on `:8080`. On startup it clears all lock files from prior runs.

### Frontend (React)
```bash
cd frontend

# Development server with hot reload
npm start

# Production build (outputs to public/js/)
npm run build
```

### Tests
```bash
# Run all Go tests
go test ./...

# Run a single package's tests
go test ./server/model/...
```

## Architecture

The project has three layers intended to converge around a shared `core` module:

```
React frontend (frontend/)
    ↓ HTTP (axios)
Go HTTP server (server/)
    ↓ handler/api → exec → model
SQLite database (../test4.db via GORM)
    + Blender CLI subprocess
```

**Modules:**
- `core/` — Shared library being migrated toward. Contains `core/model/` and `core/exec/` which should eventually replace the server-specific duplicates.
- `server/` — Web server with its own `model/` and `exec/` packages (currently duplicating core). Entry point: `server/_cmd/main.go` → `server/brender.go:Listen()`.
- `client/` — Wails-based desktop client (work in progress).
- `frontend/` — React SPA using MUI components, webpack-bundled.
- `_cmd/brender-tool/` — Standalone CLI tool for rendering without the server.

**Ongoing refactoring:** `server/exec` and `server/model` are being moved into `core/`. The plan is for `handler/` to call a `core/api` interface which is proxied to either HTTP (server mode) or Wails bindings (client mode).

## Key Concepts

### Data model hierarchy
`Environment` (Blender path/version config) → `Project` (Blender file) → `Workspace` (render settings override) → `Job` (execution instance)

### Async rendering flow
`v1/workspace/render` spawns a Blender subprocess via `server/exec`, creates a `Job` record with the PID, writes a `.lock` file, then a goroutine waits for completion and runs thumbnail post-processing before marking the job done.

### File layout under `{BrenderRoot}/{ProjectID}/`
- `content/` — archived/uploaded Blender files (server mode)
- `thumbnail/` — `.jpg` thumbnails for project and workspaces
- `workspace/{workspaceId}/results/` — rendered frame PNGs
- `logs/` — `.log` and `.lock` files tracking active operations

### Lock files
`.lock` files in `logs/` indicate an in-progress render or thumbnail job. They are cleared on server startup (`exec.RemoveLockFiles()`). Do not delete them manually while jobs are running.

## Important Notes

- **Database path** is hardcoded to `../test4.db` (relative to `server/`) in `server/model/model.go`. This is a known issue.
- The `go.mod` at the project root (`github.com/ikascrew/brender`) is the authoritative module. The old `core/go.mod` (deleted per git status) has been removed.
- Frontend React components (`ProjectView.js`, `WorkspaceView.js`) are class components with local state; no Redux or global state management.
- API response envelope is always `{ Success bool, Messages []string, Result interface{} }`.
