---
name: brender-codes
description: >
  Brender のコード管理（code/ ディレクトリ）の仕組みと手順。ユーザがカスタマイズできる選択肢リスト
  （image_formats・video_formats・resolution_presets）を JSON で管理する仕組み、//go:embed による
  デフォルト値の埋め込み、~/.brender/code/ でのユーザ上書き、新カテゴリの追加手順
  （_assets JSON 作成 → code.go → _cmd/brender/services/codes.go → bindings 生成 → codes.js ラッパー）を扱う。
  code/ ディレクトリ・code.go・_cmd/brender/services/codes.go・src/lib/api/codes.js を変更するとき、
  出力フォーマットや解像度プリセットの選択肢を追加・変更するとき、
  新しいコードカテゴリを追加するときは必ずこのSkillを参照すること。
---

# Brender コード管理（`code/`）

ユーザがカスタマイズできる選択肢リストを JSON で管理する仕組み。

## ディレクトリ構成

```
code/
  _assets/              ← アプリバイナリに //go:embed で埋め込まれるデフォルト値
    image_formats.json
    video_formats.json
    resolution_presets.json
  code.go               ← 型定義 + ロード関数（package code）
```

## ユーザ編集ファイル

`~/.brender/code/{filename}.json` を置くと、そのカテゴリのデフォルトを上書きする。
ファイルが存在しないカテゴリはバイナリ埋め込みのデフォルトをそのまま使用。
→ バージョンアップで新カテゴリが追加されても、ユーザ側の対応不要。

## JSON スキーマ

全アイテムに共通フィールド `code`（カテゴリ内一意）と `label`（表示名）を持つ。

| ファイル | 追加フィールド | 用途 |
|---|---|---|
| `image_formats.json` | `ext` (string) | Blender の `-F` 引数に渡すフォーマット名 → 出力拡張子のマッピング |
| `video_formats.json` | `ext` (string) | ffmpeg の出力動画拡張子 |
| `resolution_presets.json` | `width`, `height` (int) | 解像度プリセット |

```jsonc
// image_formats.json の例
[
  { "code": "PNG",  "label": "PNG",  "ext": "png" },
  { "code": "JPEG", "label": "JPEG", "ext": "jpg" }
]
```

## Go API

```go
code.GetImageFormats()      // []code.ImageFormat
code.GetVideoFormats()      // []code.VideoFormat
code.GetResolutionPresets() // []code.ResolutionPreset
```

Wails サービス `_cmd/brender/services/Codes` 経由でフロントエンドに公開。

## フロントエンド

```js
import { CodesApi } from '../../lib/api'

CodesApi.getImageFormats()      // Promise<ImageFormat[]>
CodesApi.getVideoFormats()      // Promise<VideoFormat[]>
CodesApi.getResolutionPresets() // Promise<ResolutionPreset[]>
```

**利用箇所**:
- `BlenderSettings.jsx` — システムデフォルト出力フォーマット（`image_formats`）
- `WorkspacePanel.jsx` — ワークスペース出力フォーマット（`image_formats`）、解像度プリセット（`resolution_presets`）
- `VideoSettings.jsx` — ffmpeg 出力拡張子（`video_formats`）
- `JobPage.jsx` — 動画作成ダイアログの出力拡張子（`video_formats`）

## 新カテゴリの追加手順

1. `code/_assets/{name}.json` を作成（`code` / `label` + カテゴリ固有フィールド）
2. `code/code.go` に型と `Get{Name}()` 関数を追加
3. `_cmd/brender/services/codes.go` にメソッドを追加
4. `wails3 generate bindings` を実行（`_cmd/brender/` で実行）
5. `src/lib/api/codes.js` にラッパーを追加
