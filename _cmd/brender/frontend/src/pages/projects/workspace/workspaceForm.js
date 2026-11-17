// ワークスペースの設定フォームの値の決まりごと（画面に依存しない部分）

// フレーム範囲・解像度は「0（と -1）= Blender のシーンの値」
export const isFrameDefault      = (start, end) => start === 0 && end === -1
export const isResolutionDefault = (x, y)       => x === 0 && y === 0

// FPS 欄: 空・0・読めない値は 0（= Blender のシーンの値）
export const parseFps  = v => { const n = parseFloat(v); return n > 0 ? n : 0 }
export const formatFps = n => String(Math.round(n * 100) / 100)

// EngineFlags 相当: エンジン名の揺れを吸収して Samples マップから値を返す
export function samplesForEngine(engine, samplesMap) {
  if (!engine || !samplesMap) return 0
  const e = engine.toUpperCase()
  if (e.includes('CYCLES'))    return samplesMap.CYCLES    ?? 0
  if (e.includes('EEVEE'))     return samplesMap.EEVEE     ?? 0
  if (e.includes('WORKBENCH')) return samplesMap.WORKBENCH ?? 0
  return 0
}

// サーバのワークスペースからフォームの値を作る
export function formFromWorkspace(ws) {
  return {
    name:             ws.name,
    blenderInstallID: ws.blender_install_id,
    scene:            ws.scene || '',
    camera:           ws.camera || '',
    engine:           ws.engine || '',
    startFrame:       ws.start ?? 0,
    endFrame:         ws.end   ?? -1,
    frameStep:        ws.frame_step || 1,
    fps:              ws.fps > 0 ? String(ws.fps) : '', // '' = Blender のシーンの値
    thread:           ws.thread || 0,
    samples:          ws.samples || 0,
    resolutionX:      ws.resolution_x || 0,
    resolutionY:      ws.resolution_y || 0,
    outputFormat:     ws.output_format || '',
    autoLock:         ws.auto_lock || false,
    autoLockMinSize:  ws.auto_lock_min_size || 100 * 1024 * 1024,
    autoLockKeep:     ws.auto_lock_keep || 1,
  }
}

// フォームの値から WorkspaceApi.update の引数を作る（名前は前後の空白を落とす）
export function updateParams(form, note) {
  return {
    name: form.name.trim(), note,
    blenderInstallID: form.blenderInstallID,
    scene: form.scene, camera: form.camera, engine: form.engine,
    startFrame: form.startFrame, endFrame: form.endFrame,
    frameStep: form.frameStep, fps: parseFps(form.fps), thread: form.thread,
    samples: form.samples,
    resolutionX: form.resolutionX, resolutionY: form.resolutionY,
    outputFormat: form.outputFormat,
    autoLock: form.autoLock,
    autoLockMinSize: form.autoLockMinSize,
    autoLockKeep: form.autoLockKeep,
  }
}
