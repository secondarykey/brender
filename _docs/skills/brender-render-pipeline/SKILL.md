---
name: brender-render-pipeline
description: >
  Brender のレンダリングパイプラインの詳細仕様。非同期レンダリング実行（Enqueue・同時実行制御・
  MaxConcurrentJobs）、起動時キューリカバリ（RecoverStaleQueues・interrupted/recovering ステータス）、
  ProcessingWriter による Blender 標準出力のリアルタイムパース（Blender 4.x/5.x、Cycles/EEVEE/Workbench
  のエンジン別フレーム検出・タイル/サンプル進捗・ETA 計算）、進捗トラッキング（exec/progress.go）、
  QueuePage の進捗バー計算式、サムネイル自動生成（api/thumbnail.go）、CLI ターミナル表示を扱う。
  api/queue.go・api/thumbnail.go・exec/writer.go・exec/progress.go・_cmd/brender-tool/・
  QueuePage.jsx を変更するとき、またはキュー・レンダリング進捗・ジョブステータス・リカバリ・
  サムネイルに関する作業のときは必ずこのSkillを参照すること。
---

# Brender レンダリングパイプライン詳細

Queue/Job のステータス一覧・データモデルはルートの `AGENTS.md` を参照。このSkillは実装の詳細仕様を扱う。

## サムネイル自動生成 (`api/thumbnail.go`)

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

**パス解決** (`thumbnailPath`): サムネイル種別（プロジェクト/ファイル/ワークスペース）ごとの `thumbnail.jpg` のパスを返す共通ヘルパー。無ければ完了ジョブ出力から生成する。base64 版・URL 版・HTTP 配信で共用する。

**取得の2形態**:
- **base64**（Wails デスクトップ）: `GetFileThumbnail` / `GetProjectThumbnail` / `GetWorkspaceThumbnail` が `thumbnailPath` + `imageToBase64` でデータURIを返す。
- **URL 配信**（サーバモード）: `GetFileThumbnailURL` 等が `/thumbnail?project_id=...&file_id=...&v={mtime}` を返し、実体は REST の `GET /thumbnail`（`api.ServeThumbnailPath`、認証+アクセス権限チェック+`Last-Modified` による 304）が配信する。base64 の 33% 肥大を避け、ブラウザキャッシュを効かせる。`v={mtime}` で再生成時にキャッシュを更新。存在しなければ空文字（フロントはプレースホルダ表示のまま `queue:changed` で再取得）。
- フロントの `ProjectApi.getFileThumbnail` はどちらのモードでも文字列（データURI or URL）を返すため、`<img src>` にそのまま渡せる（消費側コードはモード非依存）。

**IsSystem ワークスペース**: 現在はワークスペース一覧に表示したまま。将来 `ListWorkspacesByProject` の WHERE 句に `is_system = false` を追加して除外する予定。

## Async rendering flow (`api/queue.go`)

`Enqueue()` → `PreviewRender()` でパラメータ解決 → `EnqueueWithPreview()` でジョブ作成・キュー投入。

**パラメータ解決** (`resolveRenderBase` / `fileOverrides`):
- Blender/シーン/エンジン/カメラの解決は「固定フラグ付きファイル指定 → 呼び出し側の指定（ワークスペース or テスト params）→ ファイル指定 → シーンのデフォルト」の優先順位。
- このフォールバックは `resolveRenderBase()` に集約されており、`PreviewRender()` と `TestEnqueue()` が共用する（`fileOverrides` がファイルの固定フラグ+値を保持し、`resolveScene/Engine/Camera/BlenderID` メソッドで各項目を解決）。優先順位を変える場合はここ一箇所を直す。

**同時実行制御**:
- `getMaxConcurrentJobs()` が `model.GetEnv().MaxConcurrentJobs` を読む（デフォルト 1、0 以下も 1 扱い）。設定画面の Blender タブで変更可能。
- `scheduleMu sync.Mutex` でスケジューラのレース防止
- 投入時: 実行中キュー数が上限未満なら `MarkQueueStarting()`（DB で status を running に変更）してから `go executeQueue()` を起動。上限以上なら `waiting` のまま保留。
- 完了・キャンセル時: `startNextWaiting()` を呼び出し、最古の `waiting` ジョブを昇格して起動。
- 同一ワークスペースの重複投入禁止: `ExistsQueueByWorkspace` で事前チェック。ダブルクリック等の競合を防ぐため、この重複チェックから `CreateQueue` までを `enqueueMu sync.Mutex` で直列化する（`scheduleMu` とは別ロック、順序が交差しないためデッドロックしない）。

**`executeQueue` の流れ**:
1. `ProcessingWriter` 作成、`exec.RegisterProgress` 登録
2. `render.log` を出力ディレクトリに作成（stdout/stderr を MultiWriter で書き込む）
3. `b.RunWithPID()` で Blender 起動
4. `model.UpdateQueueRunning(id, pid)` で PID・開始時刻を記録
5. `errCh` から完了を待ち、`finishJob()` を呼ぶ

`finishJob()` は完了時に `calcDirSize()` で出力ディレクトリ容量を計算して `Job.DiskSize` に保存、Queue レコードを削除後 `startNextWaiting()` → `notifyQueueChanged()` を呼ぶ。`shuttingDown` が立っているときは何もせずに戻る（Queue を `running` のまま残し、次回起動時のリカバリに任せる）。

**実行中キューの強制終了は2種類あり、`shuttingDown` を立てるのは終了時だけ**:
| 関数 | 呼び出し元 | `shuttingDown` | kill されたジョブの後始末 |
|---|---|---|---|
| `KillRunningQueues()` | アプリ終了時（`main.go` の `WindowClosing` フック） | 立てる | `finishJob` がスキップ → Queue が残り、次回起動時に `interrupted` + 再実行 |
| `KillRunningQueuesByUser(ctx)` | 利用者の操作（サービス `Queue.KillRunning` / REST `queue.kill_running`、admin 限定） | 立てない | 実行 goroutine の `finishJob` が `cancelled`（`JobDataCorrupted`、エラー文なし。`CancelQueue` と同じ扱い）で閉じ、Queue 削除・次の待機キュー起動まで通常どおり |

kill 部分は内部関数 `killRunningQueues()` に共通化している。利用者の強制終了では kill したキュー ID を `userKilledQueues`（`sync.Map`）に kill より先に記録し、`finishJob` がそれを見て `error` ではなく `cancelled` にする（kill できなかったキューは記録を外し、ジョブはそのまま走り続ける）。利用者の操作から `KillRunningQueues()` を呼ぶと `shuttingDown` が立ったままになり、再起動まで全ジョブの完了記録と次キューの起動が止まるので呼ばないこと。

## 起動時キューリカバリ (`api/queue.go`)

アプリがクラッシュや強制終了した場合、Queue テーブルに `running` 状態のレコードが残る。次回起動時に `RecoverStaleQueues()` がこれを検出してリカバリする。

**フロー**（`main.go` の `initDB()` 直後に呼ばれる）:
1. `running` 状態の Queue を全件取得
2. 孤立プロセスが生きていれば `killQueueProcess()` で `Kill()` する（Mac では生存する場合がある）
3. 旧ジョブを `interrupted`（中断）ステータスで閉じる — 途中の render.log やフレーム出力が履歴として残る
4. 同じパラメータで新しい Job + Queue を `recovering` ステータスで作成（出力ディレクトリは新規）
5. `QueueChangedHook` 設定後に `StartRecoveredQueues()` でスケジューラを起動し、再実行を開始

**フロントエンドのバッジ表示**: `recovering` は「再実行待ち」（オレンジ）、`interrupted` は「中断」（紫）。

**プロセス生存の OS 差異**:
- Windows: 親プロセス終了時に子プロセス（Blender）も終了する
- Mac/Linux: 子プロセスは orphan として生存する（init に引き取られる）
- いずれの場合も stdout パイプは切断され再接続不可のため、新ジョブで再実行する

**PID 誤殺の防止** (`killQueueProcess` / `isBlenderProcess`):
保存済み PID は OS に再利用され別プロセスへ割り当てられている可能性がある。`Kill()` する前に gopsutil（`process.NewProcess`）で実行ファイルを検証し、記録された Blender パスと一致するか実行ファイル名に "blender" を含む場合のみ kill する。検証できない場合は kill をスキップ（無関係なプロセスの誤殺より orphan 残存を許容）。`RecoverStaleQueues` / `CancelQueue` / `killRunningQueues`（`KillRunningQueues` / `KillRunningQueuesByUser`）の3箇所で共通利用する。kill を実行できたかを `bool` で返す。

## イベント配信フック (`api/*.go` の `XxxHook` + `main.go` の `emit`)

`api` 層は各種イベントを `var XxxHook func(...)` の関数変数で公開する（`QueueChangedHook` / `BlenderWarningHook` / `MigrationHook` / `MovieCreatedHook` / `WorkDirChangeDirHook` / `SystemStatsHook`）。キューの件数が変化したとき（Enqueue・finishJob・CancelQueue 後）に `QueueChangedHook` が呼ばれる、といった具合。

`main.go` はこれらのフックを**単一の `emit(name, data)` クロージャ**にまとめて設定する。`emit` は Wails Event へ送り、サーバモードなら SSE broker（`rest.SSEBroker.Emit`）へも配る：
```go
emit := func(name string, data any) {
    application.Get().Event.Emit(name, data)
    if broker != nil { broker.Emit(name, data) }
}
api.QueueChangedHook = func(count int64) { emit("queue:changed", count) }
// ...他のフックも同様に emit を通す
```
新しいイベントを足すときも `emit` を経由すれば、Wails と SSE の両トランスポートへ確実に届く（フックごとに SSE ラップを書くと漏れる）。`broker` はフック設定より前に生成しておく。

## Job deletion (`api/queue.go`)

`DeleteJob(id)` — ジョブの `OutputDir` を `os.RemoveAll` で削除してから DB レコードを削除する（ディレクトリが存在する場合のみ）。

## ProcessingWriter (`exec/writer.go`)

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

## Progress tracking (`exec/progress.go`)

`RegisterProgress(id, pw)` / `GetProgress(id)` / `UnregisterProgress(id)` — in-memory map keyed by Queue ID. `ListQueueItems()` in `api/queue.go` attaches live progress fields (`NowFrame`, `NowTile`, `TotalTiles`, `NowSample`, `TotalSamples`, `FrameActive`, `AverageSec`, `ExpectedAt`, `Log1`, `Log2`) to `QueueItem` for the frontend.

## Frontend progress bar (`QueuePage.jsx`)

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

## RunTool 結果キャッシュ (`exec/toolcache.go`)

`RunTool()` の解析結果 `Tool` を `(cmd, filePath)` キー + ファイル更新時刻でインメモリキャッシュする。Blender 起動は数秒かかるため、同一 `.blend` への `ResolveScene` / `GetToolData` / `getScenes` 等の重複起動を排除する。特にファイル登録時のサムネイル生成（`GetToolData`（Packチェック）→ `CreateThumbnailWorkspace` の `ResolveScene` → `TestEnqueue` 内の `ResolveScene`）が1回の Blender 起動で済む。ファイルが編集されると mtime が変わり自動的にキャッシュミスになる。明示的な破棄は `exec.InvalidateToolCache(cmd, filePath)`。

## CLI terminal display (`_cmd/brender-tool/main.go`)

`runTerminalDisplay` polls `pw.Result()` every 200ms and calls `printTerminal` to render a fixed-height status block using ANSI cursor-up escape sequences. `exec.Terminal` handles line width and refresh. No JSON is output — the terminal display IS the output.
