import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, QueueApi, ProjectApi, BlenderApi, WorkDirApi } from '../../lib/api'
import { useToast, useMessage } from '../../lib/toast'
import { onAppEvent } from '../../lib/appEvents'
import Pagination from '../../components/Pagination'
import SortSelect from '../../components/SortSelect'
import Dialog from '../../components/Dialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import Breadcrumb from '../../components/Breadcrumb'
import NoteSection from '../../components/NoteSection'
import WorkspaceCreateDialog from '../../components/WorkspaceCreateDialog'


// ── ワークスペースカード（サムネイル表示） ──────────────────
function WorkspaceCard({ projectID, fileID, ws, navigate, projectName, fileName, onRunClick, resolvingWsId, thumbnailMode, onSetThumbnail, workDirLocked, small }) {
  const { t } = useTranslation()
  const [thumb, setThumb] = useState(null)

  useEffect(() => {
    WorkspaceApi.getThumbnail({ projectID, fileID, workspaceID: ws.id })
      .then(src => setThumb(src || null))
      .catch(() => {})
  }, [projectID, fileID, ws.id])

  const handleClick = () => {
    if (thumbnailMode) {
      onSetThumbnail(ws.id)
    } else {
      navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })
    }
  }

  return (
    <div
      className={`file-tile ws-tile${thumbnailMode ? ' file-tile-thumb-select' : ''}`}
      title={ws.name}
      onClick={handleClick}
    >
      <div className="file-tile-thumb">
        {thumb
          ? <img src={thumb} alt={ws.name} />
          : <span className="file-tile-thumb-placeholder">{t('workspace.noImage')}</span>
        }
      </div>
      <div className="ws-tile-info">
        <span className="file-tile-name" title={ws.name}>{ws.name}</span>
        {!small && (
          <div className="ws-item-meta" style={{ marginTop: 4 }}>
            {ws.engine && <span className="ws-meta-chip">{ws.engine}</span>}
            {(ws.start === 0 && ws.end === -1)
              ? <span className="ws-meta-chip">{t('workspace.blendDefault')}</span>
              : <span className="ws-meta-chip">{ws.start} – {ws.end} f</span>
            }
          </div>
        )}
      </div>
      {!thumbnailMode && !small && (
        <div className="ws-tile-actions">
          <button
            className="btn btn-run btn-sm"
            onClick={e => { e.stopPropagation(); onRunClick(ws) }}
            disabled={resolvingWsId !== null || workDirLocked}
          >
            ▶ {t('common.run')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── ワークスペースタブ ─────────────────────────────────────
function WorkspaceTab({ projectID, projectName, fileID, fileName, navigate, onEnqueued, workDirLocked }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [workspaces, setWorkspaces] = useState([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [confirm, setConfirm]       = useState(null) // { ws, preview }
  const [resolvingWsId, setResolvingWsId] = useState(null)
  const [enqueuing, setEnqueuing]   = useState(false)
  const [viewMode, setViewMode]     = useState(() => localStorage.getItem('viewMode:workspaces') || 'list')
  const [thumbnailMode, setThumbnailMode] = useState(false)
  const [sort, setSort]             = useState(() => localStorage.getItem('sort:workspaces') || 'display_order')
  const [dir, setDir]               = useState(() => localStorage.getItem('dir:workspaces') || '')

  const load = (s, d) => {
    WorkspaceApi.listByProject({ projectID, sort: s, dir: d })
      .then(list => {
        const group = (list || []).find(g => g.file.id === fileID)
        setWorkspaces(group ? group.workspaces : [])
      })
      .catch(() => {})
  }

  const handleSortChange = (s) => {
    setSort(s)
    localStorage.setItem('sort:workspaces', s)
    load(s, dir)
  }

  const handleDirChange = (d) => {
    setDir(d)
    localStorage.setItem('dir:workspaces', d)
    load(sort, d)
  }

  useEffect(() => { load(sort, dir) }, [projectID, fileID])

  const handleCreateWorkspace = () => {
    setCreateDialogOpen(true)
  }

  const handleCreated = (newWorkspaces) => {
    load(sort, dir)
    if (newWorkspaces.length === 1) {
      navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: newWorkspaces[0].id, focusName: true })
    }
  }

  const handleRunClick = async (ws) => {
    showError('')
    setResolvingWsId(ws.id)
    try {
      const preview = await QueueApi.previewRender({ projectID, workspaceID: ws.id })
      setConfirm({ ws, preview })
    } catch (err) {
      showError(String(err))
    } finally {
      setResolvingWsId(null)
    }
  }

  const handleEnqueue = async () => {
    if (!confirm) return
    setEnqueuing(true)
    showError('')
    try {
      await QueueApi.enqueueWithPreview({ projectID, workspaceID: confirm.ws.id, preview: confirm.preview })
      onEnqueued()
    } catch (err) {
      showError(String(err))
      setConfirm(null)
    } finally {
      setEnqueuing(false)
    }
  }

  const handleSetThumbnail = async (workspaceID) => {
    try {
      await ProjectApi.setFileThumbnailFromWorkspace({ projectID, fileID, workspaceID })
      showToast(t('viewer.thumbnailSet'))
      setThumbnailMode(false)
    } catch (err) {
      showError(String(err))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {workspaces.length > 0 && (
        <div className="file-view-toggle" style={{ marginBottom: 8 }}>
          <button
            className={`file-view-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => { setViewMode('list'); localStorage.setItem('viewMode:workspaces', 'list') }}
            title={t('workspace.listView')}
          >☰</button>
          <button
            className={`file-view-btn${viewMode === 'card' ? ' active' : ''}`}
            onClick={() => { setViewMode('card'); localStorage.setItem('viewMode:workspaces', 'card') }}
            title={t('workspace.cardView')}
          >⊞</button>
          <button
            className={`file-view-btn${viewMode === 'card-sm' ? ' active' : ''}`}
            onClick={() => { setViewMode('card-sm'); localStorage.setItem('viewMode:workspaces', 'card-sm') }}
            title={t('workspace.smallCardView')}
          >▦</button>
          <SortSelect value={sort} onChange={handleSortChange} dir={dir} onDirChange={handleDirChange} />
          <button
            className={`btn btn-sm${thumbnailMode ? ' btn-outline-active' : ' btn-outline'}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => setThumbnailMode(v => !v)}
          >
            {t('workspace.setAsFileThumbnail')}
          </button>
        </div>
      )}

      {thumbnailMode && (
        <div className="thumbnail-mode-hint">{t('file.selectThumbnailHint')}</div>
      )}


      <div style={{ position: 'relative' }}>
        {viewMode === 'list' ? (
          <div className="ws-list">
            {workspaces.length === 0 && (
              <p className="ws-empty">{t('workspace.empty')}</p>
            )}
            {workspaces.map(ws => (
              <div
                key={ws.id}
                className={`ws-item ws-item-run${thumbnailMode ? ' file-item-thumb-select' : ''}`}
                onClick={thumbnailMode ? () => handleSetThumbnail(ws.id) : undefined}
              >
                {!thumbnailMode && (
                  <button
                    className="btn btn-run btn-sm ws-item-run-btn"
                    onClick={() => handleRunClick(ws)}
                    disabled={resolvingWsId !== null || workDirLocked}
                  >
                    ▶ {t('common.run')}
                  </button>
                )}
                <div
                  className="ws-item-info ws-item-link"
                  onClick={thumbnailMode ? undefined : () => navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })}
                >
                  <span className="ws-item-name">{ws.name}</span>
                  <div className="ws-item-meta">
                    {ws.engine && <span className="ws-meta-chip">{ws.engine}</span>}
                    {(ws.start === 0 && ws.end === -1)
                      ? <span className="ws-meta-chip">{t('workspace.blendDefault')}</span>
                      : <span className="ws-meta-chip">{ws.start} – {ws.end} f</span>
                    }
                  </div>
                </div>
                {!thumbnailMode && (
                  <span className="ws-item-arrow" onClick={() => navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })}>›</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`file-tile-grid${viewMode === 'card-sm' ? ' file-tile-grid--sm' : ''}`}>
            {workspaces.length === 0 && (
              <p className="ws-empty">{t('workspace.empty')}</p>
            )}
            {workspaces.map(ws => (
              <WorkspaceCard
                key={ws.id}
                projectID={projectID}
                fileID={fileID}
                ws={ws}
                navigate={navigate}
                projectName={projectName}
                fileName={fileName}
                onRunClick={handleRunClick}
                resolvingWsId={resolvingWsId}
                thumbnailMode={thumbnailMode}
                onSetThumbnail={handleSetThumbnail}
                workDirLocked={workDirLocked}
                small={viewMode === 'card-sm'}
              />
            ))}
          </div>
        )}
        {resolvingWsId !== null && (
          <div className="ws-list-overlay">
            <span className="ws-list-overlay-label">{t('common.processing')}</span>
          </div>
        )}
      </div>

      <div className="list-spacer" />
      <div className="list-fab">
        <button className="btn btn-green" onClick={handleCreateWorkspace}>
          {t('workspace.createNew')}
        </button>
      </div>

      <WorkspaceCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        projectID={projectID}
        fileID={fileID}
        fileName={fileName}
        onCreated={handleCreated}
      />

      <Dialog
        open={!!confirm}
        title={t('render.confirmTitle')}
        onClose={() => setConfirm(null)}
        closeOnBackdrop={!enqueuing}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
            <button className="btn btn-run" onClick={handleEnqueue} disabled={enqueuing}>
              {enqueuing ? t('common.enqueueing') : t('common.run')}
            </button>
          </>
        }
      >
        {confirm && (
          <>
            <p><span className="dialog-label">{t('render.workspace')}</span>{confirm.ws.name}</p>
            <p><span className="dialog-label">{t('render.scene')}</span>{confirm.preview.scene}</p>
            {confirm.preview.engine
              ? <p><span className="dialog-label">{t('render.engine')}</span>{confirm.preview.engine}</p>
              : <p><span className="dialog-label">{t('render.engine')}</span><span style={{ opacity: 0.5 }}>{t('render.blendDefault')}</span></p>
            }
            <p><span className="dialog-label">{t('render.frames')}</span>{confirm.preview.start_frame} – {confirm.preview.end_frame}</p>
            {confirm.preview.frame_step > 1 && <p><span className="dialog-label">{t('render.step')}</span>{confirm.preview.frame_step}</p>}
          </>
        )}
      </Dialog>
    </div>
  )
}

const HISTORY_PAGE_SIZE = 5

// ── 履歴タブ ──────────────────────────────────────────────
function HistoryTab({ projectID, fileID, navigate, projectName, fileName }) {
  const { t } = useTranslation()
  const [jobs, setJobs]         = useState([])
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE)

  const load = useCallback(() => {
    QueueApi.listJobsByProjectFile({ projectID, fileID })
      .then(list => setJobs(list || []))
      .catch(() => {})
  }, [projectID, fileID])

  useEffect(() => { load() }, [load])

  useEffect(() => onAppEvent('queue:changed', load), [load])

  const statusLabel = (s) => ({ completed: t('status.completed'), error: t('status.error'), cancelled: t('status.cancelled'), running: t('status.running'), waiting: t('status.waiting') })[s] ?? t('status.running')

  const totalPages  = Math.max(1, Math.ceil(jobs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (jobs.length === 0) {
    return <p className="empty-msg">{t('workspace.noHistory')}</p>
  }

  const openJob = (j) => {
    navigate('job', {
      job: j,
      initialTab: 'render',
      backPage: 'file',
      backParams: { projectID, projectName, fileID, fileName },
    })
  }

  return (
    <>
      <div className="queue-history-list">
        {pageJobs.map(j => (
          <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => openJob(j)}>
            <div className="queue-history-top">
              <div>
                <span className="queue-history-name">{j.workspace_name}</span>
                <div className="queue-history-detail" style={{ marginTop: 4 }}>
                  <span>{j.start_frame}–{j.end_frame}f</span>
                  {j.engine && <span>{j.engine}</span>}
                  {j.camera && <span>{j.camera}</span>}
                  {j.enqueued_at && (
                    <span>{new Date(j.enqueued_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
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

const IMAGE_FILTER = [{ DisplayName: 'Image', Pattern: '*.jpg;*.jpeg;*.png;*.bmp;*.webp' }]

// ── サムネイルパネル ───────────────────────────────────────
function ThumbnailPanel({ projectID, fileID }) {
  const { t } = useTranslation()
  const [src, setSrc]           = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    ProjectApi.getFileThumbnail({ projectID, fileID })
      .then(data => setSrc(data || null))
      .catch(() => setSrc(null))
  }, [projectID, fileID])

  const handleClick = async () => {
    if (uploading) return
    try {
      const path = await Dialogs.OpenFile({ Filters: IMAGE_FILTER })
      if (!path) return
      setUploading(true)
      const data = await ProjectApi.setFileThumbnail({ projectID, fileID, imagePath: path })
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

// ── デフォルト値ヒント ────────────────────────────────────
function DefaultTag({ value, t }) {
  if (!value) return null
  return <span className="form-default-tag">（{t('workspace.defaultValueLabel', { value })}）</span>
}

// ── 設定タブ ─────────────────────────────────────────────
function SettingsTab({ projectID, fileID, fileName, onUpdated, onDeleted }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [name, setName]                   = useState(fileName)
  const [note, setNote]                   = useState('')
  const [blenderInstallID, setBlenderID]  = useState(0)
  const [blenderFixed, setBlenderFixed]   = useState(false)
  const [scene, setScene]                 = useState('')
  const [sceneFixed, setSceneFixed]       = useState(false)
  const [camera, setCamera]               = useState('')
  const [cameraFixed, setCameraFixed]     = useState(false)
  const [engine, setEngine]               = useState('')
  const [engineFixed, setEngineFixed]     = useState(false)
  const [blenders, setBlenders]           = useState([])
  const [toolData, setToolData]           = useState(null)
  const [filePath, setFilePath]           = useState('')
  const [openingFile, setOpeningFile]     = useState(false)
  const [toolLoading, setToolLoading]     = useState(false)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [confirm, setConfirm]             = useState(false)

  const fetchToolData = (installID) => {
    setToolLoading(true)
    BlenderApi.getToolData({ installID, fileID })
      .then(data => setToolData(data || null))
      .catch(() => setToolData(null))
      .finally(() => setToolLoading(false))
  }

  useEffect(() => {
    Promise.all([
      ProjectApi.getFile({ fileID }).catch(() => null),
      BlenderApi.list().catch(() => []),
    ]).then(([f, list]) => {
      setBlenders(list || [])
      const installID = f?.blender_install_id || 0
      setName(f?.name || fileName)
      setNote(f?.note || '')
      setFilePath(f?.path || '')
      setBlenderID(installID)
      setBlenderFixed(f?.blender_fixed || false)
      setScene(f?.scene || '')
      setSceneFixed(f?.scene_fixed || false)
      setCamera(f?.camera || '')
      setCameraFixed(f?.camera_fixed || false)
      setEngine(f?.engine || '')
      setEngineFixed(f?.engine_fixed || false)
      fetchToolData(installID)
    })
  }, [fileID])

  const handleBlenderChange = (installID) => {
    setBlenderID(installID)
    fetchToolData(installID)
  }

  const handleSceneChange = (val) => {
    setScene(val)
    setCamera('')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    showError('')
    try {
      const updated = await ProjectApi.updateFile({ fileID, name: name.trim(), note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed })
      showToast(t('common.saved'))
      if (onUpdated) onUpdated(updated)
    } catch (e) {
      showError(e?.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    showError('')
    try {
      await ProjectApi.deleteFile({ fileID })
      if (onDeleted) onDeleted()
    } catch (e) {
      showError(e?.message ?? String(e))
      setConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const activeScene    = toolData?.Scenes?.find(s => s.Active) || null
  const effectiveScene = scene || activeScene?.Name || ''
  const sceneInfo      = toolData?.Scenes?.find(s => s.Name === effectiveScene) || activeScene
  const scenes         = toolData?.Scenes?.map(s => s.Name) || []
  const allCameras     = toolData?.Cameras || []

  const blenderDefault = !blenderFixed && blenderInstallID === 0 ? (blenders[0]?.name || null) : null
  const sceneDefault  = !scene ? (activeScene?.Name || null) : null
  const cameraDefault = !camera && sceneInfo?.Camera ? sceneInfo.Camera : null
  const engineDefault = !engine ? (sceneInfo?.Engine || null) : null

  return (
    <div className="ws-detail-split">
      <div className="ws-detail-left">
        <div className="form workspace" style={{ maxWidth: 640 }}>
          <div className="form-row">
            <div className="form-field" style={{ flex: 2 }}>
              <label className="form-label">{t('file.displayName')}</label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <button
                className="btn btn-run btn-sm"
                style={{ marginTop: 6, alignSelf: 'flex-start' }}
                disabled={openingFile || !filePath}
                onClick={async () => {
                  setOpeningFile(true)
                  try {
                    await BlenderApi.openFile({ installID: blenderInstallID || 0, filePath })
                  } catch (e) {
                    showError(e?.message ?? String(e))
                  } finally {
                    setOpeningFile(false)
                  }
                }}
              >
                {openingFile ? '...' : t('common.open')}
              </button>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label" style={{ whiteSpace: 'nowrap' }}>
                {t('file.defaultBlender')}
                <DefaultTag value={blenderDefault} t={t} />
              </label>
              {blenders.length === 0 ? (
                <p className="setting-desc">{t('settings.noBlenderRegistered')}</p>
              ) : (
                <select
                  className="form-select"
                  value={blenderInstallID}
                  onChange={e => handleBlenderChange(Number(e.target.value))}
                >
                  <option value={0}>{t('common.notSet')}</option>
                  {blenders.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.version || t('common.versionUnknown')})</option>
                  ))}
                </select>
              )}
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={blenderFixed} onChange={e => setBlenderFixed(e.target.checked)} />
                <span style={{ marginLeft: 6 }}>{t('file.fixed')}</span>
              </label>
            </div>
          </div>

          <div className="form-row" style={{ alignItems: 'flex-start', marginTop: 12 }}>
            <div className="form-field" style={{ flex: 2 }}>
              <label className="form-label">
                {t('file.defaultEngine')}
                <DefaultTag value={engineDefault} t={t} />
              </label>
              {(toolData?.Engines?.length ?? 0) > 0 ? (
                <select
                  className="form-select"
                  value={engine}
                  onChange={e => setEngine(e.target.value)}
                  disabled={toolLoading}
                >
                  <option value="">{t('common.notSet')}</option>
                  {toolData.Engines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={engine}
                  onChange={e => setEngine(e.target.value)}
                  placeholder={t('workspace.enginePlaceholder')}
                />
              )}
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={engineFixed} onChange={e => setEngineFixed(e.target.checked)} />
                <span style={{ marginLeft: 6 }}>{t('file.fixed')}</span>
              </label>
            </div>
          </div>

          <div className="form-row" style={{ alignItems: 'flex-start' }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">
                {t('file.defaultScene')}
                <DefaultTag value={sceneDefault} t={t} />
              </label>
              {scenes.length > 0 ? (
                <select
                  className="form-select"
                  value={scene}
                  onChange={e => handleSceneChange(e.target.value)}
                  disabled={toolLoading}
                >
                  <option value="">{t('common.notSet')}</option>
                  {scenes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={scene}
                  onChange={e => handleSceneChange(e.target.value)}
                  placeholder={t('common.notSetPlaceholder')}
                />
              )}
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={sceneFixed} onChange={e => setSceneFixed(e.target.checked)} />
                <span style={{ marginLeft: 6 }}>{t('file.fixed')}</span>
              </label>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">
                {t('file.defaultCamera')}
                <DefaultTag value={cameraDefault} t={t} />
              </label>
              <select
                className="form-select"
                value={camera}
                onChange={e => setCamera(e.target.value)}
                disabled={toolLoading}
              >
                <option value="">{t('common.notSet')}</option>
                {allCameras
                  .filter(c => !scene || (c.Scenes && c.Scenes.includes(scene)))
                  .map(c => <option key={c.Name} value={c.Name}>{c.Name}</option>)
                }
              </select>
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={cameraFixed} onChange={e => setCameraFixed(e.target.checked)} />
                <span style={{ marginLeft: 6 }}>{t('file.fixed')}</span>
              </label>
            </div>
          </div>

          <NoteSection value={note} onChange={setNote} />

          <div className="form-actions">
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>{t('common.delete')}</button>
            <button className="btn btn-green" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={confirm}
          title={t('file.confirmDelete')}
          onCancel={() => setConfirm(false)}
          onConfirm={handleDelete}
          confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
          busy={deleting}
        >
          <p><span className="dialog-label">{t('dialog.file')}</span>{fileName}</p>
          <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
            {t('file.deleteWarning')}
          </p>
        </ConfirmDialog>
      </div>

      <div className="ws-detail-right">
        <ThumbnailPanel projectID={projectID} fileID={fileID} />
      </div>
    </div>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function FileDetailPage({ projectID, projectName, fileID, fileName, initialTab, navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(initialTab || 'workspace')
  const [currentFileName, setCurrentFileName] = useState(fileName)
  const [workDirStatus, setWorkDirStatus] = useState(null)

  useEffect(() => {
    Promise.all([ProjectApi.get({ id: projectID }), WorkDirApi.list()])
      .then(([d, dirs]) => {
        const wd = (dirs || []).find(w => w.id === d?.project?.work_dir_id)
        setWorkDirStatus(wd?.status || null)
      })
      .catch(() => {})
  }, [projectID])

  const tabs = [
    { id: 'workspace', label: t('tabs.workspaceList') },
    { id: 'settings',  label: t('tabs.fileSettings') },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <Breadcrumb items={[
          { label: t('breadcrumb.projects'), onClick: () => navigate('projects') },
          { label: projectName, onClick: () => navigate('project', { id: projectID, initialTab: 'settings' }) },
          { label: currentFileName },
        ]} />
      </div>

      {workDirStatus === 'lock' && (
        <div className="notice-banner notice-error">{t('project.workDirLockError')}</div>
      )}
      {workDirStatus === 'inactive' && (
        <div className="notice-banner">{t('project.workDirInactiveWarning')}</div>
      )}

      <div className="tab-nav">
        {tabs.map(tb => (
          <button
            key={tb.id}
            className={`tab-btn${tab === tb.id ? ' active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'workspace' && (
          <div className="ws-detail-split">
            <div className="ws-detail-left">
              <WorkspaceTab
                projectID={projectID}
                projectName={projectName}
                fileID={fileID}
                fileName={currentFileName}
                navigate={navigate}
                onEnqueued={() => navigate('queue')}
                workDirLocked={workDirStatus === 'lock'}
              />
            </div>
            <div className="ws-detail-right">
              <h3 className="ws-detail-section-title">{t('tabs.history')}</h3>
              <HistoryTab
                projectID={projectID}
                fileID={fileID}
                navigate={navigate}
                projectName={projectName}
                fileName={currentFileName}
              />
            </div>
          </div>
        )}
        {tab === 'settings' && (
          <SettingsTab
            projectID={projectID}
            fileID={fileID}
            fileName={currentFileName}
            onUpdated={f => setCurrentFileName(f.name)}
            onDeleted={() => navigate('project', { id: projectID })}
          />
        )}
      </div>
    </div>
  )
}

export default FileDetailPage
