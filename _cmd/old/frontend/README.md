# installation

```
$ npm install --save-dev glob
$ npm install --save-dev webpack webpack-cli webpack-dev-server
$ npm install --save-dev @babel/core @babel/preset-env @babel/preset-react
$ npm install --save-dev react react-dom
```

# structure

- frontend
    - public
        - js
        - index.html
    - src
        - App.js
    - webpack.config.js


# client server

```
$ npm start
```

http://localhost:3000/

# issue

- サーバとクライアント
  クライアントはwails

- プロジェクト一覧
  -> プロジェクト作成
     ローカル実行を可能にする為、ファイルパスの設定を考える -> wails


- プロジェクト表示

  -> プロジェクト編集
     -> サムネイル作成
        実行時にエラーがあった場合に警告を出しておく

  -> ワークスペース作成
  -> ワークスペース一覧

  追加時に一覧反映　

- ワークスペース表示

  -> 実行
    実行一覧
    -> クリア
    -> 現在の実行状況

  -> 結果一覧
    フレーム数を変更しても、既存は残す仕様にしている為、無駄なものを消す


