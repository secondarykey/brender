import bpy

# 対象シーン名
scene = bpy.data.scenes["Scene"]
# 出力フォルダ（必要に応じて変更）
output_path = "C:/tmp/render_samples/"
# サンプル数リスト
sample_list = [2, 4, 8, 16, 32, 64, 128, 256, 512]

# レンダリングするフレーム番号
frame_number = 1
scene.frame_set(frame_number)

for s in sample_list:
    # サンプル数を設定
    scene.cycles.samples = s
    # 出力ファイル名を設定
    scene.render.filepath = f"{output_path}frame{frame_number}_samples{s}.png"
    # レンダリング実行
    bpy.ops.render.render(write_still=True)
    print(f"Rendered frame {frame_number} with {s} samples")
