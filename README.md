# Blender

Blenderでレンダリングをサーバサイドで実行する

# Version

Blender 3.5.1

## Settings

## UI

プロジェクト一覧

  ワークスペース一覧
  バージョン一覧

## Project

Blenderファイルを準備
フレームを設定（カメラを設定できるか）

## プロジェクト内でどうするか？

ワークススペースを作成し、画像を保存しておく 動画にしてあげる

プロジェクトを作成してWebでアップロード
ファイルのバージョンを日付にする
  ワークスーペースに作成バージョンとフレーム、カメラを設定

## サーバを作るのと、分散するのを同居させる

特にローカル実行を行えるようにする
ローカル実行の場合、アップロードの手間が省ける
利用するサーバ選択するか？



# コマンド

カメラ切り替えってできんのかな？
pythonで切り替える

アップロードされたファイルで１フレーム出す

projects/{ProjectID}/
  contents/

    blender ファイルの置き場所
    zip展開？

  thumbnails/
    project.png
    {workspace}.png

//変更した場合にどうするか？

  workspaces/
    {workspace_id}
      results/
        *.png
        render.mp4
      logs/
        日付.log
        実ログとパースした値を残す

実行するコマンド
  /Applications/Blender.app/Contents/MacOS/Blender -b 1685151874333534000.blend -f 10
  /Applications/Blender.app/Contents/MacOS/Blender -b 1685151874333534000.blend -a


## ログについての解析

## コマンドの実行結果をWebに表示

Jenkins


