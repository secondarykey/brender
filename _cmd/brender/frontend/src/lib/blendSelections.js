// 何も無くなっていないとき
export const NO_SELECTION_WARNINGS = { missingScene: '', missingCamera: '', missingEngine: '', convertedEngine: null }

const ENGINE_KEYS = ['CYCLES', 'EEVEE', 'WORKBENCH']

// 保存してあるシーン・カメラ・エンジンが、.blend と Blender から読んだ一覧に今もあるかを確かめる。
// 無くなったものは空にして、何が無くなったかを返す（ファイル設定とワークスペース設定で同じ決まり）。
//   - シーンが無ければ、カメラも空にする（カメラはシーンごとに違うため）
//   - カメラは、保存してあったシーンにあるかで見る
//   - エンジンは名前だけ変わった場合（BLENDER_EEVEE → BLENDER_EEVEE_NEXT など）、同じ系統の候補が1つなら置き換える
//   - 一覧が空（まだ読めていない・読めなかった）の項目は確かめない
// 戻り値: { scene, camera, engine, missingScene, missingCamera, missingEngine, convertedEngine, warned }
export function checkSavedSelections({ scene, camera, engine }, { scenes = [], cameras = [], engines = [] }) {
  const out = { scene, camera, engine, ...NO_SELECTION_WARNINGS }

  if (scene && scenes.length > 0 && !scenes.includes(scene)) {
    out.missingScene = scene
    out.scene = ''
    out.camera = ''
  }

  if (camera && cameras.length > 0) {
    const inScene = scene ? cameras.filter(c => c.Scenes && c.Scenes.includes(scene)) : cameras
    if (!inScene.some(c => c.Name === camera)) {
      out.missingCamera = camera
      out.camera = ''
    }
  }

  if (engine && engines.length > 0 && !engines.includes(engine)) {
    const key = ENGINE_KEYS.find(k => engine.toUpperCase().includes(k))
    const candidates = key ? engines.filter(e => e.toUpperCase().includes(key)) : []
    if (candidates.length === 1) {
      out.convertedEngine = { from: engine, to: candidates[0] }
      out.engine = candidates[0]
    } else {
      out.missingEngine = engine
      out.engine = ''
    }
  }

  out.warned = !!(out.missingScene || out.missingCamera || out.missingEngine || out.convertedEngine)
  return out
}
