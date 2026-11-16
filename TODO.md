# TODO

brender でやりたいこと。詳しい資料があるものは `_docs/` にある。

状態: ⬜ 未着手 / 🔧 作業中 / ✅ 完了

| | やりたいこと | 資料 |
|---|---|---|
| ✅ | admin の守りを `api` の側へ移す:今は REST の `registerAdmin`(34)にしか無く、`api.CreateUser`・`SetServer` などは `ctx` も受けない。REST のままでも先にでき、Transport で作り直すときの前提になる(2026-10-19 に行った) | [server-transport.md](_docs/server-transport.md)(気をつけること 1) |
| ✅ | サーバモードを Wails の Transport で作り直す:自前の REST(`api/rest/` のディスパッチ)をやめ、Wails の `AssetServerTransport` で、同じ exe のままブラウザからも Wails のバインディングを呼ぶ(2026-10-19 に行った。ウィンドウの側も確かめた) | [server-transport.md](_docs/server-transport.md)(検討メモ・実装した結果) |
| ⬜ | ウィンドウを出さずに動かす(バックグラウンド実行):デスクトップのビルドのまま、ウィンドウを作らずに起動し、ブラウザから使う(別の exe にはしない。2026-10-19)。今はメインのウィンドウを閉じるとアプリが終わる(`main.go`)ので、終わらせ方(トレイ・シグナルなど)も考える。`AGENTS.md` の「ヘッドレス運用は不可」はこれで変わる。Transport の試作では、ウィンドウを1つも作らずに `app.Run()` が動き続けた(Windows。2026-10-19) | 未作成 |
| ⬜ | ファイルのレンダリング設定を全シーンに当てる(案・未決定):ファイル単位でフレーム範囲・解像度などのレンダリング設定を持ち、レンダリングのとき .blend の全シーンへ当てる。Blender ではシーンごとに設定が分かれ、シーンを複製したあとは連動しないため(2026-11-16)。Blender 側(ドライバー・スクリプト)で揃えるか、brender で持つかはまだ決めていない。今ファイルに固定できるのは Blender・シーン・カメラ・エンジンだけ(`api/queue.go` の `fileOverrides`)で、フレーム範囲はワークスペースの指定か、無ければシーンの値になる | 未作成 |
| ⬜ | ブラウザから呼べるのに権限を見ないメソッドを塞ぐ:api の関数が `ctx` を受けず、守りを通らないものが残っている(2026-11-16 の見直し)。`Project.RemoveFile`(`api.RemoveProjectFile`)は他人のファイルの登録を消せる。`Project.SetProjectThumbnail`・`SetFileThumbnail`・`SetProjectThumbnailFromFile` は権限なしで書き換えられ、`imagePath` を確かめないのでサーバ上の任意の画像を base64 で受け取れる。`Project.ListAllFiles`・`Queue.List`・`ListJobs`・`Get`・`ListByWorkspace`・`PreviewRender`・`GetCleanableJobStats`・`MeasureFilteredDiskSize` は権限で絞らずに返す(`Queue.List`・`ListJobs`・`Get`・`ListByWorkspace` はフロントが使っていないので消してよい)。`Blender.GetScenes`・`GetToolData`・`GetCameras` は任意のファイルで Blender を起動できる。`GetImageBase64` は作業ディレクトリの中ならどのプロジェクトの画像も読める。直したあとの歯止めに、全サービスのメソッドを reflect で並べて「ctx を api へ渡すか、許可リストにある」を確かめるテストを置く | Skill `brender-access-control` |
| ⬜ | 作業ディレクトリの移動でデータが消えないようにする:`StartChangeWorkDir` は `migrateProjectFiles` のエラーを見ずに旧パスを `os.RemoveAll` するので、コピーが途中で失敗すると元データが消える。`copyFile` は `out.Close()` のエラーを捨てる。移動中に動いているレンダリングを確かめずロックもしないので、書き込み中の旧パスを消し得る。`StartMigrateProjectWorkDir` も同じで、同じプロジェクトの移動を2つ同時に走らせられる(2026-11-16 の見直し) | 未作成 |
| ⬜ | キューの起動を1か所にまとめる:「空きがあれば起動」が `EnqueueWithPreview`・`SamplesComparisonEnqueue`・`startNextWaiting` の3か所にあり、中身が違う。待ちの先頭が lock 中の WorkDir のジョブだと後ろも全部止まる。`SetMaxConcurrentJobs` で上限を上げても、lock を外しても待ちが起動しない(起動するのはジョブの終了か新しい投入のときだけ)。新しい投入は FIFO を無視して待ちを追い越す。入口を1つ(`schedule()` など)にして、投入・終了・設定変更・lock 解除から呼ぶ。下の `api/queue.go` の分割と一緒にやるとよい(2026-11-16 の見直し) | Skill `brender-render-pipeline` |
| ⬜ | `api/queue.go`(約 2000 行)を分ける:キューの投入・実行・リカバリ、ジョブの CRUD、ファイル操作(zip・削除・ログ)、画像の base64、容量の集計が1つに入っている。`queue`・`job`・`jobfiles`・`scheduler` などに分ける(2026-11-16 の見直し) | 未作成 |
| ⬜ | 監査カラムのユーザを ctx で渡す:`model` の関数は ctx を受けず(`WithContext` が無い)、`CreatedBy`・`UpdatedBy` は `runtime.Stack` から取った goroutine ID で引いている(`model/user.go` の `goroutineID`)。api の中で `go func()` すると owner に戻るなど壊れやすい。model へ ctx を通す(変更は広い。2026-11-16 の見直し) | 未作成 |
| ⬜ | 終わるときの後始末をウィンドウから外す:`KillRunningQueues`・`model.Close` はメインのウィンドウの `WindowClosing` のフックにしか無く、macOS の Cmd+Q や OS のシャットダウンなど、ほかの終わり方では走らない。`app.OnShutdown` の側へ移す。サーバモードでウィンドウを閉じると全員のレンダリングが止まる点は、上の「ウィンドウを出さずに動かす」と一緒に考える(2026-11-16 の見直し) | 未作成 |
| ⬜ | 細かい直し:`model.Init` の `AutoMigrate` のエラーを全部捨てている。サムネイルの base64 と URL の出し分けがサービスと api に重なっている。フロントの大きなページ(`WorkspacePanel.jsx` 約 1150 行・useState 50 個、`JobPage.jsx`・`FileDetailPage.jsx` も約 1000 行)を分ける(2026-11-16 の見直し) | 未作成 |
