# brender-tool

Blenderを非同期実行する。
実行する際に、処理終了時間を計測して、現在のフレーム数などを出力する

-log でファイルを指定するとBlenderコマンドと同等のログも出力可能
-json 指定ファイルにJSONで処理結果を出力。都度更新する。この時標準出力を伴わない。

## Arguments

brender-tool xxxx.blend

ファイル指定を行う

"-b" "Blender Command" 環境変数 "BRENDER_BLENDER" を指定しておけば、指定の必要なし

ファイル指定の必要なしの引数
"-engines" "Engines(Blender)" 指定したBlenderで利用できるエンジンの一覧を表示


"-scenes" "Scenes(Blender File)"

"-s" "Start Frame"
"-e" "End Frame"
"-S" "Scene" シーン指定
"-E" "Engine" エンジン指定
"-w" "WorkBench Mode" ワークベンチ指定で動作

"-o" "Output Directory"

"-log" "log file"
"-json" "json file"
## エラーコードについて

4.5.4 でblender -b -E help