# TODO

brender でやりたいこと。詳しい資料があるものは `_docs/` にある。

状態: ⬜ 未着手 / 🔧 作業中 / ✅ 完了

| | やりたいこと | 資料 |
|---|---|---|
| ✅ | admin の守りを `api` の側へ移す:今は REST の `registerAdmin`(34)にしか無く、`api.CreateUser`・`SetServer` などは `ctx` も受けない。REST のままでも先にでき、Transport で作り直すときの前提になる(2026-10-19 に行った) | [server-transport.md](_docs/server-transport.md)(気をつけること 1) |
| ✅ | サーバモードを Wails の Transport で作り直す:自前の REST(`api/rest/` のディスパッチ)をやめ、Wails の `AssetServerTransport` で、同じ exe のままブラウザからも Wails のバインディングを呼ぶ(2026-10-19 に行った。ウィンドウの側も確かめた) | [server-transport.md](_docs/server-transport.md)(検討メモ・実装した結果) |
| ⬜ | 画面の `@wailsio/runtime` を Go の側の版にそろえる:今は beta.16 に固定(`latest` をやめた)。Go の側は features で beta.26。ブラウザも `/wails/runtime` を同じ形で使うので、版を上げたらブラウザからの呼び出しも確かめる(2026-10-19) | [server-transport.md](_docs/server-transport.md)(実装した結果の「残り」) |
| ⬜ | ウィンドウを出さずに動かす(バックグラウンド実行):デスクトップのビルドのまま、ウィンドウを作らずに起動し、ブラウザから使う(別の exe にはしない。2026-10-19)。今はメインのウィンドウを閉じるとアプリが終わる(`main.go`)ので、終わらせ方(トレイ・シグナルなど)も考える。`AGENTS.md` の「ヘッドレス運用は不可」はこれで変わる。Transport の試作では、ウィンドウを1つも作らずに `app.Run()` が動き続けた(Windows。2026-10-19) | 未作成 |
