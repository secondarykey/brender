# サーバモードを Wails の Transport で作り直す(検討メモ)

- 状態: 検討中(試作の前。下の「進め方」の 0 で、見込みどおり動くかを確かめてから仕様にする)
- 書いた日: 2026-10-19(aibow の相談の中で調べた。Chat が書いた)
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
  なので、**既定の `HTTPTransport` を中に持つ Transport なら、ブラウザからの `POST /wails/runtime` も同じ鎖で処理される**(見込み。試作で確かめる)
- バインディングのメソッドに渡る `ctx` は、HTTP のリクエストの `r.Context()` から作られる(`transport_http.go` → `HandleRuntimeCallWithIDs`)。
  `context.WithoutCancel` で包むので**値は引き継がれる**。手前の middleware が `model.WithUser(ctx)` で入れた利用者を、メソッドの中で読める
- ウィンドウの無い呼び出しも想定されている(`messageprocessor_call.go` に「Calls may originate from windowless transports」とある)。ウィンドウがあるときだけ `ctx` に `application.WindowKey` が入る
- **ウィンドウの見分けはヘッダー**(`x-wails-window-id` / `x-wails-window-name`)。ブラウザも偽って送れる
- 公式の例 `v3/examples/websocket-transport`:デスクトップのウィンドウを出しながら、`:9099` でブラウザにも画面とバインディングを出している(通り道は WebSocket)。同じプロセスで両方を出す形の手本
- 参考(使わないもの):Server Build では、イベント用の WebSocket(`/wails/events`)は `AssetOptions.Middleware` を通らず(ログインしていなくてもつなげる)、送り先を1人に絞る手段も無い。
  デスクトップのビルドには、ブラウザにイベントを送る仕組み自体が無い

## 形(案)

```
ウィンドウ(WebView) ──wails://──→ assetHandler の鎖 ──→ バインディング(ctx に利用者なし → Owner)
                                       ↑
ブラウザ ──HTTP──→ 自前の http.Server
                    ├ authMiddleware(Cookie → model.WithUser。未ログインは Guest。ヘッダー x-wails-window-* は消す)
                    ├ /events(SSE。今のまま)・アップロード・/thumbnail・/_movie・ログインの口(今のまま)
                    └ その他 → assetHandler の鎖 ──→ バインディング(ctx に利用者あり)
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
2. **ウィンドウ・ダイアログを開くメソッド**は、ブラウザから呼ばれるとサーバの機械の画面で開く。ブラウザからは断る(例:`services/queue.go` のログのウィンドウ、`services/environment.go` の `application.Get()` を使う部分、`Blender.OpenFile`(Blender を GUI で起動する。REST では admin 限定))
3. **引数の形が変わる**:REST は JSON のオブジェクト(`{installID, fileID}`)、バインディングは位置引数。ラッパーは REST の形を捨て、バインディングの形にそろえる
4. **大きいデータ**:`/wails/runtime` は本文の大きさに上限がある(`maxRuntimeBodyBytes`。値は未確認)。ファイルのアップロードは今の multipart の口のまま
5. **移行中は REST と並べられる**:`/api/...` を残したまま、サービスごとにラッパーをバインディングに切り替えられる(一度に全部を直さなくてよい)

## 未決事項

- 画面で「ブラウザか」を判定する方法(見た目の分かれ道に使う):`__brender_server_mode` の差し込みを残す / Wails の側で分かる手段を探す
- 通り道を HTTP のまま(既定の `HTTPTransport`)にするか、公式の例のように WebSocket にするか。まず HTTP で試す
- `Environment.Server` が false のとき(サーバモードでない)の扱い:自作の Transport を使わず既定のままにするか、いつも自作の Transport にしてサーバだけ立てないか

## 進め方(案)

0. **試作**:自作の Transport を作り、ブラウザから1つのサービス(例:`Codes` の読むだけのメソッド)を呼ぶ。確かめること:
   - ブラウザで `/wails/runtime.js` が読めて、`/wails/runtime` が呼ばれる
   - ウィンドウの側が今までどおり動く
   - 自前のサーバの middleware で入れた値が、メソッドの `ctx` に届く
1. サービスのメソッドを `ctx` を受ける形にし、利用者の決め方(気をつけること 1)を1か所に作る
2. ブラウザから断るメソッドの印を作る(気をつけること 2)
3. サービスごとに、ラッパーの `isWails()` の分かれ道を消してバインディングに切り替える
4. REST のディスパッチ(`rest.go` / `routes.go`)と `/wails/` のダミーを消す。Skill `brender-server-mode`・`brender-access-control` と `AGENTS.md` を書き直す

## 出典

- [wailsapp/wails v3.0.0-beta.23](https://github.com/wailsapp/wails/tree/v3.0.0-beta.23/v3):`v3/pkg/application/transport.go`・`transport_http.go`・`messageprocessor_call.go`・`application.go`・`application_options.go`、`v3/examples/websocket-transport`
- [Wails v3 Server Build](https://v3.wails.io/guides/server-build)(使わない方式。比べるために読んだ)
