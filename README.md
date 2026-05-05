# Brender

brender コマンド

Blenderファイルを管理しながら、レンダリングを非同期実行するシステムです。
端末のみでの実行ですが、サーバ実行を可能にして別端末で実行できるようにする予定です。

サーバモードではレンダリングを他の端末(サーバ)で実行することを可能にします。
サーバモードでも利用方法は一緒になりますが、
管理するBlenderファイルは相対パスで管理することになっており、
ZIPファイルでアップロードして利用するような実行方式になります。

## Caution

開発者はBlenderに関しては素人です。
こういうのがあった方が使いやすいということがあれば言ってください。

# Install

> brender

サーバモードで起動する場合でも
前持ってクライアントモードでデータベースを準備(Blenderの指定や認証モード)しておく必要があります。

レンダリングを非同期するだけであれば、toolコマンドを準備していますのでそちらだけでこと足りるかもしれません。

# Structure

## System

サーバモードの切り替えなどが可能です。
Blenderもバージョン別に管理できます。

## Project

Blenderファイルを指定します。
ただしサーバモードの場合はZIPファイルを指定して、
その中からblendファイルを指定することになります。

## 

## プロジェクト内でどうするか？


## サーバを作るのと、分散するのを同居させる

特にローカル実行を行えるようにする
ローカル実行の場合、アップロードの手間が省ける
利用するサーバ選択するか？

# ファイルシステム

{BrenderRoot}/

  brender.db

  {ProjectID}/

    content/
      アーカイブまたはサーバモード時にコンテンツ自体を保存します。

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

# 共通化までの道のり 

    server/exec
    server/model

    をcoreに移動する

    core/api にAPIを準備

    handlerからAPIを呼び出すように変更

    frontendに呼び出し口のAPIを準備(Proxyパターン)

    wails側にAPIのパターンを準備

    API.call() -> proxy.callAPI() -> HTTP もしくは wailsのパッケージ
    戻り値を共通化

