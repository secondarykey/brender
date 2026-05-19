import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, BlenderApi, QueueApi, ProjectApi, WorkDirApi, CodesApi, EnvironmentApi } from '../../lib/api'
import { useToast, useMessage } from '../../lib/toast'
import { onAppEvent } from '../../lib/appEvents'
import Pagination from '../../components/Pagination'
import Dialog from '../../components/Dialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import HoldButton from '../../components/HoldButton'
import Breadcrumb from '../../components/Breadcrumb'
import NoteSection from '../../components/NoteSection'


const isFrameDefault      = (start, end) => start === 0 && end === -1
const isResolutionDefault = (x, y)       => x === 0 && y === 0

// EngineFlags 相当: エンジン名の揺れを吸収して Samples マップから値を返す
function samplesForEngine(engine, samplesMap) {
  if (!engine || !samplesMap) return 0
  const e = engine.toUpperCase()
  if (e.includes('CYCLES'))    return samplesMap.CYCLES    ?? 0
  if (e.includes('EEVEE'))     return samplesMap.EEVEE     ?? 0
  if (e.includes('WORKBENCH')) return samplesMap.WORKBENCH ?? 0
  return 0
}

const HISTORY_PAGE_SIZE = 5

const IMAGE_FILTER = [{ DisplayName: 'Image', Pattern: '*.jpg;*.jpeg;*.png;*.bmp;*.webp' }]

// ── ワークスペースサムネイル ───────────────────────────────
function WorkspaceThumbnailPanel({ projectID, fileID, workspaceID }) {
  const { t } = useTranslation()
  const [src, setSrc]             = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!fileID) return
    WorkspaceApi.getThumbnail({ projectID, fileID, workspaceID })
      .then(data => setSrc(data || null))
      .catch(() => setSrc(null))
  }, [projectID, fileID, workspaceID])

  const handleClick = async () => {
    if (uploading || !fileID) return
    try {
      const path = await Dialogs.OpenFile({ Filters: IMAGE_FILTER })
      if (!path) return
      setUploading(true)
      const data = await WorkspaceApi.setThumbnail({ projectID, fileID, workspaceID, imagePath: path })
      setSrc(data || null)
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="thumbnail-panel">
      <h3 className="ws-detail-section-title">{t('workspace.thumbnail')}</h3>
      <div className="thumbnail-clickable" onClick={handleClick} title={t('workspace.clickToChangeThumbnail')}>
        {src
          ? <img className="thumbnail-img" src={src} alt="thumbnail" />
          : <div className="thumbnail-placeholder">No Image</div>
        }
      </div>
    </div>
  )
}

// ── 履歴タブ ──────────────────────────────────────────────
function HistoryTab({ projectID, workspaceID, navigate, projectName, fileName, fileID, workspaceName, reloadTrigger }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [jobs, setJobs]         = useState([])
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE)
  const [bulkOpen, setBulkOpen]     = useState(false)
  const [keepCount, setKeepCount]   = useState(5)
  const [dataOnly, setDataOnly]     = useState(false)
  const [errorOnly, setErrorOnly]   = useState(false)
  const [bulkBusy, setBulkBusy]     = useState(false)
  const [bulkError, setBulkError]   = useState('')

  const load = useCallback(() => {
    QueueApi.listJobsByWorkspace({ projectID, workspaceID })
      .then(list => setJobs(list || []))
      .catch(() => {})
  }, [projectID, workspaceID])

  useEffect(() => { load() }, [load, reloadTrigger])

  useEffect(() => onAppEvent('queue:changed', load), [load])

  const statusLabel = (s) => t(`status.${s || 'running'}`)

  const totalPages  = Math.max(1, Math.ceil(jobs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openJob = (j) => {
    navigate('job', {
      job: j,
      initialTab: 'render',
      backPage: 'workspace',
      backParams: { projectID, projectName, fileID, fileName, workspaceID, workspaceName },
    })
  }

  const handleBulkDelete = async () => {
    setBulkBusy(true)
    setBulkError('')
    try {
      const count = await QueueApi.bulkDeleteJobsByWorkspace({ projectID, workspaceID, keepCount: keepCount >= 0 ? keepCount : 0, dataOnly, errorOnly })
      setBulkOpen(false)
      load()
      showToast(t('job.bulkDeleteResult', { count }))
    } catch (e) {
      setBulkError(String(e))
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, marginTop: -30 }}>
        <button className="btn btn-outline btn-sm" onClick={() => { setBulkError(''); setBulkOpen(true) }}>
          {t('job.bulkDelete')}
        </button>
      </div>

      {jobs.length === 0
        ? <p className="empty-msg">{t('workspace.noHistory')}</p>
        : (
          <>
            <div className="queue-history-list">
              {pageJobs.map(j => (
                <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => openJob(j)}>
                  <div className="queue-history-top">
                    <div className="queue-history-detail" style={{ marginTop: 0 }}>
                      <span>{j.start_frame}–{j.end_frame}f</span>
                      {j.engine  && <span>{j.engine}</span>}
                      {j.scene   && <span>{j.scene}</span>}
                      {j.camera  && <span>{j.camera}</span>}
                      {j.samples > 0 && <span>{j.samples}smp</span>}
                      {(j.resolution_x > 0 && j.resolution_y > 0) && <span>{j.resolution_x}×{j.resolution_y}</span>}
                      {j.enqueued_at && (
                        <span>{new Date(j.enqueued_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                    <span className={`status-badge status-${j.status || 'running'}`}>{statusLabel(j.status)}</span>
                  </div>
                  {j.status === 'error' && j.error_msg && (
                    <div className="queue-history-error">
                      {j.error_msg.slice(0, 80)}{j.error_msg.length > 80 ? '...' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Pagination page={currentPage} totalPages={totalPages} onChange={p => setPage(p)} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={jobs.length} />
          </>
        )
      }

      <Dialog
        open={bulkOpen}
        title={t('job.bulkDeleteTitle')}
        onClose={() => setBulkOpen(false)}
        closeOnBackdrop={!bulkBusy}
        message={bulkError}
        messageSeverity="error"
        actions={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-ghost" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
              {t('common.cancel')}
            </button>
            <HoldButton
              onClick={handleBulkDelete}
              disabled={bulkBusy}
              className="btn btn-danger"
              helpText={t('common.holdToConfirm')}
            >
              {bulkBusy ? t('common.deleting') : t('common.delete')}
            </HoldButton>
          </div>
        }
      >
        <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
          {t('job.bulkDeleteDesc')}
        </p>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label className="form-label">{t('job.keepCount')}</label>
          <input
            type="number"
            min="0"
            value={keepCount}
            onChange={e => setKeepCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="form-input"
            style={{ width: 100, opacity: errorOnly ? 0.4 : 1 }}
            disabled={bulkBusy || errorOnly}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: (bulkBusy || errorOnly) ? 'not-allowed' : 'pointer', fontSize: '0.9rem', marginBottom: 8, opacity: errorOnly ? 0.4 : 1 }}>
          <input
            type="checkbox"
            checked={dataOnly}
            onChange={e => setDataOnly(e.target.checked)}
            disabled={bulkBusy || errorOnly}
          />
          {t('job.bulkDeleteDataOnly')}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: bulkBusy ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={errorOnly}
            onChange={e => { setErrorOnly(e.target.checked); if (e.target.checked) setDataOnly(false) }}
            disabled={bulkBusy}
          />
          {t('job.bulkDeleteErrorOnly')}
        </label>
      </Dialog>
    </>
  )
}

// ── デフォルト値ヒント ────────────────────────────────────
function DefaultTag({ value, t }) {
  if (!value) return null
  const label = `（${t('workspace.defaultValueLabel', { value })}）`
  return <span className="form-default-tag" title={label}>{label}</span>
}

// ── 設定タブ ──────────────────────────────────────────────
function SettingsTab({ projectID, projectName, fileID, fileName, workspaceID, detail, focusName, onUpdated, onDeleted, onTestEnqueued, onRenderEnqueued, workDirLocked, navigate, wsStale }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [blenders, setBlenders]             = useState([])
  const [engines, setEngines]               = useState([])
  const [enginesLoading, setEnginesLoading] = useState(false)
  const [toolData, setToolData]             = useState(null)
  const [toolLoading, setToolLoading]       = useState(false)
  const [cpuCount, setCpuCount]             = useState(null)
  const [form, setForm]                     = useState(null)
  const [note, setNote]                     = useState('')
  const [specifyResolution, setSpecifyResolution] = useState(false)
  const [specifyFrames, setSpecifyFrames]         = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [copying, setCopying]               = useState(false)
  const [copyConfirm, setCopyConfirm]       = useState(false)
  const [error, setError]                   = useState('')
  const [confirm, setConfirm]               = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [forceDel, setForceDel]             = useState(false)
  const [testEnqueueing, setTestEnqueueing] = useState(false)
  const [testEnqueued, setTestEnqueued]     = useState(false)
  const [renderConfirm, setRenderConfirm]   = useState(null)
  const [renderEnqueuing, setRenderEnqueuing] = useState(false)
  const [resolvingRender, setResolvingRender] = useState(false)
  const [samplesDialogOpen, setSamplesDialogOpen] = useState(false)
  const [samplesListText, setSamplesListText]     = useState('2,4,8,16,32,64,128,256,512')
  const [samplesFrame, setSamplesFrame]           = useState(() => {
    const s = detail.workspace.start ?? 0
    const e = detail.workspace.end ?? 0
    return Math.floor((s + e) / 2)
  })
  const [samplesEnqueuing, setSamplesEnqueuing]   = useState(false)
  const [imageFormats, setImageFormats]         = useState([])
  const [resolutionPresets, setResolutionPresets] = useState([])
  const [envOutputFormat, setEnvOutputFormat]   = useState('')
  const nameRef      = useRef(null)
  const hasFocused   = useRef(false)
  const lastFrameSpec      = useRef(null) // OFF 直前のフレーム値を退避
  const lastResolutionSpec = useRef(null) // OFF 直前の解像度を退避
  const savedForm    = useRef(null)
  const savedNote    = useRef('')

  useEffect(() => {
    const start = detail.workspace.start ?? 0
    const end   = detail.workspace.end   ?? -1
    const next = {
      name:             detail.workspace.name,
      blenderInstallID: detail.workspace.blender_install_id,
      scene:            detail.workspace.scene || '',
      camera:           detail.workspace.camera || '',
      engine:           detail.workspace.engine || '',
      startFrame:       start,
      endFrame:         end,
      frameStep:        detail.workspace.frame_step || 1,
      thread:           detail.workspace.thread || 0,
      samples:          detail.workspace.samples || 0,
      resolutionX:      detail.workspace.resolution_x || 0,
      resolutionY:      detail.workspace.resolution_y || 0,
      outputFormat:     detail.workspace.output_format || '',
      autoLock:         detail.workspace.auto_lock || false,
      autoLockMinSize:  detail.workspace.auto_lock_min_size || 100 * 1024 * 1024,
      autoLockKeep:     detail.workspace.auto_lock_keep || 1,
    }
    setForm(next)
    savedForm.current = next
    const noteVal = detail.workspace.note || ''
    setNote(noteVal)
    savedNote.current = noteVal
    setSpecifyResolution(!isResolutionDefault(detail.workspace.resolution_x || 0, detail.workspace.resolution_y || 0))
    setSpecifyFrames(!isFrameDefault(start, end))
    lastResolutionSpec.current = null
    lastFrameSpec.current = null
    setError('')
  }, [detail])

  useEffect(() => {
    if (focusName && !hasFocused.current && nameRef.current) {
      nameRef.current.focus()
      nameRef.current.select()
      hasFocused.current = true
    }
  }, [focusName, form])

  useEffect(() => {
    BlenderApi.list().then(list => setBlenders(list || [])).catch(() => {})
    BlenderApi.getCPUCount().then(n => setCpuCount(n)).catch(() => {})
    CodesApi.getImageFormats().then(list => setImageFormats(list || [])).catch(() => {})
    CodesApi.getResolutionPresets().then(list => setResolutionPresets(list || [])).catch(() => {})
    EnvironmentApi.get().then(env => setEnvOutputFormat(env?.output_format || '')).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form) return
    const fid = detail?.workspace?.project_file_id

    if (fid) {
      setToolLoading(true)
      setEnginesLoading(true)
      BlenderApi.getToolData({ installID: form.blenderInstallID, fileID: fid })
        .then(data => {
          setToolData(data || null)
          setEngines(data?.Engines || [])
        })
        .catch(() => { setToolData(null); setEngines([]) })
        .finally(() => { setToolLoading(false); setEnginesLoading(false) })
    } else {
      setToolData(null)
      setEnginesLoading(true)
      BlenderApi.getEngines({ installID: form.blenderInstallID })
        .then(list => setEngines(list || []))
        .catch(() => setEngines([]))
        .finally(() => setEnginesLoading(false))
    }
  }, [form?.blenderInstallID, detail?.workspace?.project_file_id])

  // ── デフォルト値の導出 ───────────────────────────────────
  const fileRecord      = detail?.project_files?.find(f => f.id === detail?.workspace?.project_file_id)
  const fileBlenderID   = fileRecord?.blender_install_id || 0
  const fileBlenderFixed = fileRecord?.blender_fixed || false
  const fileScene       = fileRecord?.scene || ''
  const fileSceneFixed  = fileRecord?.scene_fixed || false
  const fileCamera      = fileRecord?.camera || ''
  const fileCameraFixed = fileRecord?.camera_fixed || false
  const fileEngine      = fileRecord?.engine || ''
  const fileEngineFixed = fileRecord?.engine_fixed || false

  const defaultBlender = form?.blenderInstallID === 0
    ? (blenders.find(b => b.id === fileBlenderID) || blenders[0] || null)
    : null

  const activeScene        = toolData?.Scenes?.find(s => s.Active) || null
  const effectiveSceneName = form?.scene || fileScene || activeScene?.Name || ''
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

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleCopy = async () => {
    setCopying(true)
    showError('')
    try {
      const newName = form.name.trim() + t('workspace.copySuffix')
      const newWS = await WorkspaceApi.copy({ projectID, workspaceID, newName })
      setCopyConfirm(false)
      showToast(t('workspace.copied'))
      navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: newWS.id })
    } catch (err) {
      showError(String(err))
    } finally {
      setCopying(false)
    }
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError(t('workspace.nameRequired')); return }
    setSaving(true)
    try {
      await WorkspaceApi.update({
        projectID, workspaceID, name: form.name.trim(), note,
        blenderInstallID: form.blenderInstallID,
        scene: form.scene, camera: form.camera, engine: form.engine,
        startFrame: form.startFrame, endFrame: form.endFrame,
        frameStep: form.frameStep, thread: form.thread,
        samples: form.samples,
        resolutionX: form.resolutionX, resolutionY: form.resolutionY,
        outputFormat: form.outputFormat,
        autoLock: form.autoLock,
        autoLockMinSize: form.autoLockMinSize,
        autoLockKeep: form.autoLockKeep,
      })
      savedForm.current = { ...form, name: form.name.trim() }
      savedNote.current = note
      showToast(t('common.saved'))
      onUpdated()
    } catch (err) {
      showError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleTestEncode = async () => {
    showError('')
    setTestEnqueued(false)
    setTestEnqueueing(true)
    try {
      await QueueApi.testEnqueue({
        projectID,
        workspaceID,
        params: {
          blender_install_id: form.blenderInstallID,
          scene:       form.scene,
          camera:      form.camera,
          engine:      form.engine,
          start_frame:  form.startFrame,
          end_frame:    form.endFrame,
          thread:       form.thread,
          resolution_x: form.resolutionX,
          resolution_y: form.resolutionY,
        },
      })
      setTestEnqueued(true)
      if (onTestEnqueued) onTestEnqueued()
    } catch (err) {
      showError(String(err))
    } finally {
      setTestEnqueueing(false)
    }
  }

  const handleSamplesComparison = async () => {
    showError('')
    setSamplesEnqueuing(true)
    try {
      const counts = samplesListText.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0)
      if (counts.length === 0) {
        showError(t('workspace.samplesListEmpty'))
        return
      }
      await QueueApi.samplesComparisonEnqueue({ projectID, workspaceID, sampleCounts: counts, frame: samplesFrame })
      setSamplesDialogOpen(false)
      navigate('queue')
    } catch (err) {
      showError(String(err))
    } finally {
      setSamplesEnqueuing(false)
    }
  }

  const handleRenderClick = async () => {
    showError('')
    setResolvingRender(true)
    try {
      const preview = await QueueApi.previewRender({ projectID, workspaceID })
      setRenderConfirm(preview)
    } catch (err) {
      showError(String(err))
    } finally {
      setResolvingRender(false)
    }
  }

  const handleRenderEnqueue = async () => {
    if (!renderConfirm) return
    setRenderEnqueuing(true)
    showError('')
    try {
      await QueueApi.enqueueWithPreview({ projectID, workspaceID, preview: renderConfirm })
      setRenderConfirm(null)
      if (onRenderEnqueued) onRenderEnqueued()
    } catch (err) {
      showError(String(err))
      setRenderConfirm(null)
    } finally {
      setRenderEnqueuing(false)
    }
  }

  if (!form) return null

  const isFormDirty = savedForm.current === null || JSON.stringify(form) !== JSON.stringify(savedForm.current)
  const isNoteDirty = note !== savedNote.current
  const isDirty = isFormDirty || isNoteDirty

  const blenderDefault = !fileBlenderFixed && form?.blenderInstallID === 0
    ? (blenders.find(b => b.id === fileBlenderID)?.name || blenders[0]?.name || null)
    : null
  const sceneDefault  = !fileSceneFixed && !form.scene ? (fileScene || activeScene?.Name || null) : null
  const cameraDefault = !fileCameraFixed && !form.camera && sceneInfo?.Camera ? sceneInfo.Camera : null
  const engineDefault = !form.engine ? (fileEngine || sceneInfo?.Engine || null) : null
  const effectiveEngine = fileEngineFixed && fileEngine
    ? fileEngine
    : (form.engine || fileEngine || sceneInfo?.Engine || '')
  const samplesDefault = form.samples === 0
    ? samplesForEngine(effectiveEngine, sceneInfo?.Samples)
    : 0

  const lockedBlenderName = fileBlenderFixed
    ? (fileBlenderID === 0
        ? (blenders[0]?.name || t('common.notSet'))
        : (blenders.find(b => b.id === fileBlenderID)?.name || t('common.notSet')))
    : null
  const resolutionDefault = !specifyResolution && sceneInfo?.X && sceneInfo?.Y
    ? `${sceneInfo.X} × ${sceneInfo.Y}`
    : null
  const frameDefault  = !specifyFrames && sceneInfo
    ? t('workspace.frameRangeDefault', { start: sceneInfo.Start, end: sceneInfo.End })
    : null
  const threadsHint   = cpuCount
    ? t('workspace.threadsHintWithMax', { count: cpuCount })
    : t('workspace.threadsHint')

  return (
    <div className="form workspace" style={{ maxWidth: 640 }}>
      <div className="form-row">
        <div className="form-field" style={{ flex: 2 }}>
          <label className="form-label">{t('workspace.name')} <span className="required">*</span></label>
          <input ref={nameRef} className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">
            {t('workspace.blender')}
            {fileBlenderFixed
              ? <span className="form-lock-tag">🔒 {lockedBlenderName}</span>
              : <DefaultTag value={blenderDefault} t={t} />
            }
          </label>
          {fileBlenderFixed ? (
            <input className="form-input" value={lockedBlenderName} disabled style={{ opacity: 0.5 }} />
          ) : (
            <select className="form-select" value={form.blenderInstallID} onChange={e => set('blenderInstallID', Number(e.target.value))}>
              <option value={0}>{t('common.notSet')}</option>
              {blenders.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.version || t('common.versionUnknown')})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <details className="form-collapsible" open={!detail.workspace.auto_lock}>
        <summary>{t('workspace.renderSettings')}</summary>
        <div className="form-collapsible-body">
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <div className="form-field" style={{ flex: 2 }}>
          <label className="form-label">
            {t('workspace.renderEngine')}
            {fileEngineFixed
              ? <span className="form-lock-tag">🔒 {fileEngine || sceneInfo?.Engine || t('common.notSet')}</span>
              : <DefaultTag value={engineDefault} t={t} />
            }
          </label>
          {fileEngineFixed ? (
            <input className="form-input" value={fileEngine || sceneInfo?.Engine || t('common.notSet')} disabled style={{ opacity: 0.5 }} />
          ) : engines.length > 0 ? (
            <select className="form-select" value={form.engine} onChange={e => set('engine', e.target.value)} disabled={enginesLoading}>
              <option value="">{t('common.notSet')}</option>
              {engines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
            </select>
          ) : (
            <input className="form-input" value={form.engine} onChange={e => set('engine', e.target.value)} placeholder={t('workspace.enginePlaceholder')} />
          )}
          {fileEngineFixed && (
            <span className="form-hint">{t('workspace.engineLockedByFile')}</span>
          )}
        </div>
        <div className="form-field" style={{ flex: '0 0 80px', minWidth: 0 }}>
          <label className="form-label">{t('workspace.samples')}</label>
          <input className="form-input" style={{ textAlign: 'right', width: '100%' }} type="number" min={0} value={form.samples} onChange={e => set('samples', Number(e.target.value))} />
          {samplesDefault > 0 && (
            <span className="form-hint" style={{ whiteSpace: 'nowrap' }}>{t('workspace.samplesDefaultValue', { count: samplesDefault })}</span>
          )}
        </div>
        <div className="form-field" style={{ flex: '0 0 80px', minWidth: 0 }}>
          <label className="form-label">{t('workspace.threads')}</label>
          <input className="form-input" style={{ textAlign: 'right', width: '100%' }} type="number" min={0} value={form.thread} onChange={e => set('thread', Number(e.target.value))} />
          <span className="form-hint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={threadsHint}>{threadsHint}</span>
        </div>
      </div>

      <div className="form-row" style={{ alignItems: 'flex-start', marginTop: -20 }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">
            {t('workspace.scene')}
            {fileSceneFixed
              ? <span className="form-lock-tag">🔒 {fileScene || activeScene?.Name || t('common.notSet')}</span>
              : <DefaultTag value={sceneDefault} t={t} />
            }
          </label>
          {fileSceneFixed ? (
            <input className="form-input" value={fileScene || activeScene?.Name || t('common.notSet')} disabled style={{ opacity: 0.5 }} />
          ) : scenes.length > 0 ? (
            <select className="form-select" value={form.scene} onChange={e => { set('scene', e.target.value); set('camera', '') }} disabled={toolLoading}>
              <option value="">{t('common.notSet')}</option>
              {scenes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input className="form-input" value={form.scene} onChange={e => set('scene', e.target.value)} placeholder={t('common.notSetPlaceholder')} />
          )}
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">
            {t('workspace.camera')}
            {fileCameraFixed
              ? <span className="form-lock-tag">🔒 {fileCamera || sceneInfo?.Camera || t('common.notSet')}</span>
              : <DefaultTag value={cameraDefault} t={t} />
            }
          </label>
          {fileCameraFixed ? (
            <input className="form-input" value={fileCamera || sceneInfo?.Camera || t('common.notSet')} disabled style={{ opacity: 0.5 }} />
          ) : (
            <select
              className="form-select"
              value={form.camera}
              onChange={e => set('camera', e.target.value)}
              disabled={toolLoading}
            >
              <option value="">{t('common.notSet')}</option>
              {allCameras
                .filter(c => !form.scene || (c.Scenes && c.Scenes.includes(form.scene)))
                .map(c => <option key={c.Name} value={c.Name}>{c.Name}</option>)
              }
            </select>
          )}
        </div>
      </div>

      <div className="form-field">
        <label className="form-checkbox-label">
          <input type="checkbox" checked={specifyResolution} onChange={e => handleSpecifyResolution(e.target.checked)} />
          {t('workspace.specifyResolution')}
          <DefaultTag value={resolutionDefault} t={t} />
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
              >
                <option value="">—</option>
                {resolutionPresets.map(p => (
                  <option key={p.code} value={p.code}>{p.label} ({p.width}×{p.height})</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.resolutionX')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={1} value={form.resolutionX} onChange={e => set('resolutionX', Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                title={t('workspace.swapResolution')}
                onClick={() => setForm(prev => ({ ...prev, resolutionX: prev.resolutionY, resolutionY: prev.resolutionX }))}
              >
                ⇄
              </button>
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.resolutionY')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={1} value={form.resolutionY} onChange={e => set('resolutionY', Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>

      <div className="form-field">
        <label className="form-checkbox-label">
          <input type="checkbox" checked={specifyFrames} onChange={e => handleSpecifyFrames(e.target.checked)} />
          {t('workspace.specifyFrameRange')}
          <DefaultTag value={frameDefault} t={t} />
        </label>
        {specifyFrames && (
          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-field">
              <label className="form-label">{t('workspace.startFrame')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={0} value={form.startFrame} onChange={e => set('startFrame', Number(e.target.value))} />
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.endFrame')}</label>
              <input className="form-input" style={{ width: 100, textAlign: 'right' }} type="number" min={0} value={form.endFrame} onChange={e => set('endFrame', Number(e.target.value))} />
            </div>
            <div className="form-field">
              <label className="form-label">{t('workspace.frameStep')}</label>
              <input className="form-input" style={{ width: 80, textAlign: 'right' }} type="number" min={1} value={form.frameStep} onChange={e => set('frameStep', Number(e.target.value))} />
              <span className="form-hint">{t('workspace.frameStepHint')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-field">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>{t('workspace.outputFormat')}</label>
          {form.outputFormat === '' && (
            <DefaultTag value={imageFormats.find(f => f.code === (envOutputFormat || 'PNG'))?.label ?? (envOutputFormat || 'PNG')} t={t} />
          )}
        </div>
        <select className="form-select" style={{ width: 200 }} value={form.outputFormat} onChange={e => set('outputFormat', e.target.value)}>
          <option value="">{t('common.notSet')}</option>
          {imageFormats.map(f => (
            <option key={f.code} value={f.code}>{f.label}</option>
          ))}
        </select>
      </div>
        </div>
      </details>

      {error && <div className="error-msg">{error}</div>}
      {testEnqueued && <div className="warning-msg">{t('workspace.testEnqueued')}</div>}

      <NoteSection value={note} onChange={setNote} />

      <div className="form-field">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="autoLock" checked={form.autoLock} onChange={e => set('autoLock', e.target.checked)} />
          <label htmlFor="autoLock" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>{t('workspace.autoLock')}</label>
        </div>
        {form.autoLock && (
          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">{t('workspace.autoLockMinSize')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="form-input" style={{ width: 120, textAlign: 'right' }} type="number" min={0} value={Math.round(form.autoLockMinSize / (1024 * 1024))} onChange={e => set('autoLockMinSize', Number(e.target.value) * 1024 * 1024)} />
                <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>MB</span>
              </div>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">{t('workspace.autoLockKeep')}</label>
              <input className="form-input" style={{ width: 80, textAlign: 'right' }} type="number" min={1} value={form.autoLockKeep} onChange={e => set('autoLockKeep', Math.max(1, Number(e.target.value)))} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-outline btn-sm" onClick={() => setCopyConfirm(true)} disabled={copying}>
          {t('workspace.copy')}
        </button>
      </div>

      <div className="form-actions">
        <button className="btn btn-danger" onClick={() => { setForceDel(false); setConfirm(true) }}>{t('common.delete')}</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-run" onClick={handleTestEncode} disabled={testEnqueueing || workDirLocked}>
            {testEnqueueing ? t('common.enqueueing') : t('workspace.testRender')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setSamplesDialogOpen(true)} disabled={workDirLocked || isFormDirty}>
            {t('workspace.samplesComparison')}
          </button>
          <button className="btn btn-run" onClick={handleRenderClick} disabled={resolvingRender || workDirLocked || isFormDirty}>
            {resolvingRender ? t('common.processing') : `▶ ${t('common.run')}`}
          </button>
          <button className="btn btn-green" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
          </div>
          <span style={{ fontSize: '0.75rem', opacity: 0.45 }}>{t('workspace.testHint')}</span>
        </div>
      </div>

      <Dialog
        open={!!renderConfirm}
        title={t('render.confirmTitle')}
        onClose={() => setRenderConfirm(null)}
        closeOnBackdrop={!renderEnqueuing}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setRenderConfirm(null)}>{t('common.cancel')}</button>
            <button className="btn btn-run" onClick={handleRenderEnqueue} disabled={renderEnqueuing}>
              {renderEnqueuing ? t('common.enqueueing') : `▶ ${t('common.run')}`}
            </button>
          </>
        }
      >
        {renderConfirm && (
          <>
            {detail.workspace.processed_at && !wsStale && (
              <p className="dialog-message dialog-message-warn">{t('render.fileNotModifiedWarning')}</p>
            )}
            {renderConfirm.engine
              ? <p><span className="dialog-label">{t('render.engine')}</span>{renderConfirm.engine}</p>
              : <p><span className="dialog-label">{t('render.engine')}</span><span style={{ opacity: 0.5 }}>{t('render.blendDefault')}</span></p>
            }
            {renderConfirm.samples > 0 && <p><span className="dialog-label">{t('render.samples')}</span>{renderConfirm.samples}</p>}
            <p><span className="dialog-label">{t('render.scene')}</span>{renderConfirm.scene}</p>
            {renderConfirm.camera && <p><span className="dialog-label">{t('render.camera')}</span>{renderConfirm.camera}</p>}
            {(renderConfirm.resolution_x > 0 || renderConfirm.resolution_y > 0) && (
              <p><span className="dialog-label">{t('render.resolution')}</span>{renderConfirm.resolution_x} × {renderConfirm.resolution_y}</p>
            )}
            <p><span className="dialog-label">{t('render.frames')}</span>{renderConfirm.start_frame} – {renderConfirm.end_frame}</p>
            {renderConfirm.frame_step > 1 && <p><span className="dialog-label">{t('render.step')}</span>{renderConfirm.frame_step}</p>}
            {renderConfirm.output_format && <p><span className="dialog-label">{t('render.outputFormat')}</span>{renderConfirm.output_format}</p>}
          </>
        )}
      </Dialog>

      <Dialog
        open={samplesDialogOpen}
        title={t('workspace.samplesComparison')}
        onClose={() => setSamplesDialogOpen(false)}
        closeOnBackdrop={!samplesEnqueuing}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setSamplesDialogOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-run" onClick={handleSamplesComparison} disabled={samplesEnqueuing}>
              {samplesEnqueuing ? t('common.enqueueing') : `▶ ${t('common.run')}`}
            </button>
          </>
        }
      >
        <div className="form-field">
          <label className="form-label">{t('workspace.samplesListLabel')}</label>
          <input
            className="form-input"
            style={{ width: '100%' }}
            value={samplesListText}
            onChange={e => setSamplesListText(e.target.value)}
            placeholder="2,4,8,16,32,64,128,256,512"
          />
          <span className="form-hint">{t('workspace.samplesListHint')}</span>
        </div>
        <div className="form-field">
          <label className="form-label">{t('workspace.samplesFrame')}</label>
          <input
            className="form-input"
            style={{ width: 120 }}
            type="number"
            min={0}
            value={samplesFrame}
            onChange={e => setSamplesFrame(Number(e.target.value))}
          />
          <span className="form-hint">{t('workspace.samplesFrameHint')}</span>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirm}
        hold
        title={t('workspace.confirmDelete')}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await WorkspaceApi.delete({ projectID, workspaceID, force: forceDel })
            onDeleted()
          } catch (err) {
            const msg = String(err)
            if (msg.includes('locked_jobs_exist')) {
              showError(t('workspace.lockedJobsExist'))
            } else {
              showError(msg)
            }
            setConfirm(false)
          } finally {
            setDeleting(false)
          }
        }}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
      >
        <p><span className="dialog-label">{t('dialog.workspace')}</span>{detail.workspace.name}</p>
        <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
          {t('workspace.deleteWarning')}
        </p>
        <label className="form-checkbox-label" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          <input type="checkbox" checked={forceDel} onChange={e => setForceDel(e.target.checked)} />
          {t('workspace.forceDeleteLabel')}
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={copyConfirm}
        title={t('workspace.copy')}
        confirmLabel={t('workspace.copy')}
        confirmClassName="btn btn-outline"
        onConfirm={handleCopy}
        onCancel={() => setCopyConfirm(false)}
        busy={copying}
      >
        <p>{t('workspace.copyConfirmMsg')}</p>
      </ConfirmDialog>
    </div>
  )
}



// ── ページ本体 ────────────────────────────────────────────
function WorkspaceDetailPage({ projectID, projectName, fileID, fileName, workspaceID, focusName, navigate }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [detail, setDetail]           = useState(null)
  const [loadFailed, setLoadFailed]   = useState(false)
  const [historyReload, setHistoryReload] = useState(0)
  const [workDirStatus, setWorkDirStatus] = useState(null)

  const load = useCallback(() => {
    WorkspaceApi.get({ projectID, workspaceID })
      .then(d => setDetail(d))
      .catch(err => { showError(String(err)); setLoadFailed(true) })
  }, [projectID, workspaceID, showError])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([ProjectApi.get({ id: projectID }), WorkDirApi.list()])
      .then(([d, dirs]) => {
        const wd = (dirs || []).find(w => w.id === d?.project?.work_dir_id)
        setWorkDirStatus(wd?.status || null)
      })
      .catch(() => {})
  }, [projectID])

  if (loadFailed && !detail) {
    return <div className="page" />
  }
  if (!detail) {
    return <div className="page"><p className="setting-desc">{t('common.loading')}</p></div>
  }

  const effectiveFileID   = fileID   || detail.workspace.project_file_id || ''
  const effectiveFileName = fileName || detail.project_files?.find(f => f.id === effectiveFileID)?.name || ''
  const effectiveFile     = detail.project_files?.find(f => f.id === effectiveFileID)
  const wsStale = effectiveFile?.file_modified_at && detail.workspace.processed_at
    && new Date(effectiveFile.file_modified_at) > new Date(detail.workspace.processed_at)

  return (
    <div className="page">
      <div className="page-header">
        <Breadcrumb items={[
          { label: t('breadcrumb.projects'), onClick: () => navigate('projects') },
          { label: projectName, onClick: () => navigate('project', { id: projectID, initialTab: 'settings' }) },
          effectiveFileName && { label: effectiveFileName, onClick: () => navigate('file', { projectID, projectName, fileID: effectiveFileID, fileName: effectiveFileName, initialTab: 'settings' }) },
          { label: detail.workspace.name, suffix: wsStale ? <span className="badge badge-warn" style={{ marginLeft: 6 }}>{t('file.fileChanged')}</span> : null },
        ].filter(Boolean)} />
      </div>

      {workDirStatus === 'lock' && (
        <div className="notice-banner notice-error">{t('project.workDirLockError')}</div>
      )}
      {workDirStatus === 'inactive' && (
        <div className="notice-banner">{t('project.workDirInactiveWarning')}</div>
      )}

      <div className="ws-detail-split">
        <div className="ws-detail-left">
          <SettingsTab
            projectID={projectID}
            projectName={projectName}
            fileID={effectiveFileID}
            fileName={effectiveFileName}
            workspaceID={workspaceID}
            detail={detail}
            focusName={focusName}
            onUpdated={() => {}}
            onDeleted={() => navigate('file', { projectID, projectName, fileID: effectiveFileID, fileName: effectiveFileName })}
            onTestEnqueued={() => setHistoryReload(n => n + 1)}
            onRenderEnqueued={() => navigate('queue')}
            workDirLocked={workDirStatus === 'lock'}
            navigate={navigate}
            wsStale={wsStale}
          />
        </div>
        <div className="ws-detail-right">
          <WorkspaceThumbnailPanel projectID={projectID} fileID={effectiveFileID} workspaceID={workspaceID} />
          <h3 className="ws-detail-section-title">{t('tabs.history')}</h3>
          <HistoryTab
            projectID={projectID}
            workspaceID={workspaceID}
            navigate={navigate}
            projectName={projectName}
            fileID={effectiveFileID}
            fileName={effectiveFileName}
            workspaceName={detail.workspace.name}
            reloadTrigger={historyReload}
          />
        </div>
      </div>
    </div>
  )
}

export default WorkspaceDetailPage
