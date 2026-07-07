# CLAUDE.md — フロントエンド規約

`_cmd/brender/frontend/` 配下の作業時に適用される規約。プロジェクト全体の概要・ビルドコマンド・データモデルはルートの `CLAUDE.md` を参照。

## Navigation hierarchy

プロジェクト一覧 → プロジェクト詳細（ファイル一覧タブ） → ファイル詳細（ワークスペース左/履歴右の分割レイアウト・設定タブ） → ワークスペース設定（設定左/履歴右の分割レイアウト）

Breadcrumb: プロジェクト › プロジェクト名 › ファイル名 › ワークスペース名

## Page Structure

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

After `Enqueue()` succeeds, the app navigates to the queue page (`navigate('queue')`).

QueuePage の進捗バー計算式・ProcessingWriter 由来の進捗フィールド（`now_tile` / `total_samples` / `frame_active` など）の意味は Skill `brender-render-pipeline` を参照。

### ファイル一覧タイル表示 (`WorkspaceTab.jsx`)
- デフォルト表示: カード（タイル）表示
- 表示切り替えボタン: 左寄せ
- 「+ .blend ファイルを追加」ボタン: `.list-fab`（`position: sticky; bottom: 16px`）で画面下部に常時表示
- 「ディレクトリからファイルを追加」機能: プロジェクト設定タブ（SettingsTab）の作業ディレクトリセクション下に配置
- タイルサイズ: 幅 320px、縦レイアウト（サムネイル上 180px + 名称のみ下）
- サムネイル: `ProjectApi.getFileThumbnail({ projectID, fileID })` で取得（Wails は base64、サーバモードは配信URL）して `<img src>` に渡す（消費側コードはモード非依存）

### サイドバー
- アイコンのみ表示（ラベルなし）、`title` 属性でツールチップ
- アイコンサイズ 32px、ナビアイテム 48×48px
- キューアイコン右上に実行中件数バッジ（オレンジ丸）を表示
  - 初期値は `QueueApi.list()` で取得、以後 `queue:changed` イベントで更新

### ページネーション (`src/components/Pagination.jsx`)
- `page`, `totalPages`, `onChange` に加えて `pageSize`, `onPageSizeChange`, `total` を受け付ける
- `pageSize` / `onPageSizeChange` が渡された場合、左端に表示件数セレクタ（5/10/20/100）と全件数を表示
- `totalPages` が 1 でもページ情報行は常に表示

### 権限によるUI制御
サーバモード（`Server` + `ServerAuth` 有効時）のロール体系と UI 制御の詳細は Skill `brender-access-control` を参照。要点:
- `PermissionSection.jsx`（`mode='project'` / `mode='file'`）— Wails モードでは `server && server_auth` が無効なら `return null`
- `ProjectListPage.jsx` — ブラウザモードで `AuthApi.me()` のロールを確認（`viewer` は作成不可、`me()` が `null` = 認証無効ならフルアクセス）
- `QueuePage.jsx` / `JobManagement.jsx` — `has_file_access === false` のジョブは行クリック・ナビゲーションを抑制し、ファイル名を淡色テキスト表示

### Environment setup guard
On startup, `App.jsx` calls `EnvironmentApi.get()`. If `ProjectRoot` is not set, it automatically navigates to the settings page. `ProjectListPage` also shows a warning banner and disables project creation until a root directory is configured.

`EnvironmentApi.getWorkDir()` returns `os.Getwd()` for use as the default directory in the folder picker dialog.

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
  codes.js        CodesApi  ← コード管理（フォーマット・解像度プリセット）
  index.js        re-export
```

- **モード判定**: `isWails()` は `window._wails && !window.__brender_server_mode`。サーバモードでもバンドル内の `@wailsio/runtime` が `window._wails` をセットするため、サーバ側が index.html に注入する `__brender_server_mode` フラグで区別する
- **Wailsモード**: `@wailsio/runtime` を動的インポートして既存 Service を呼ぶ
- **サーバモード**: `POST /api/{service}/{method}` + JSON ボディ、レスポンス `{ data } | { error }` 形式（業務エラーも HTTP 200）。401 は `window.location.reload()` でログイン画面へ。詳細は Skill `brender-server-mode`
- 引数は常にオブジェクト形式: `ProjectApi.get({ id })`, `QueueApi.cancel({ id })` など
- サーバモードの REST エンドポイントは snake_case: `list_by_project`, `get_engines` など

### CodesApi（コード管理）
```js
import { CodesApi } from '../../lib/api'
CodesApi.getImageFormats()      // Promise<ImageFormat[]>
CodesApi.getVideoFormats()      // Promise<VideoFormat[]>
CodesApi.getResolutionPresets() // Promise<ResolutionPreset[]>
```
利用箇所: `BlenderSettings.jsx`（image_formats）、`WorkspaceDetailPage.jsx`（image_formats + resolution_presets）、`VideoSettings.jsx` / `JobPage.jsx`（video_formats）。
`code/` の仕組み・新カテゴリ追加手順は Skill `brender-codes` を参照。

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

## 共通ダイアログ (`src/components/Dialog.jsx`, `ConfirmDialog.jsx`)

モーダルは共通コンポーネント経由で作る。`.dialog-overlay`+`.dialog` を各ページに直接書かない。

### `Dialog`
汎用ダイアログ。props:
- `open` — false なら非描画
- `title` / `children`（本文）/ `actions`（フッターに差し込むノード）
- `onClose` — 背景クリック・Esc キーで呼ぶ（`closeOnBackdrop` が true のときのみ）
- `closeOnBackdrop`（既定 true）— 処理実行中は false を渡し誤クローズを防ぐ
- `message` + `messageSeverity`（`error`/`success`/`info`）— ダイアログ上部のメッセージ領域（`.dialog-message`）
- `wide`（`.dialog-wide`）/ `className` / `bodyClassName`

### `ConfirmDialog`
`Dialog` を派生した確認ダイアログ。props: `open` / `title` / `onConfirm` / `onCancel` / `confirmLabel` / `cancelLabel`（既定 `common.cancel`）/ `confirmClassName`（既定 `btn btn-danger`）/ `busy`（処理中はボタン無効化＋背景クローズ無効）/ `message` / `children`。
**削除操作には必ず確認ダイアログを挟む**（`window.confirm` は使わない）。

## メッセージ表示 (`src/lib/toast.jsx`)

`ToastProvider` が `App.jsx` 全体をラップし、2系統のフィードバックを管理する。

- **成功・完了** → `useToast()` の `showToast(msg)`。画面下部トースト、2秒で自動消去。
- **エラー（API/通信/操作失敗）** → `useMessage()` の `showError(msg)`。`MainLayout` 上部の全幅バー（`.app-message-bar`）に表示し、クリアまたは次のエラーで置換されるまで残る。`clearError()` または × ボタンで消える。`useMessage()` は `{ showError, clearError, error }` を返す。
- **入力検証エラー**（特定フィールドに紐づくもの。「名前は必須」など）はグローバルバーに出さず、フィールド近くにインライン表示する。
- **ダイアログ内のエラー** はグローバルバーではなく `Dialog`/`ConfirmDialog` の `message` prop に渡し、ダイアログ上部に表示する。
- `LogViewerApp` / `MovieViewerApp` は `MainLayout` を持たない独立 Wails ウィンドウのため、グローバルバー対象外（ローカルにインライン表示）。

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

## テーマシステム (`src/lib/theme.js`)

アプリはダーク / ライト / システム設定準拠の 3 モードをサポートする。

### 設定・保存
- localStorage キー: `brender-theme`（値: `'system'` | `'dark'` | `'light'`、未設定は `'system'`）
- `system` モードは `window.matchMedia('(prefers-color-scheme: light)')` で OS 設定を自動追従
- アプリ起動時に `main.jsx` 内の `initTheme()` が `html` 要素への属性付与を行う

### テーマ適用の仕組み
- ライトモード: `document.documentElement.setAttribute('data-theme', 'light')`
- ダークモード（デフォルト）: `data-theme` 属性なし

### `useTheme` フック
```js
import { useTheme } from '../../lib/theme'
const { preference, changeTheme } = useTheme()
// preference: 'system' | 'dark' | 'light'
// changeTheme('light')  → localStorage 保存 + 即時適用
```

### 設定画面
設定 → 「基本設定」タブ → 言語セレクトの下にテーマセレクト。i18n キーは `settings.theme` / `settings.themes.{system|dark|light}`。

---

## CSS Conventions (`frontend/public/style.css`)

### カラー変数システム

CSS Custom Properties でダーク/ライトを切り替える。**色をハードコードせず変数を使うこと。**

| 変数 | ダーク | ライト | 用途 |
|---|---|---|---|
| `--fg` | `255, 255, 255` | `0, 0, 0` | 前景 RGB チャンネル（rgba の第1引数に使う） |
| `--bg` | `#1a1a1a` | `#f2f2f2` | メイン背景 |
| `--bg-panel` | `#111111` | `#e4e4e4` | サイドバー・タイトルバー |
| `--bg-deep` | `#111` | `#d0d0d0` | サムネイル・画像ビューア等の深い背景 |
| `--bg-card` | `#222` | `#eaeaea` | カード・タイル背景 |
| `--bg-input` | `#1e1e1e` | `#ffffff` | フォーム入力・セレクト・ダイアログ |
| `--bg-popup` | `#2a2a2a` | `#f8f8f8` | ポップアップ・オートコンプリート |
| `--bg-overlay` | `rgba(26,26,26,0.78)` | `rgba(240,240,240,0.88)` | ワークスペース一覧のオーバーレイ |
| `--bg-log-btn` | `rgba(30,30,30,0.92)` | `rgba(235,235,235,0.95)` | ログビューア浮遊ボタン |

**前景色の使い方:**
```css
/* ✅ 正しい */
color: rgba(var(--fg), 0.87);
border: 1px solid rgba(var(--fg), 0.12);
background: rgba(var(--fg), 0.06);

/* ❌ ハードコード禁止 */
color: rgba(255,255,255,0.87);
background: #1a1a1a;
```

**アクセントカラー（テーマ非依存・固定値）:**
- 青（ナビ・フォーカス）: `#4a7cdc`
- 緑（保存・完了）: `#27ae60`
- 赤（削除・エラー）: `#c0392b`
- オレンジ（実行ボタン）: `#d15904` / hover `#e86a10`

**例外:** `.movie-info-overlay` はビデオ背景が常に黒のため `rgba(255,255,255,0.88)` をライトモードでも維持（`html[data-theme="light"]` で明示的に上書き）。

### レイアウトルール
- `.page:has(.tab-nav)` → flex column, overflow hidden; `.tab-content` → flex:1, min-height:0, overflow-y:auto (タブコンテンツのみスクロール、ヘッダ固定)
- `.page` without tabs → overflow-y:auto (ページ全体スクロール)
- `.form-actions` → `justify-content: space-between` (削除ボタン左・保存ボタン右)
- `#app, #root` must both have `width/height: 100%` for the height chain to work

### フォームレイアウト
設定フォームは以下のクラスを使う（`WorkspaceDetailPage` 等が基準）：

```jsx
<div className="form" style={{ maxWidth: 640 }}>
  <div className="form-row">                    {/* 横並び行: display:flex; gap:16px */}
    <div className="form-field" style={{ flex: 2 }}>   {/* 縦並びフィールド: flex-direction:column; gap:6px */}
      <label className="form-label">ラベル</label>     {/* 0.85rem, 60%白 */}
      <input className="form-input" style={{ width: '100%' }} />  {/* height:36px, 角丸 */}
    </div>
    <div className="form-field" style={{ flex: 1 }}>
      <label className="form-label">ラベル</label>
      <select className="form-select" />
    </div>
  </div>
</div>
```

- `form-field` を単独で使う場合も同じ（`form-row` は省略可）
- `textarea` には `textarea.form-input { height: auto; padding: 8px 10px }` が適用される。`minHeight` と `resize: vertical` をインラインで指定する
- `input` / `textarea` は `width: 100%` を付けてカラム幅いっぱいに広げる（デフォルトは `width` 未指定）
- `.form-hint` — 補足テキスト（11px, #888）
- `.form-actions` — `justify-content: space-between`（削除ボタン左・保存ボタン右）

### 左右分割レイアウト (`.ws-detail-split`)
ファイル詳細・ワークスペース詳細で使用：
```css
.ws-detail-split  { display: flex; gap: 32px; flex: 1; min-height: 0; overflow: hidden; }
.ws-detail-left   { flex: 3; min-width: 0; overflow-y: auto; }   /* 約60% */
.ws-detail-right  { flex: 2; min-width: 0; overflow-y: auto; }   /* 約40% */
```
- `.page:has(.ws-detail-split)` → `display: flex; flex-direction: column; overflow: hidden`
- `.tab-content:has(.ws-detail-split)` → `overflow: hidden; display: flex`
- デフォルト比率は左 3 / 右 2。左が狭くていい場合はインラインで `style={{ flex: 2 }}` / `style={{ flex: 3 }}` で上書きする

### ボタンスタイル（色は役割で統一）
| 役割 | クラス | 色 |
|---|---|---|
| 表示系・ナビゲーション | `.btn` | 青 `#4a7cdc` |
| 更新系（保存・作成など主要操作） | `.btn-green` | 緑 `#27ae60` |
| 更新系（非主要・ツール用途） | `.btn-outline` | 透明＋白枠 |
| 削除 | `.btn-danger` | 赤 `#c0392b` |
| Blender 実行（レンダリング・ファイルを開く） | `.btn-run` | オレンジ `#d15904` |
| ダイアログのキャンセル等 | `.btn-ghost` | 透明 |

- `.btn-sm` は色クラスと併用する大きさ修飾（高さ 28px）
- `.btn-outline-active` は選択モード等のトグル ON 状態用（青枠）
- タブ (`.tab-btn`)・パンくず (`.breadcrumb-link`)・ページネーション (`.pagination-btn`)・表示切替トグル (`.file-view-btn`)・サイドバー (`.nav-item`)・タイトルバー (`.titlebar-btn`) はアクションボタンではないため色規約の対象外
