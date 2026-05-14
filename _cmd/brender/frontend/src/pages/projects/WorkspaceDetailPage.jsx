import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, BlenderApi, QueueApi } from '../../lib/api'
import Pagination from '../../components/Pagination'


const isFrameDefault = (start, end) => start === 0 && end === -1

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
function HistoryTab({ projectID, workspaceID, navigate, projectName, fileName, fileID, workspaceName }) {
  const { t } = useTranslation()
  const [jobs, setJobs]         = useState([])
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE)

  const load = useCallback(() => {
    QueueApi.listJobsByWorkspace({ projectID, workspaceID })
      .then(list => setJobs(list || []))
      .catch(() => {})
  }, [projectID, workspaceID])

  useEffect(() => { load() }, [load])

  const statusLabel = (s) => ({ completed: t('status.completed'), error: t('status.error'), cancelled: t('status.cancelled') })[s] ?? s

  const totalPages  = Math.max(1, Math.ceil(jobs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (jobs.length === 0) {
    return <p className="empty-msg">{t('workspace.noHistory')}</p>
  }

  const openJob = (j) => {
    navigate('job', {
      job: j,
      backPage: 'workspace',
      backParams: { projectID, projectName, fileID, fileName, workspaceID, workspaceName },
    })
  }

  return (
    <>
      <div className="queue-history-list">
        {pageJobs.map(j => (
          <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => openJob(j)}>
            <div className="queue-history-top">
              <div className="queue-history-detail" style={{ marginTop: 0 }}>
                <span>{j.start_frame}–{j.end_frame}f</span>
                {j.engine && <span>{j.engine}</span>}
                {j.scene  && <span>{j.scene}</span>}
                {j.enqueued_at && (
                  <span>{new Date(j.enqueued_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
              <span className={`status-badge status-${j.status}`}>{statusLabel(j.status)}</span>
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

// ── 設定タブ ──────────────────────────────────────────────
function SettingsTab({ projectID, workspaceID, detail, focusName, onUpdated, onDeleted }) {
  const { t } = useTranslation()
  const [blenders, setBlenders]             = useState([])
  const [engines, setEngines]               = useState([])
  const [enginesLoading, setEnginesLoading] = useState(false)
  const [scenes, setScenes]                 = useState([])
  const [scenesLoading, setScenesLoading]   = useState(false)
  const [form, setForm]                     = useState(null)
  const [specifyFrames, setSpecifyFrames]   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')
  const [saved, setSaved]                   = useState(false)
  const [confirm, setConfirm]               = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const nameRef = useRef(null)
  const hasFocused = useRef(false)

  useEffect(() => {
    const start = detail.workspace.start ?? 0
    const end   = detail.workspace.end   ?? -1
    setForm({
      name:             detail.workspace.name,
      blenderInstallID: detail.workspace.blender_install_id,
      scene:            detail.workspace.scene || '',
      engine:           detail.workspace.engine || '',
      startFrame:       start,
      endFrame:         end,
      frameStep:        detail.workspace.frame_step || 1,
      thread:           detail.workspace.thread || 0,
      samples:          detail.workspace.samples || 0,
    })
    setSpecifyFrames(!isFrameDefault(start, end))
    setSaved(false)
    setError('')
  }, [detail])

  useEffect(() => {
    if (focusName && !hasFocused.current && nameRef.current) {
      nameRef.current.focus()
      nameRef.current.select()
      hasFocused.current = true
    }
  }, [focusName, form])

  const handleSpecifyFrames = (checked) => {
    setSpecifyFrames(checked)
    if (!checked) {
      setForm(prev => ({ ...prev, startFrame: 0, endFrame: -1 }))
    } else if (isFrameDefault(form.startFrame, form.endFrame)) {
      setForm(prev => ({ ...prev, startFrame: 1, endFrame: 1, frameStep: 1 }))
    }
  }

  useEffect(() => {
    BlenderApi.list()
      .then(list => setBlenders(list || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!form) return
    const fid = detail?.workspace?.project_file_id

    setEnginesLoading(true)
    BlenderApi.getEngines({ installID: form.blenderInstallID })
      .then(list => setEngines(list || []))
      .catch(() => setEngines([]))
      .finally(() => setEnginesLoading(false))

    if (!fid || fid === 0) {
      setScenes([])
      return
    }
    setScenesLoading(true)
    BlenderApi.getScenes({ installID: form.blenderInstallID, fileID: fid })
      .then(list => setScenes(list || []))
      .catch(() => setScenes([]))
      .finally(() => setScenesLoading(false))
  }, [form?.blenderInstallID, detail?.workspace?.project_file_id])

  const set = (key, val) => {
    setSaved(false)
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setError('')
    setSaved(false)
    if (!form.name.trim()) { setError(t('workspace.nameRequired')); return }
    setSaving(true)
    try {
      await WorkspaceApi.update({
        projectID, workspaceID, name: form.name.trim(),
        blenderInstallID: form.blenderInstallID,
        scene: form.scene, engine: form.engine,
        startFrame: form.startFrame, endFrame: form.endFrame,
        frameStep: form.frameStep, thread: form.thread,
        samples: form.samples,
      })
      setSaved(true)
      onUpdated()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!form) return null

  return (
    <div className="form workspace" style={{ maxWidth: 640 }}>
      <div className="form-row">
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">{t('workspace.name')} <span className="required">*</span></label>
          <input ref={nameRef} className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-field" style={{ flex: 2 }}>
          <label className="form-label">{t('workspace.blender')}</label>
          <select className="form-select" value={form.blenderInstallID} onChange={e => set('blenderInstallID', Number(e.target.value))}>
            <option value={0}>{t('common.notSet')}</option>
            {blenders.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.version || t('common.versionUnknown')})</option>
            ))}
          </select>
          <span className="form-hint">{t('workspace.blenderHint')}</span>
        </div>
      </div>

      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <div className="form-field" style={{ flex: 2 }}>
          <label className="form-label">{t('workspace.renderEngine')}</label>
          {engines.length > 0 ? (
            <select className="form-select" value={form.engine} onChange={e => set('engine', e.target.value)} disabled={enginesLoading}>
              <option value="">{t('common.notSet')}</option>
              {engines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
            </select>
          ) : (
            <input className="form-input" value={form.engine} onChange={e => set('engine', e.target.value)} placeholder={t('workspace.enginePlaceholder')} />
          )}
          <span className="form-hint">{t('workspace.engineHint')}</span>
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">{t('workspace.samples')}</label>
          <input className="form-input" style={{ textAlign: 'right' }} type="number" min={0} value={form.samples} onChange={e => set('samples', Number(e.target.value))} />
          <span className="form-hint">{t('workspace.samplesHint')}</span>
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">{t('workspace.threads')}</label>
          <input className="form-input" style={{ textAlign: 'right' }} type="number" min={0} value={form.thread} onChange={e => set('thread', Number(e.target.value))} />
          <span className="form-hint">{t('workspace.threadsHint')}</span>
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">{t('workspace.scene')}</label>
        {scenes.length > 0 ? (
          <select className="form-select" value={form.scene} onChange={e => set('scene', e.target.value)} disabled={scenesLoading}>
            <option value="">{t('common.notSet')}</option>
            {scenes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input className="form-input" value={form.scene} onChange={e => set('scene', e.target.value)} placeholder={t('common.notSetPlaceholder')} />
        )}
        <span className="form-hint">{t('workspace.sceneHint')}</span>
      </div>

      <div className="form-field">
        <label className="form-label">{t('workspace.frameRange')}</label>
        <label className="form-checkbox-label">
          <input type="checkbox" checked={specifyFrames} onChange={e => handleSpecifyFrames(e.target.checked)} />
          {t('workspace.specifyFrames')}
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
        <span className="form-hint">{t('workspace.frameRangeHint')}</span>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">{t('common.saved')}</div>}

      <div className="form-actions">
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>{t('common.delete')}</button>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">{t('workspace.confirmDelete')}</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">{t('dialog.workspace')}</span>{detail.workspace.name}</p>
              <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                {t('workspace.deleteWarning')}
              </p>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
              <button className="btn btn-danger" onClick={async () => {
                setDeleting(true)
                try {
                  await WorkspaceApi.delete({ projectID, workspaceID })
                  onDeleted()
                } catch (err) {
                  setError(String(err))
                  setConfirm(false)
                } finally {
                  setDeleting(false)
                }
              }} disabled={deleting}>
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



// ── ページ本体 ────────────────────────────────────────────
function WorkspaceDetailPage({ projectID, projectName, fileID, fileName, workspaceID, focusName, navigate }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState(null)
  const [error, setError]   = useState('')

  const load = useCallback(() => {
    WorkspaceApi.get({ projectID, workspaceID })
      .then(d => setDetail(d))
      .catch(err => setError(String(err)))
  }, [projectID, workspaceID])

  useEffect(() => { load() }, [load])

  if (error && !detail) {
    return <div className="page"><div className="error-msg">{error}</div></div>
  }
  if (!detail) {
    return <div className="page"><p className="setting-desc">{t('common.loading')}</p></div>
  }

  const effectiveFileID   = fileID   || detail.workspace.project_file_id || ''
  const effectiveFileName = fileName || detail.project_files?.find(f => f.id === effectiveFileID)?.name || ''

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => navigate('projects')}>{t('breadcrumb.projects')}</button>
          <span className="breadcrumb-sep">›</span>
          <button className="breadcrumb-link" onClick={() => navigate('project', { id: projectID })}>{projectName}</button>
          <span className="breadcrumb-sep">›</span>
          {effectiveFileName && (
            <>
              <button className="breadcrumb-link" onClick={() => navigate('file', { projectID, projectName, fileID: effectiveFileID, fileName: effectiveFileName })}>{effectiveFileName}</button>
              <span className="breadcrumb-sep">›</span>
            </>
          )}
          <span>{detail.workspace.name}</span>
        </div>
      </div>

      <div className="ws-detail-split">
        <div className="ws-detail-left">
          <SettingsTab
            projectID={projectID}
            workspaceID={workspaceID}
            detail={detail}
            focusName={focusName}
            onUpdated={() => navigate('file', { projectID, projectName, fileID: effectiveFileID, fileName: effectiveFileName })}
            onDeleted={() => navigate('file', { projectID, projectName, fileID: effectiveFileID, fileName: effectiveFileName })}
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
          />
        </div>
      </div>
    </div>
  )
}

export default WorkspaceDetailPage
