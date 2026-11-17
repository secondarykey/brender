import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import FieldLabel from '../../../components/FieldLabel'
import { MdSwapHoriz } from 'react-icons/md'
import { isFrameDefault, isResolutionDefault, formatFps, samplesForEngine } from './workspaceForm'

// ── デフォルト値ヒント ────────────────────────────────────
function DefaultTag({ value }) {
  const { t } = useTranslation()
  if (!value) return null
  const label = `（${t('workspace.defaultValueLabel', { value })}）`
  return <span className="form-default-tag" title={label}>{label}</span>
}

// ワークスペースの設定フォームのうち「レンダリング設定」の折りたたみ欄
// （エンジン・サンプル数・スレッド・シーン・カメラ・解像度・フレーム範囲・FPS・出力形式）。
//   form, set, setForm … 親のフォームの値と書き換え
//   options            … useRenderOptions の戻り値（選択肢）
//   file               … ファイルの設定（{ scene, sceneFixed, camera, cameraFixed, engine, engineFixed }）。
//                        固定されている項目はワークスペースでは変えられない
//   warnings           … 保存してあった値が .blend に無くなった知らせ（lib/blendSelections）
//   clearWarnings      … (...keys) 選び直したときに知らせを消す
//   detailsRef         … 知らせがあるとき、親が折りたたみを開くのに使う
// 解像度・フレーム範囲の「指定する」は、開いたときの値から決める（ワークスペースを切り替えると作り直される）。
export default function RenderSettingsFields({ form, set, setForm, readOnly, options, file, warnings, clearWarnings, detailsRef, defaultOpen }) {
  const { t } = useTranslation()
  const { engines, enginesLoading, toolLoading, toolData, imageFormats, resolutionPresets, envOutputFormat, cpuCount } = options
  const [specifyResolution, setSpecifyResolution] = useState(() => !isResolutionDefault(form.resolutionX, form.resolutionY))
  const [specifyFrames, setSpecifyFrames]         = useState(() => !isFrameDefault(form.startFrame, form.endFrame))
  const lastFrameSpec      = useRef(null) // OFF 直前のフレーム値を退避
  const lastResolutionSpec = useRef(null) // OFF 直前の解像度を退避

  const activeScene        = toolData?.Scenes?.find(s => s.Active) || null
  const effectiveSceneName = form.scene || file.scene || activeScene?.Name || ''
  const sceneInfo          = toolData?.Scenes?.find(s => s.Name === effectiveSceneName) || activeScene
  const allCameras = toolData?.Cameras || []
  const scenes     = toolData?.Scenes?.map(s => s.Name) || []

  const handleSpecifyResolution = (checked) => {
    setSpecifyResolution(checked)
    if (!checked) {
      lastResolutionSpec.current = { resolutionX: form.resolutionX, resolutionY: form.resolutionY }
      setForm(prev => ({ ...prev, resolutionX: 0, resolutionY: 0 }))
    } else if (lastResolutionSpec.current) {
      setForm(prev => ({ ...prev, ...lastResolutionSpec.current }))
    } else {
      setForm(prev => ({ ...prev,
        resolutionX: sceneInfo?.X ?? 1920,
        resolutionY: sceneInfo?.Y ?? 1080,
      }))
    }
  }

  const handleSpecifyFrames = (checked) => {
    setSpecifyFrames(checked)
    if (!checked) {
      lastFrameSpec.current = { startFrame: form.startFrame, endFrame: form.endFrame, frameStep: form.frameStep }
      setForm(prev => ({ ...prev, startFrame: 0, endFrame: -1 }))
    } else if (lastFrameSpec.current) {
      setForm(prev => ({ ...prev, ...lastFrameSpec.current }))
    } else {
      setForm(prev => ({ ...prev,
        startFrame: sceneInfo?.Start ?? 1,
        endFrame:   sceneInfo?.End   ?? 1,
        frameStep:  1,
      }))
    }
  }

  const sceneDefault  = !file.sceneFixed && !form.scene ? (file.scene || activeScene?.Name || null) : null
  const cameraDefault = !file.cameraFixed && !form.camera && sceneInfo?.Camera ? sceneInfo.Camera : null
  const engineDefault = !form.engine ? (file.engine || sceneInfo?.Engine || null) : null
  const effectiveEngine = file.engineFixed && file.engine
    ? file.engine
    : (form.engine || file.engine || sceneInfo?.Engine || '')
  const samplesDefault = form.samples === 0
    ? samplesForEngine(effectiveEngine, sceneInfo?.Samples)
    : 0
  const resolutionDefault = !specifyResolution && sceneInfo?.X && sceneInfo?.Y
    ? `${sceneInfo.X} × ${sceneInfo.Y}`
    : null
  const frameDefault  = !specifyFrames && sceneInfo
    ? t('workspace.frameRangeDefault', { start: sceneInfo.Start, end: sceneInfo.End })
    : null
  const fpsDefault    = !form.fps && sceneInfo?.FPS > 0 ? formatFps(sceneInfo.FPS) : null
  const threadsHint   = cpuCount
    ? t('workspace.threadsHintWithMax', { count: cpuCount })
    : t('workspace.threadsHint')

  return (
      <details className="form-collapsible" ref={detailsRef} open={defaultOpen}>
        <summary>{t('workspace.renderSettings')}</summary>
        <div className="form-collapsible-body">
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <div className="form-field" style={{ flex: 2 }}>
          <FieldLabel text={t('workspace.renderEngine')} lockedValue={file.engineFixed ? (file.engine || sceneInfo?.Engine || t('common.notSet')) : null} defaultValue={engineDefault} />
          {file.engineFixed ? (
            <input className="form-input" value={file.engine || sceneInfo?.Engine || t('common.notSet')} disabled style={{ opacity: 0.5 }} />
          ) : engines.length > 0 ? (
            <select className="form-select" value={form.engine} onChange={e => { set('engine', e.target.value); clearWarnings('missingEngine', 'convertedEngine') }} disabled={enginesLoading || readOnly}>
              <option value="">{t('common.notSet')}</option>
              {engines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
            </select>
          ) : (
            <input className="form-input" value={form.engine} onChange={e => set('engine', e.target.value)} placeholder={t('workspace.enginePlaceholder')} disabled={readOnly} />
          )}
          {file.engineFixed && (
            <span className="form-hint">{t('workspace.engineLockedByFile')}</span>
          )}
          {warnings.missingEngine && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.engineMissing', { name: warnings.missingEngine })}</span>}
          {warnings.convertedEngine && <span className="form-hint" style={{ color: '#e0a030' }}>{t('workspace.engineConverted', { from: warnings.convertedEngine.from, to: warnings.convertedEngine.to })}</span>}
        </div>
        <div className="form-field" style={{ flex: '0 0 80px', minWidth: 0 }}>
          <label className="form-label">{t('workspace.samples')}</label>
          <input className="form-input" style={{ textAlign: 'right', width: '100%' }} type="number" min={0} value={form.samples} onChange={e => set('samples', Number(e.target.value))} disabled={readOnly} />
          {samplesDefault > 0 && (
            <span className="form-hint" style={{ whiteSpace: 'nowrap' }}>{t('workspace.samplesDefaultValue', { count: samplesDefault })}</span>
          )}
        </div>
        <div className="form-field" style={{ flex: '0 0 80px', minWidth: 0 }}>
          <label className="form-label">{t('workspace.threads')}</label>
          <input className="form-input" style={{ textAlign: 'right', width: '100%' }} type="number" min={0} value={form.thread} onChange={e => set('thread', Number(e.target.value))} disabled={readOnly} />
          <span className="form-hint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={threadsHint}>{threadsHint}</span>
        </div>
      </div>

      <div className="form-row" style={{ alignItems: 'flex-start', marginTop: -20 }}>
        <div className="form-field" style={{ flex: 1 }}>
          <FieldLabel text={t('workspace.scene')} lockedValue={file.sceneFixed ? (file.scene || activeScene?.Name || t('common.notSet')) : null} defaultValue={sceneDefault} />
          {file.sceneFixed ? (
            <input className="form-input" value={file.scene || activeScene?.Name || t('common.notSet')} disabled style={{ opacity: 0.5 }} />
          ) : scenes.length > 0 ? (
            <select className="form-select" value={form.scene} onChange={e => { set('scene', e.target.value); set('camera', ''); clearWarnings('missingScene', 'missingCamera') }} disabled={toolLoading || readOnly}>
              <option value="">{t('common.notSet')}</option>
              {scenes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input className="form-input" value={form.scene} onChange={e => set('scene', e.target.value)} placeholder={t('common.notSetPlaceholder')} disabled={readOnly} />
          )}
          {warnings.missingScene && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.sceneMissing', { name: warnings.missingScene })}</span>}
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <FieldLabel text={t('workspace.camera')} lockedValue={file.cameraFixed ? (file.camera || sceneInfo?.Camera || t('common.notSet')) : null} defaultValue={cameraDefault} />
          {file.cameraFixed ? (
            <input className="form-input" value={file.camera || sceneInfo?.Camera || t('common.notSet')} disabled style={{ opacity: 0.5 }} />
          ) : (
            <select
              className="form-select"
              value={form.camera}
              onChange={e => { set('camera', e.target.value); clearWarnings('missingCamera') }}
              disabled={toolLoading || readOnly}
            >
              <option value="">{t('common.notSet')}</option>
              {allCameras
                .filter(c => !form.scene || (c.Scenes && c.Scenes.includes(form.scene)))
                .map(c => <option key={c.Name} value={c.Name}>{c.Name}</option>)
              }
            </select>
          )}
          {warnings.missingCamera && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.cameraMissing', { name: warnings.missingCamera })}</span>}
        </div>
      </div>

      <div className="form-field">
        <label className="form-checkbox-label">
          <input type="checkbox" checked={specifyResolution} onChange={e => handleSpecifyResolution(e.target.checked)} disabled={readOnly} />
          {t('workspace.specifyResolution')}
          <DefaultTag value={resolutionDefault} />
        </label>
        {specifyResolution && (
          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-field">
              <label className="form-label">{t('workspace.resolutionPreset')}</label>
              <select
                className="form-select"
                value={resolutionPresets.find(p => p.width === form.resolutionX && p.height === form.resolutionY)?.code ?? ''}
                onChange={e => {
                  const p = resolutionPresets.find(p => p.code === e.target.value)
                  if (p) setForm(prev => ({ ...prev, resolutionX: p.width, resolutionY: p.height }))
                }}
                disabled={readOnly}
              >
                <option value="">—</option>
                {resolutionPresets.map(p => (
                  <option key={p.code} value={p.code}>{p.label} ({p.width}×{p.height})</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.resolutionX')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={1} value={form.resolutionX} onChange={e => set('resolutionX', Number(e.target.value))} disabled={readOnly} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                title={t('workspace.swapResolution')}
                onClick={() => setForm(prev => ({ ...prev, resolutionX: prev.resolutionY, resolutionY: prev.resolutionX }))}
                disabled={readOnly}
              >
                <MdSwapHoriz />
              </button>
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.resolutionY')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={1} value={form.resolutionY} onChange={e => set('resolutionY', Number(e.target.value))} disabled={readOnly} />
            </div>
          </div>
        )}
      </div>

      <div className="form-field">
        <label className="form-checkbox-label">
          <input type="checkbox" checked={specifyFrames} onChange={e => handleSpecifyFrames(e.target.checked)} disabled={readOnly} />
          {t('workspace.specifyFrameRange')}
          <DefaultTag value={frameDefault} />
        </label>
        {specifyFrames && (
          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-field">
              <label className="form-label">{t('workspace.startFrame')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={0} value={form.startFrame} onChange={e => set('startFrame', Number(e.target.value))} disabled={readOnly} />
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.endFrame')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={0} value={form.endFrame} onChange={e => set('endFrame', Number(e.target.value))} disabled={readOnly} />
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.frameStep')}</label>
              <input className="form-input" style={{ width: 80, textAlign: 'right' }} type="number" min={1} value={form.frameStep} onChange={e => set('frameStep', Number(e.target.value))} disabled={readOnly} />
              <span className="form-hint">{t('workspace.frameStepHint')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-field">
        <FieldLabel text={t('workspace.fps')} defaultValue={fpsDefault} />
        <input
          className="form-input" style={{ width: 100, textAlign: 'right' }}
          type="number" min={0} step="any" value={form.fps}
          onChange={e => set('fps', e.target.value)} disabled={readOnly}
        />
      </div>

      <div className="form-field">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>{t('workspace.outputFormat')}</label>
          {form.outputFormat === '' && (
            <DefaultTag value={imageFormats.find(f => f.code === (envOutputFormat || 'PNG'))?.label ?? (envOutputFormat || 'PNG')} />
          )}
        </div>
        <select className="form-select" style={{ width: 200 }} value={form.outputFormat} onChange={e => set('outputFormat', e.target.value)} disabled={readOnly}>
          <option value="">{t('common.notSet')}</option>
          {imageFormats.map(f => (
            <option key={f.code} value={f.code}>{f.label}</option>
          ))}
        </select>
      </div>
        </div>
      </details>
  )
}
