# サーバモードを Wails の Transport で作り直す(検討メモ)

- 状態: 実装した(2026-10-19)。今の仕組みは Skill `brender-server-mode`・`brender-access-control` を正とする。このメモは経緯として残す。
  ウィンドウの側もユーザーが確かめた(2026-10-19)。残りは `@wailsio/runtime` を Go の側の版にそろえること(下の「実装した結果」)
- 書いた日: 2026-10-19(aibow の相談の中で調べた。Chat が書いた)
- 追記: 2026-10-19(試作の結果と、試作で見つかった気をつけること 6〜11 を足した。Code が書いた)
- 追記: 2026-10-19(実装した結果を足した。Code が書いた)
- 関係する資料: Skill `brender-server-mode`(今のサーバモード)・`brender-access-control`(権限)
- 調べた版: Wails v3.0.0-beta.23(brender が使っている版)。beta.26 も、下で読んだファイルは同じ中身

## 目的

今のサーバモードは、ブラウザからの呼び出しを自前の REST(`api/rest/`)で受けている。そのため、次の手間がある。

- **二重登録**:Wails のサービス(`_cmd/brender/services/`、メソッド 161)と、REST のディスパッチ(`api/rest/routes.go`、登録 約170)の両方に足す
- **画面の分かれ道**:`src/lib/api/*.js` のラッパーが `isWails()` で Wails のバインディングと `serverCall` を切り替える(約180か所)
- **細工**:`/wails/` のダミー、`index.html` への `window.__brender_server_mode` の差し込み

Wails v3 の **Transport の差し替え**(`application.Options.Transport` の `AssetServerTransport`)を使うと、
**同じ exe・同じプロセスのまま**、ブラウザからも Wails のバインディングをそのまま呼べる見込み。二重登録と分かれ道をなくすのが目的。

## 決めたこと(ユーザーと決めた。2026-10-19)

- **別の exe にしない**。Wails の Server Build(`-tags server`)は、ビルドの時に切り替えるので別の exe になる。今の「デスクトップアプリがそのままサーバにもなる」形を保つため使わない
- ウィンドウを出さずに動かす(バックグラウンド実行)は、デスクトップのビルドのままで行う予定(`TODO.md`)

## 調べたこと(Wails のソース。2026-10-19)

- `Transport`(`v3/pkg/application/transport.go`):画面と Go のやり取りの通り道を差し替える interface。`Start(ctx, *MessageProcessor)` / `JSClient()` / `Stop()`
- `AssetServerTransport`:`Transport` に `ServeAssets(assetHandler http.Handler)` を足したもの。説明に「ブラウザから使う・ネットワークに出すため」とある。
  Wails は `Start` の後に、自分の配信(静的ファイル + `/wails/runtime.js` など)を `assetHandler` として渡してくる。Transport はそれを自分の HTTP サーバに載せる
- 渡される `assetHandler` は、`AssetOptions.Middleware` → Wails の内部の処理 → Transport の `Handler()`(既定の `HTTPTransport` なら `/wails/runtime` を処理する)を通る鎖。
  なので、**既定の `HTTPTransport` を中に持つ Transport なら、ブラウザからの `POST /wails/runtime` も同じ鎖で処理される**(試作で確かめた)
- バインディングのメソッドに渡る `ctx` は、HTTP のリクエストの `r.Context()` から作られる(`transport_http.go` → `HandleRuntimeCallWithIDs`)。
  `context.WithoutCancel` で包むので**値は引き継がれる**。手前の middleware が `model.WithUser(ctx)` で入れた利用者を、メソッドの中で読める
- ウィンドウの無い呼び出しも想定されている(`messageprocessor_call.go` に「Calls may originate from windowless transports」とある)。ウィンドウがあるときだけ `ctx` に `application.WindowKey` が入る
- **ウィンドウの見分けはヘッダー**(`x-wails-window-id` / `x-wails-window-name`)。ブラウザも偽って送れる
- 公式の例 `v3/examples/websocket-transport`:デスクトップのウィンドウを出しながら、`:9099` でブラウザにも画面とバインディングを出している(通り道は WebSocket)。同じプロセスで両方を出す形の手本
- 参考(使わないもの):Server Build では、イベント用の WebSocket(`/wails/events`)は `AssetOptions.Middleware` を通らず(ログインしていなくてもつなげる)、送り先を1人に絞る手段も無い。
  デスクトップのビルドには、ブラウザにイベントを送る仕組み自体が無い
- 自作の Transport が `WailsEventListener` を持つと、ウィンドウへのイベントの送り方(IPC)が外される(`application.go` の `transport.(WailsEventListener)` の分かれ道)。
  なので自作の Transport には `DispatchWailsEvent` を持たせない
- 画面が使う `@wailsio/runtime` は、呼び出し先を `window.location.origin + "/wails/runtime"` で決める(`runtime.ts` の `runtimeURL()`)。
  ブラウザで開いたときは、開いたサーバの `/wails/runtime` に届く

## 試作で確かめたこと(2026-10-19)

beta.23 で、ウィンドウを作らない小さなアプリを作った(リポジトリの外。中身は下の「試作の形」)。
自作の Transport は `*application.HTTPTransport` を埋め込み、`ServeAssets` で `127.0.0.1:9123` に自前の `http.Server` を立てる。
自前のサーバの middleware は、`x-wails-window-*` のヘッダーを消し、試しのヘッダー(`X-Test-User`)の値を `ctx` に入れる。curl で呼んだ。

| 確かめたこと | 結果 |
|---|---|
| `GET /` と `GET /wails/runtime.js` | ✅ 自前のサーバを通して Wails の配信が返る |
| `POST /wails/runtime` でサービスのメソッドを呼ぶ(ウィンドウ無し) | ✅ 呼べる |
| 自前のサーバの middleware で入れた値が、メソッドの `ctx` に届くか | ✅ 届く。`application.WindowKey` は入らない |
| `x-wails-window-id` を偽って送る | ✅ middleware で消せば効かない(ウィンドウ無しとして扱われる) |
| `ctx` を受けないメソッド | 呼べる(=守りの無いまま出る。気をつけること 1) |
| ウィンドウの API(`object` 6)・ダイアログ(5) | 断られる(`window '' not found`) |
| **`Application.Quit`(`{"object":2,"method":2}`)** | **通る。アプリが終わった**(気をつけること 6) |
| **`Events.Emit`(`object` 3)** | **通る**。好きな名前のイベントを出せる(気をつけること 6) |
| メソッドが呼ばれる goroutine | HTTP の処理と同じ goroutine で、そのまま呼ばれる。監査用の goroutine ユーザ(`model.SetGoroutineUser`)もそのまま使える |
| 本文の大きさの上限 | `maxRuntimeBodyBytes` = `maxAssembledBytes` = **64 MiB**(`transport_http.go`) |
| ウィンドウを1つも作らずに `app.Run()` | 終わらずに動き続けた(Windows)。`TODO.md` の「ウィンドウを出さずに動かす」の見込みにもなる |

まだ確かめていないこと:

- **ウィンドウの側が今までどおり動くか**(試作はウィンドウを作っていない。WebView からの `wails://` の通り道は変えていないので、変わらない見込み)
- 本物の画面(React と、バンドルされた `@wailsio/runtime`)をブラウザで開いて、生成されたバインディングで呼べるか

試作の形(要点だけ):

```go
type browserTransport struct {
	*application.HTTPTransport // Start / JSClient / Handler は任せる
	srv *http.Server
}

func (t *browserTransport) ServeAssets(assetHandler http.Handler) error {
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Header.Del("x-wails-window-id")
		r.Header.Del("x-wails-window-name")
		assetHandler.ServeHTTP(w, r.WithContext(model.WithUser(r.Context(), userID)))
	})
	t.srv = &http.Server{Addr: addr, Handler: h}
	go t.srv.ListenAndServe()
	return nil
}

func (t *browserTransport) Stop() error {
	t.srv.Close()
	return t.HTTPTransport.Stop()
}

// application.Options{ Transport: &browserTransport{HTTPTransport: application.NewHTTPTransport()} }
```

## 形(案)

```
ウィンドウ(WebView) ──wails://──→ assetHandler の鎖 ──→ バインディング(ctx に利用者なし → Owner)
                                       ↑
ブラウザ ──HTTP──→ 自前の http.Server
                    ├ authMiddleware(Cookie → model.WithUser。未ログインは Guest。ヘッダー x-wails-window-* は消す)
                    ├ /events(SSE。今のまま)・アップロード・/thumbnail・/_movie・ログインの口(今のまま)
                    ├ POST /wails/runtime → ログイン必須・object は 0(呼び出し)と 10(取り消し)だけ通す
                    │                        → assetHandler の鎖 ──→ バインディング(ctx に利用者あり)
                    └ 決めたパスだけ(静的ファイル・/wails/runtime.js) → assetHandler の鎖。それ以外の /wails/* は断る
```

- 自作の Transport は、既定の `HTTPTransport`(`application.NewHTTPTransport()`)を中に持ち、`Start` / `JSClient` / `Stop` / `Handler` はそれに任せる。
  `ServeAssets` で、上の「自前の http.Server」を立てる(今の `rest.NewServer` の役目)。ウィンドウ側の通り道は今までと変わらない
- 認証は **`AssetOptions.Middleware` ではなく、自前のサーバの側で包む**。`AssetOptions.Middleware` はウィンドウからのリクエストも通るため、ウィンドウとブラウザを見分けられない
- イベントは**今の `emit`(Wails Event + SSE broker)のまま**

## 変わるもの・残るもの

| | 今 | 作り直した後 |
|---|---|---|
| exe | 1つ(ウィンドウ + HTTP サーバ) | 1つのまま |
| ブラウザからの呼び出し | `POST /api/{service}/{method}`(自前の REST) | `POST /wails/runtime`(Wails のバインディング) |
| `routes.go` のディスパッチ | 約170の登録 | 要らない |
| 画面の API ラッパー | `isWails()` で分かれる | バインディングだけ。見た目の分かれ道(ダイアログとアップロードなど)は残る |
| `/wails/` のダミー・`__brender_server_mode` の差し込み | ある | ダミーは要らない。差し込みは見た目の分かれ道の判定に使うなら残す(未決) |
| 認証・セッション・パスワードの再設定 | `api/rest/auth.go` | 残す(自前のサーバの手前) |
| SSE・アップロード・`/thumbnail`・`/_movie` | 自前 | 残す |
| 権限の判定 | REST は `ctx` の利用者・`registerAdmin`。Wails は `api.WailsContext()`(いつも Owner) | **サービスが `ctx` を受け取り、`ctx` の利用者で判定する**(下の 1) |

## 気をつけること

1. **登録したサービスのメソッドが全部ブラウザから呼べるようになる**。今の REST は出すメソッドを選んで登録しているが、Transport ではその選別が無くなる。
   - 今のサービスは `api.WailsContext()`(いつも Owner)を使っているので、**そのままだとブラウザの利用者も Owner の権限になる**
   - サービスのメソッドの第1引数を `ctx context.Context` にし(Wails は `ctx` を第1引数に持つメソッドに渡す)、利用者は次の順で決める:
     `ctx` に利用者がある(自前のサーバの middleware が入れた)→ その利用者 / 無い(ウィンドウから。自前のサーバを通っていない)→ Owner
   - **ヘッダー(`x-wails-window-id`)や `application.WindowKey` で「ウィンドウからか」を判定しない**。ブラウザが偽れるため。自前のサーバの middleware は、利用者をいつも入れ(未ログインは Guest)、`x-wails-window-*` のヘッダーを消す
   - `registerAdmin` にあたる印(admin だけが呼べる)は、サービスか `api` の側で `api.RequireAdmin(ctx)` を通す。`api` の関数で `ctx` を受けていないもの(`ReorderBlenders(ids)` など)は、権限の判定を見直す
   - **今、admin の守りは REST の側にしか無い**(2026-10-19 に数えた):`registerAdmin` は 34。`api` の側で `requireAdmin` を通しているのは `KillRunningQueues`(`api/queue.go`)の1つだけ。
     `api.CreateUser`・`GenerateResetToken`・`SetServer`・`RegisterBlender`・`DeleteBlender` などは `ctx` も受けない。**このままサービスを出すと、未ログイン(Guest)のブラウザから管理の操作ができる**。
     REST のままでも先に `api` の側へ移せる(移すだけで守りが二重になる)ので、作り直しより前に行う
   - 今の REST に**出していない**サービスのメソッドも、ブラウザから呼べるようになる(2026-10-19 に照らし合わせた):
     `Environment.GetSystemLog`・`SetLogLevel`・`GetLogLevel(s)`・`OpenSystemLogWindow`、`Queue.OpenLogWindow`・`OpenMovieWindow`・`OpenMiniMonitor`・`CloseMiniMonitor`、`SysMon.Get` など。
     出してよいか、admin だけか、ブラウザからは断るかを1つずつ決める
2. **ウィンドウ・ダイアログを開くメソッド**は、ブラウザから呼ばれるとサーバの機械の画面で開く。ブラウザからは断る(例:`services/queue.go` のログのウィンドウ、`services/environment.go` の `application.Get()` を使う部分、`Blender.OpenFile`(Blender を GUI で起動する。REST では admin 限定))
3. **引数の形が変わる**:REST は JSON のオブジェクト(`{installID, fileID}`)、バインディングは位置引数。ラッパーは REST の形を捨て、バインディングの形にそろえる
4. **大きいデータ**:`/wails/runtime` は本文の大きさに上限がある(`maxRuntimeBodyBytes` = 64 MiB)。ファイルのアップロードは今の multipart の口のまま
5. **移行中は REST と並べられる**:`/api/...` を残したまま、サービスごとにラッパーをバインディングに切り替えられる(一度に全部を直さなくてよい)
6. **Wails の決まった API も、ブラウザから呼べる**(試作で確かめた)。ウィンドウの要らない呼び出し(`object` が 0 呼び出し・2 アプリ・3 イベント・8 システム)は、ウィンドウ無しでも通る。
   - `Application.Quit` でアプリが終わる。`Hide` / `Show` も通る。`Events.Emit` で、ウィンドウの画面に好きなイベント(例:`queue:changed`)を出せる
   - 自前のサーバで `POST /wails/runtime` の本文を読み、`object` が 0(呼び出し)と 10(取り消し)のときだけ通す。読んだ本文は `r.Body` に戻してから渡す
   - チャンクで分けた送り方(`x-wails-chunk-id` のヘッダー。WebView2 の上限のための仕組み)は、1つ目のかけらしか中身を見られないので、ブラウザからは断る
7. **`/wails/` は今ログイン無しで通る**(`api/rest/auth.go` の `isPublicPath`)。ダミーのための決まり。`/wails/runtime` はログイン必須にする(`/wails/runtime.js` は今のまま公開でよい)
8. **`/_movie` が2つある**:Wails の配信(`main.go` の `movieAwareHandler`)には、パスを確かめない `/_movie` が入っている。
   自前のサーバの `/_movie`(`api.ValidateWorkDirPath` で確かめる)を必ず先に当てる。assetHandler の鎖へ渡すパスは、決めたものだけにする
9. **自作の Transport に `WailsEventListener` を持たせない**(調べたこと)。持たせるとウィンドウにイベントが届かなくなる。ブラウザへのイベントは今の SSE のまま
10. **エラーの返し方が変わる**:Wails はエラーを 422(本文はテキストか JSON)で返す。今の `serverCall` の「401 ならページを読み直す」は、ラッパーの共通の受け口で作り直す
11. **画面の `@wailsio/runtime` の版がずれている**:`package.json` は `"latest"`、入っているのは beta.16。Go の側は beta.23。
    ブラウザから同じ通り道を使うので、Go の側と同じ版に固定する(`Window` / `Dialogs` を使う画面(`TitleBar.jsx` とダイアログの9ファイル)はブラウザでは断られるので、見た目の分かれ道として残す)

## 未決事項

- 画面で「ブラウザか」を判定する方法(見た目の分かれ道に使う):`__brender_server_mode` の差し込みを残す / Wails の側で分かる手段を探す
- 通り道を HTTP のまま(既定の `HTTPTransport`)にするか、公式の例のように WebSocket にするか。まず HTTP で試す
- `Environment.Server` が false のとき(サーバモードでない)の扱い:自作の Transport を使わず既定のままにするか、いつも自作の Transport にしてサーバだけ立てないか

## 実装した結果(2026-10-19)

下の「進め方」の 1〜7 を行った。

- admin の守りは api の関数の中に移した(34 件。`api/access_test.go` で creator・Guest が `ErrAccessDenied` になることを確かめる)
- 自作の Transport は `_cmd/brender/transport.go`、`/wails/runtime` の守りは `api/rest/runtime.go`(`api/rest/runtime_test.go`)
- ウィンドウかブラウザかは `api.WithBrowser` / `api.FromBrowser(ctx)` で見分ける。サムネイルはブラウザに URL、ウィンドウを開くメソッドはブラウザからは断る
- 画面の呼び出しは `@wailsio/runtime` の `setTransport()`(公式の差し替え口)で `/wails/runtime` に送る。401 で読み直す
- `routes.go` を消した。認証の口(login / logout / me / is_auth_enabled・パスワードの再設定)とアップロードは REST のまま
- `Environment.Server` が false のときは Transport を nil(Wails の既定)にする(未決事項の3つ目はこれに決めた)

実機で確かめたこと(ユーザー管理オン・別のホームで新しい DB):

- ブラウザでログインして、設定・キューの画面が開く。`/wails/runtime` が 200、SSE も届く、コンソールのエラー無し
- creator はユーザ作成・システムログで `access denied`、admin は通る。監査カラム(`created_by`)にログインした利用者が入る
- 未ログインは 401。ブラウザからの `Queue.OpenLogWindow` は `not available from browser`、`Application.Quit`・`Events.Emit` は 403
- ウィンドウの側は、通り道が既定の `HTTPTransport` を埋め込んでいるので変わらない(サーバモードでないときは Transport が nil で、前と同じ)。ユーザーが使って確かめた(2026-10-19)

実装した後で分かったこと・足したこと:

- サーバの起動の行がログファイルにしか出ず、`wails3 dev` のターミナルでは見えなかった。設定を変えても再起動まで何も出なかった。
  起動のたびにサーバモードのオン・オフ・待ち受けている URL・失敗の理由をログとターミナルの両方に出し、設定を変えたときに「再起動で反映」と出すようにした
- キューの強制終了(利用者の操作)が終了時用の `KillRunningQueues` を呼び、`shuttingDown` が立ったまま以後のジョブが閉じられなくなっていた(作り直しの前からの不具合)。
  `KillRunningQueuesByUser` を分けて直した(Skill `brender-render-pipeline`)
- 権限エラーは Wails が ERROR としてログに出す。ブラウザからの呼び出しは 1 回ごとの INFO が無い(Skill `brender-server-mode` の「エラーとログの出方」)
- ウィンドウを 1 つも作らなくても `app.Run()` が動き続ける。`TODO.md` の「ウィンドウを出さずに動かす」に使える

残り:

- 画面の `@wailsio/runtime` は beta.16 に固定した(`latest` をやめた)。Go の側の版(features では beta.26)にそろえるのは別に行う(依存の更新になるため)

## 進め方(案)

0. **試作**:自作の Transport を作り、ブラウザから1つのサービス(例:`Codes` の読むだけのメソッド)を呼ぶ。確かめること:
   - ✅ ブラウザで `/wails/runtime.js` が読めて、`/wails/runtime` が呼ばれる(curl で確かめた)
   - ⬜ ウィンドウの側が今までどおり動く(目では確かめていない。上の「実装した結果」)
   - ✅ 自前のサーバの middleware で入れた値が、メソッドの `ctx` に届く
   - ✅ 本物の画面をブラウザで開いて、生成されたバインディングで呼べる
1. **先に行う(REST のままでよい)**:admin の守り(`registerAdmin` の 34)を `api` の側へ移す(気をつけること 1)。作り直しをしなくても守りが二重になる
2. 自前のサーバの守りを作る:`/wails/runtime` をログイン必須にし、`object` を 0 と 10 に絞り、チャンクを断る。assetHandler へ渡すパスを決めたものだけにする(気をつけること 6〜8)
3. サービスのメソッドを `ctx` を受ける形にし、利用者の決め方(気をつけること 1)を1か所に作る
4. ブラウザから断るメソッドの印を作る(気をつけること 1 の「出していないメソッド」と 2)
5. 画面の `@wailsio/runtime` を Go の側と同じ版に固定し、エラーの受け口を作る(気をつけること 10・11)
6. サービスごとに、ラッパーの `isWails()` の分かれ道を消してバインディングに切り替える
7. REST のディスパッチ(`rest.go` / `routes.go`)と `/wails/` のダミーを消す。Skill `brender-server-mode`・`brender-access-control` と `AGENTS.md` を書き直す

## 見込める効果(2026-10-19 に数えた)

- なくなるもの:`api/rest/routes.go`(1613 行)、`api/rest/rest.go` のディスパッチ、ラッパーの `isWails()`(約 157 か所)、`/wails/` のダミー
- 残るもの:`api/rest/auth.go`(認証)・`sse.go`・アップロード・`/thumbnail`・`/_movie`。`server.go` は自作の Transport の `ServeAssets` に形を変えて残る
- ほかのやり方と比べて:Server Build は別の exe になるので使わない(決めたこと)。
  自前のリフレクションで REST を1つにまとめるやり方は `routes.go` を消せるが、画面の分かれ道は残る。Transport がいちばん多く減らせる

## 出典

- [wailsapp/wails v3.0.0-beta.23](https://github.com/wailsapp/wails/tree/v3.0.0-beta.23/v3):`v3/pkg/application/transport.go`・`transport_http.go`・`messageprocessor_call.go`・`application.go`・`application_options.go`、`v3/examples/websocket-transport`
- [Wails v3 Server Build](https://v3.wails.io/guides/server-build)(使わない方式。比べるために読んだ)
