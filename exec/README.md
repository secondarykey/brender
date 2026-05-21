# core/exec

Blender実行のパッケージです。
主にレンダリング用に利用します。

https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html

レンダリング時に出力ファイルを管理しますが、
プロセスIDやログファイルも同時に管理し、重複実行や状況確認を行うことが可能です。

# 起動順序

- コマンドでの "-b" 指定
- "BRENDER_BLENDER"環境変数での指定
- blenderコマンド（blenderをPATHに通す）

になります。
毎回"-b"指定するのがメンドウな場合は、指定してください。

## exec.RunVersion()

コマンドを実行して、バージョンを取得します。
このコマンドが正常じゃない場合、それはブレンダーの実行ファイルではありません。

# Blenderコマンド

-b : 対象のブレンダーファイルを渡します。
-o : 出力位置を渡します。
-t : スレッド数を指定します。基本的に0です。
-S : シーン指定がある場合はそのシーンをレンダリングします。
-F : ファイルのフォーマットです。"PNG"を固定で渡します。

-f : フレームを指定する場合に利用します。(サムネイル時　)

-s ,-e : 範囲指定がある場合に開始フレーム、終了フレームを設定
-a : フレーム範囲がある場合、アニメーションを指定します。

コマンド自体にログ指定ができますが、
基本的に外部コマンドを実行するWriterで処理を行います。

# "-E help" レンダリングエンジン

Blender 4.0.1 (hash d0dd92834a08 built 2023-11-17 00:36:52)
........
Blender Engine Listing: (Separator)
        BLENDER_EEVEE
        BLENDER_WORKBENCH
        CYCLES

# ProcessingWriter

端末に出力する為と、処理状況を確認する為と別個にする

-> 端末を設定していると、出力処理まで行う


Level
ALL -> すべて
Frame -> フレームの進捗を表示
Result -> 出力結果のみを出力

Frame時
Start             : 
Total             : 00:00:00 
Frame Average     : 00:00:00
Expected end time : -  (... )
Latest Saved      : 'C:\tmp\0049.png' 00:15.65 
Now Frame         : 49

以下２行で出力
Mem:557.86M (Peak 716.07M) | Time:00:13.21 | Remaining:00:00.26 | Mem:774.75M, Peak:774.75M
Scene, ViewLayer | Sample 496/512

## シーンを複数設定した場合の予測について

# Pythonの実行

ファイルを開いてPython実行を行うことで、シーン一覧などを取得可能な為、
どこかのタイミングで実行を行う

Pythonファイルはembedファイルからtempに作成され、実行される。

試した限りだと、レンダリングはその後に処理される為、同時実行は不可能っぽい

