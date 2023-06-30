# Brender

Blenderでレンダリングを非同期実行する為のプロジェクトです。

クライアントモードでは、自分のマシンでレンダリングしますが、
サーバモードでの接続を行うと別のマシンで簡単にレンダリングできるようになります。

## Caution

開発者はBlenderに関しては素人です。
こういうのがあった方が使いやすいということがあれば言ってください。


# Version

Blender 3.5.1

## UI

プロジェクト一覧
  ワークスペース一覧
    ジョブ一覧

## Project

Blenderファイルを準備

## プロジェクト内でどうするか？

ワークススペースを作成し、画像を保存しておく

プロジェクトを作成してWebでアップロード

## サーバを作るのと、分散するのを同居させる

特にローカル実行を行えるようにする
ローカル実行の場合、アップロードの手間が省ける
利用するサーバ選択するか？

# ファイルシステム

{BrenderRoot}/{ProjectID}/
  brender.db
  content/
    blender ファイルの置き場所
    アーカイブまたはサーバモード時

  thumbnail/

    project_thumb.jpg
    workspace_thumb_{workspaceId}.jpg

    -- 作成中
    project_thumb_########.png
    workspace_thumb_{workspaceId}_########.png

  workspace/
    {workspace_id}
      results/
        ########.png
  logs/
サムネ用
    project_thumb.log
    project_thumb.lock

    workspace_thumb_{workspaceId}.log
    workspace_thumb_{workspaceId}.lock

レンダリング用
    日付_{workspaceId}.log
    日付_{workspaceId}.lock

## コマンドの実行結果をWebに表示

# モジュール

- core : クライアント、サーバどちらでも利用する共通部分
- server : サーバモード(Web)
- client : クライアント実行部分(Wails)


# Brender API


React -> 

      Web   I/F

          Server API -> core

      Wails I/F

          Client API -> core
