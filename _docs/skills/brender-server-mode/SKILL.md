---
name: brender-server-mode
description: >
  Brender のサーバモード（ブラウザからの複数ユーザ利用）の仕組みと、サーバモードで考慮すべきことの
  チェックリスト。有効化と起動フロー（Environment.Server/ServerHost/ServerPort/ServerAuth、
  main.go での rest.NewServer 起動と自作の Wails Transport）、ブラウザからの Wails バインディング呼び出し
  （POST /wails/runtime の守り・api.WithBrowser）、HTTP ルーティング構成（SPA 配信・認証の口・
  /events SSE・/thumbnail・/_movie）、サービスのメソッドの追加手順、認証ミドルウェアとセッション Cookie、
  SSE broker の実装、フロントエンドの isWails 判定と setTransport を扱う。
  api/rest/ 配下・_cmd/brender/main.go のサーバ起動部・_cmd/brender/transport.go・
  _cmd/brender/services/・src/lib/api/_client.js を変更するとき、
  新しい API エンドポイントを追加するとき、またはサーバモード・ブラウザモード・認証・セッション・
  SSE に関する作業のときは必ずこのSkillを参照すること。
---

# Brender サーバモード

Brender のベース機能（デスクトップ運用）に対し、サーバモードは「同じアプリを HTTP 経由で複数ユーザに公開する」追加レイヤ。権限・ロール体系の詳細は Skill `brender-access-control`、イベント配信（emit/SSE）の詳細は Skill `brender-render-pipeline` を参照。

## 有効化と起動フロー

- 設定は `Environment` に持つ: `Server bool` / `ServerHost string` / `ServerPort int`（gorm default 8080）/ `ServerAuth bool`（モデルはファイル名 typo に注意: `model/enviroment.go`）
- 変更 API: `Environment.SetServer`（admin 限定、`api.SetServer(ctx, enabled, host, port, auth)`）。設定画面から変更できるが、**サーバの起動は main.go の起動時のみ — 変更はアプリ再起動で反映**。
- `main.go` の流れ: `env.Server == true` なら **`application.New` より前に** `rest.NewServer(assets, env.ServerHost, env.ServerPort)` → `broker = restServer.Broker()` → `newBrowserTransport(restServer)` を `application.Options.Transport` に渡す → `emit` クロージャに broker を接続 → フック設定後に `restServer.Start()`（goroutine で `Serve`）→ 終了時に `Shutdown(ctx)`。`env.Server == false` なら Transport は nil（Wails の既定。ウィンドウだけ）。
- **起動時のログ**: サーバモードの状態を起動のたびに必ず出す（`main.go` の `startupLog`。ログファイルに加えてターミナルにも出す）。`= Server mode: off` / `= Server mode: on, listening on http://…`（すべてのインターフェイスなら `localhost` と `(all interfaces)`、ユーザ管理のオン・オフ付き）/ 失敗は ERROR で `= Server mode: failed to start on …`。設定を変えたときは `api.SetServer` が `= Server settings changed: … (restart to apply)` を出す
- **ヘッドレス運用は不可**: HTTP サーバは Wails アプリのプロセス内で動く（`app.Run()` 前提）。GUI なしでは起動できない。(今の実装はいつもメインのウィンドウを作り、閉じるとアプリが終わる。ウィンドウを作らなくても `app.Run()` は動き続けると分かったので、`TODO.md` の「ウィンドウを出さずに動かす」で変える予定)

## ブラウザからのバインディング呼び出し（Wails の Transport）

ブラウザはウィンドウと**同じ Wails のバインディング**（`_cmd/brender/services/`）を呼ぶ。REST のディスパッチは無い（二重登録なし）。経緯と調べた内容は `_docs/server-transport.md`。

```
ウィンドウ(WebView) ──wails://──→ Wails の配信 ──→ バインディング（ctx に利用者なし → owner）
ブラウザ ──HTTP──→ rest.Server（authMiddleware）
                    └ POST /wails/runtime → handleRuntimeCall（守り）→ Wails の配信 ──→ バインディング（ctx に利用者・WithBrowser）
```

- **自作の Transport** (`_cmd/brender/transport.go` の `browserTransport`): `*application.HTTPTransport` を埋め込み（ウィンドウの通り道はそのまま）、`ServeAssets(h)` で受け取った Wails の配信を `restServer.SetRuntimeHandler(h)` に渡すだけ。**`WailsEventListener`（`DispatchWailsEvent`）を持たせない** — 持たせるとウィンドウへのイベント（IPC）が外れる
- **守り** (`api/rest/runtime.go` の `handleRuntimeCall`):
  - 通す `object` は 0（メソッド呼び出し）と 10（取り消し）だけ。Wails の決まった API はウィンドウ無しでも通るため（`Application.Quit` でアプリが終わる・`Events.Emit` で偽のイベント）断る（403）
  - チャンク送信（`x-wails-chunk-id`）は中身を確かめられないので断る（400）。本文の上限は 64 MiB
  - ユーザ管理が有効で ctx に利用者が無ければ 401（ctx に利用者が無いと api 層は owner とみなすため）
  - `x-wails-window-*` ヘッダーを消し、ctx に `api.WithBrowser` の印を付ける
- `/wails/runtime.js` は Wails の配信から返す。それ以外の `/wails/*`・未定義の `/api/*` は 404
- **ウィンドウかブラウザかの見分け**: サービスの中では `api.FromBrowser(ctx)`。印を付けるのは rest サーバだけなので偽れない。**ヘッダーや `application.WindowKey` で判定しない**
- Wails はメソッドを HTTP の処理と同じ goroutine で同期に呼び、呼び出しが返ると ctx を取り消す。goroutine で ctx を使い続けるときは `context.WithoutCancel(ctx)`（`Workspace.CreateMovie` 参照）

### エラーとログの出方

- バインディングのメソッドが error を返すと、HTTP 422 で `{"message": "...", "cause": {}, "kind": "RuntimeError"}` が返る。画面（`_client.js` の呼び出し口）は `message` を `Error` にして投げるので、ウィンドウと同じ try/catch で扱える
- 権限エラー（`access denied`）も Wails がログに **ERROR**（`Binding call failed: Bound method returned an error: access denied`）で出す。利用者の操作ミスでも ERROR になる点に注意
- 守りで断ったもの: object の不許可は 403（ログに WARN `runtime: object N from browser is not allowed`）、未ログインは 401、チャンクは 400
- `/wails/runtime` の呼び出し自体は `requestLogger` の DEBUG にしか出ない（以前の REST のような 1 呼び出し 1 行の INFO は無い）
- runtime はページ読み込み時に `HEAD /wails/custom.js` を見に来る。404 でよい（無ければ読み飛ばす）
- 監査カラム（`created_by` など）にはログインした利用者が入る（メソッドが HTTP の処理と同じ goroutine で呼ばれるため、goroutine ユーザも効く）

## HTTP ルーティング構成 (`api/rest/server.go`)

`NewServer` が `http.ServeMux` を組み、全体を `requestLogger(authMiddleware(mux))` でラップする。

| ルート | 内容 |
|---|---|
| `POST /api/auth/login`・`logout`・`is_auth_enabled`、`GET /api/auth/me`、リセット系 | 認証の口（ログイン前にも使うため REST のまま） |
| `POST /wails/runtime` | バインディング呼び出し（上記の守りを通して Wails の配信へ） |
| `GET /wails/runtime.js` | Wails の配信 |
| `GET /events` | SSE（`broker.Handler()`） |
| `POST /api/project/upload_file` | multipart アップロード（最大 512MB、`api.UploadProjectFile`）。進み具合を取るため REST のまま |
| `GET /thumbnail` | サムネイル画像配信（`api.ServeThumbnailPath` が権限+パス解決、`http.ServeFile` が 304 処理） |
| `GET /_movie` | ローカル動画配信（`api.ValidateWorkDirPath` で作業ディレクトリ配下に限定） |
| `/`（その他） | SPA 配信（`frontend/dist`、実ファイルがなければ `index.html`） |

**サーバモードフラグの注入**: SPA の `index.html` の `<head>` に `<script>window.__brender_server_mode=true</script>` を注入する。ビルド済み JS に `@wailsio/runtime` が含まれ `window._wails` がセットされてしまうため、フロントの判定は:
```js
// src/lib/api/_client.js
export const isWails = () => Boolean(window._wails) && !window.__brender_server_mode
```

`isWails()` は**見た目の分かれ道**（ウィンドウ操作・ダイアログ・イベントの受け方・別ウィンドウかタブか）にだけ使う。API ラッパーはモードに関係なくバインディングを呼ぶ。

**ブラウザの呼び出し口**: `_client.js` がサーバモードのとき `@wailsio/runtime` の `setTransport()` で呼び出しを差し替え、`POST /wails/runtime` に送る。401 なら `window.location.reload()` でログイン画面へ。チャンク送信は使わない。
`@wailsio/runtime` は `latest` のまま（npm のリリースは Go 側の版と一致しないため固定しない。Skill `wails3`）。runtime を上げたときは `setTransport` / `clientId` の口が変わっていないかを見る。

### サービスのメソッドの追加手順

1. `api/` にビジネスロジックを実装（第1引数 `ctx`、権限は `api/access.go` のヘルパー。admin 操作は関数の中で `requireAdmin(ctx)`）
2. `_cmd/brender/services/` のサービスにメソッド追加。**第1引数は `ctx context.Context`**（Wails が渡し、JS の引数には出ない）で、そのまま api 層へ渡す → `wails3 generate bindings`
3. `src/lib/api/{service}.js` のラッパーに `svc().then(s => s.Method(...))` を追加（引数はオブジェクト形式で受け、位置引数で渡す）
4. **ブラウザからも呼べる**ことを前提に確かめる: ウィンドウを開く・サーバの画面を使う操作は `api.FromBrowser(ctx)` なら `api.ErrNotAvailableFromBrowser` を返す。ブラウザで形を変えたい返り値（サムネイルの URL など）も `api.FromBrowser(ctx)` で分ける

## 認証 (`api/rest/auth.go`)

- セッション Cookie: `brender_session`（HttpOnly / SameSite=Lax / 30日 / `Secure` は HTTPS リクエスト時のみ — HTTP の LAN 運用でも動くように）
- `authMiddleware` の流れ: 公開パス（login・reset 系・静的拡張子 — `/wails/runtime.js` を含む）はスキップ → `api.IsAuthEnabled()` が false なら Guest として続行 → Cookie のセッションを `api.ValidateSession` で検証 → 成功時 `model.WithUser(ctx)`（権限判定用）+ `model.SetGoroutineUser`（監査カラム用）
- **未認証時の応答分岐** (`handleUnauthorized`): `/api/*`・`/wails/*`・`/_movie`・`/events`・`/thumbnail` は 401 JSON、ページリクエストは SPA を返す（React 側でログイン画面を表示）
- フロント側: `serverCall`・ブラウザの呼び出し口が 401 を受けたら `window.location.reload()` → ログイン画面へ
- パスワードリセット: `/user/reset/{token}` ページ + `auth/validate_reset_token` / `auth/reset_password` API（公開パス）
- 期限切れセッション・リセットトークンは `NewServer` 時の `cleanupExpiredAuthData()` で掃除

## SSE broker (`api/rest/sse.go`)

- fan-out 型: クライアントごとにバッファ 16 の chan、**詰まったら drop**（ブロックしない）
- 配信形式: `data: {"name": "...", "data": ...}\n\n`
- `main.go` の `emit(name, data)` が Wails Event と `broker.Emit` の両方へ配る（新イベントは必ず emit 経由）
- フロントは `src/lib/appEvents.js` が `EventSource('/events')` のシングルトンで受信

## 実機での確かめ方

本物の DB（`~/.brender/brender.db`）を触らずに、サーバモードを本番ビルドで確かめる手順。

1. 仮のホームを作る。`config.Dir()` は `os.UserHomeDir()`（Windows は `USERPROFILE`）を使うので、`USERPROFILE` を差し替えれば DB・`brender.ini` が仮のホームの `.brender/` に向く。ログの出先は仮の `brender.ini` の `log_dir` で分ける
2. 仮の DB を作る小さな Go プログラム（`replace github.com/secondarykey/brender => <checkout>`）で `model.Init` → `model.SetEnvironment(&model.Environment{Server: true, ServerHost: "127.0.0.1", ServerPort: <空きポート>, ServerAuth: true})` → `model.CreateUser` / `model.SetPassword` で admin と creator を作る
3. `frontend/dist` を作ってから `go build -tags production` し、`USERPROFILE=<仮のホーム>` で起動する（デスクトップにウィンドウも出る）。起動ログに `= Server mode: on, listening on ...` が出る
4. curl で `POST /api/auth/login`（Cookie を保存）→ `POST /wails/runtime` に `{"object":0,"method":0,"args":{"call-id":"x","methodID":<ID>,"args":[...]}}`。`methodID` は生成されたバインディング（`frontend/bindings/main/services/*.js` の `$Call.ByID(<ID>, ...)`）から取る
5. 確かめること: 未ログインは 401、creator の admin 操作は `access denied`、ウィンドウを開くメソッドは `not available from browser`、`{"object":2,"method":2}`（Quit）と `{"object":3,...}`（Emit）は 403。ブラウザで画面を開き、`/wails/runtime` が 200・SSE が届く・コンソールにエラーが無いこと
6. 終わったら `taskkill /IM <exe>`（`/F` なしで WindowClosing フックを通す）

## サーバモードで考慮すべきことチェックリスト

新機能を追加するとき、ベース機能に加えて以下を確認する:

- [ ] **全メソッドがブラウザから呼べる**: サービスに足したメソッドは選別なしにブラウザへ出る。ウィンドウを開く操作は `api.FromBrowser(ctx)` で断ったか
- [ ] **権限**: サービスは `ctx` を受けて api 層へ渡しているか。admin 操作は api の関数の中で `requireAdmin(ctx)` を通しているか（REST 側の守りは無い）。リソース権限は `require*` ヘルパーを通しているか（Skill `brender-access-control`）
- [ ] **イベント**: 新イベントは `emit` 経由か（Wails のみに Emit すると SSE に届かない）
- [ ] **ファイルパス**: ブラウザは OS のファイルダイアログ・ローカルパスを使えない。パス入力系 UI は `isWails()` で分岐し、ブラウザ側はアップロード（multipart）や登録済みディレクトリ選択にする
- [ ] **生パスの検証**: ローカルパスを受け取る/配信する口は `ValidateWorkDirPath` で作業ディレクトリ配下に限定したか
- [ ] **画像・大容量データ**: base64 で返すと 33% 肥大しキャッシュも効かない。サムネイルのように URL 配信 + `Last-Modified` を検討
- [ ] **同時アクセス**: DB は WAL 設定済み（`model.Init`）だが、書き込み競合するフローは mutex（`enqueueMu` 方式）を検討
- [ ] **常駐プロセス**: 無制限に増えるリソース（temp スクリプト等）は起動時クリーンアップに載せたか
- [ ] **認証スキップ対象**: 静的拡張子（`.js` `.png` 等）は認証をスキップする。機密データを静的ファイルとして配置しない
- [ ] **設定の反映タイミング**: サーバ設定（host/port/auth）は再起動で反映。`brender.ini` も同様
