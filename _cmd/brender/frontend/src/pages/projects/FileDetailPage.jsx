import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, QueueApi, ProjectApi, BlenderApi } from '../../lib/api'
import Pagination from '../../components/Pagination'
import SortSelect from '../../components/SortSelect'


// ── ワークスペースカード（サムネイル表示） ──────────────────
function WorkspaceCard({ projectID, fileID, ws, navigate, projectName, fileName, onRunClick, resolvingWsId, thumbnailMode, onSetThumbnail }) {
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
        <div className="ws-item-meta" style={{ marginTop: 4 }}>
          {ws.engine && <span className="ws-meta-chip">{ws.engine}</span>}
          {(ws.start === 0 && ws.end === -1)
            ? <span className="ws-meta-chip">{t('workspace.blendDefault')}</span>
            : <span className="ws-meta-chip">{ws.start} – {ws.end} f</span>
          }
        </div>
      </div>
      {!thumbnailMode && (
        <div className="ws-tile-actions">
          <button
            className="btn btn-run btn-sm"
            onClick={e => { e.stopPropagation(); onRunClick(ws) }}
            disabled={resolvingWsId !== null}
          >
            ▶ {t('common.run')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── ワークスペースタブ ─────────────────────────────────────
function WorkspaceTab({ projectID, projectName, fileID, fileName, navigate, onEnqueued }) {
  const { t } = useTranslation()
  const [workspaces, setWorkspaces] = useState([])
  const [creating, setCreating]     = useState(false) // 作成中フラグ
  const [confirm, setConfirm]       = useState(null) // { ws, preview }
  const [resolvingWsId, setResolvingWsId] = useState(null)
  const [enqueuing, setEnqueuing]   = useState(false)
  const [enqueueMsg, setEnqueueMsg] = useState('')
  const [viewMode, setViewMode]     = useState(() => localStorage.getItem('viewMode:workspaces') || 'list')
  const [thumbnailMode, setThumbnailMode] = useState(false)
  const [thumbMsg, setThumbMsg]     = useState('')
  const [sort, setSort]             = useState(() => localStorage.getItem('sort:workspaces') || 'display_order')

  const load = (s) => {
    WorkspaceApi.listByProject({ projectID, sort: s })
      .then(list => {
        const group = (list || []).find(g => g.file.id === fileID)
        setWorkspaces(group ? group.workspaces : [])
      })
      .catch(() => {})
  }

  const handleSortChange = (s) => {
    setSort(s)
    localStorage.setItem('sort:workspaces', s)
    load(s)
  }

  useEffect(() => { load(sort) }, [projectID, fileID])

  const handleCreateWorkspace = async () => {
    if (creating) return
    setCreating(true)
    try {
      const ws = await WorkspaceApi.create({ projectID, projectFileID: fileID, name: 'New Workspace Name' })
      navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id, focusName: true })
    } catch (err) {
      setEnqueueMsg(t('common.error') + String(err))
      setCreating(false)
    }
  }

  const handleRunClick = async (ws) => {
    setEnqueueMsg('')
    setResolvingWsId(ws.id)
    try {
      const preview = await QueueApi.previewRender({ projectID, workspaceID: ws.id })
      setConfirm({ ws, preview })
    } catch (err) {
      setEnqueueMsg(`${t('common.error')}${String(err)}`)
    } finally {
      setResolvingWsId(null)
    }
  }

  const handleEnqueue = async () => {
    if (!confirm) return
    setEnqueuing(true)
    setEnqueueMsg('')
    try {
      await QueueApi.enqueueWithPreview({ projectID, workspaceID: confirm.ws.id, preview: confirm.preview })
      onEnqueued()
    } catch (err) {
      setEnqueueMsg(`${t('common.error')}${String(err)}`)
      setConfirm(null)
    } finally {
      setEnqueuing(false)
    }
  }

  const handleSetThumbnail = async (workspaceID) => {
    setThumbMsg('')
    try {
      await ProjectApi.setFileThumbnailFromWorkspace({ projectID, fileID, workspaceID })
      setThumbMsg(t('viewer.thumbnailSet'))
      setThumbnailMode(false)
      setTimeout(() => setThumbMsg(''), 2500)
    } catch (err) {
      setThumbMsg(t('common.error') + String(err))
    }
  }

  return (
    <div>
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
          <SortSelect value={sort} onChange={handleSortChange} />
          <button
            className={`btn btn-sm${thumbnailMode ? ' btn-outline-active' : ' btn-outline'}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => { setThumbnailMode(v => !v); setThumbMsg('') }}
          >
            {t('workspace.setAsFileThumbnail')}
          </button>
        </div>
      )}

      {thumbnailMode && (
        <div className="thumbnail-mode-hint">{t('file.selectThumbnailHint')}</div>
      )}
      {thumbMsg && <div className="thumbnail-mode-hint thumbnail-mode-ok">{thumbMsg}</div>}


      <div style={{ position: 'relative' }}>
        {viewMode === 'list' ? (
          <div className="ws-list">
            {workspaces.length === 0 && !creating && (
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
                    disabled={resolvingWsId !== null}
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
          <div className="file-tile-grid">
            {workspaces.length === 0 && !creating && (
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

      <div className="list-fab">
        <button className="btn btn-green" onClick={handleCreateWorkspace} disabled={creating}>
          {creating ? t('common.registering') : t('workspace.createNew')}
        </button>
      </div>

      {enqueueMsg && (
        <div className={`enqueue-msg${enqueueMsg.startsWith(t('common.error')) ? ' enqueue-error' : ''}`} style={{ marginTop: 12 }}>
          {enqueueMsg}
        </div>
      )}

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">{t('render.confirmTitle')}</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">{t('render.workspace')}</span>{confirm.ws.name}</p>
              <p><span className="dialog-label">{t('render.scene')}</span>{confirm.preview.scene}</p>
              {confirm.preview.engine
                ? <p><span className="dialog-label">{t('render.engine')}</span>{confirm.preview.engine}</p>
                : <p><span className="dialog-label">{t('render.engine')}</span><span style={{ opacity: 0.5 }}>{t('render.blendDefault')}</span></p>
              }
              <p><span className="dialog-label">{t('render.frames')}</span>{confirm.preview.start_frame} – {confirm.preview.end_frame}</p>
              {confirm.preview.frame_step > 1 && <p><span className="dialog-label">{t('render.step')}</span>{confirm.preview.frame_step}</p>}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
              <button className="btn btn-run" onClick={handleEnqueue} disabled={enqueuing}>
                {enqueuing ? t('common.enqueueing') : t('common.run')}
              </button>
            </div>
          </div>
        </div>
      )}
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
      backPage: 'file',
      backParams: { projectID, projectName, fileID, fileName, workspaceName: j.workspace_name },
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
                  {j.enqueued_at && (
                    <span>{new Date(j.enqueued_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
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

// ── 設定タブ ─────────────────────────────────────────────
function SettingsTab({ projectID, fileID, fileName, onUpdated, onDeleted }) {
  const { t } = useTranslation()
  const [name, setName]                   = useState(fileName)
  const [blenderInstallID, setBlenderID]  = useState(0)
  const [scene, setScene]                 = useState('')
  const [blenders, setBlenders]           = useState([])
  const [scenes, setScenes]               = useState([])
  const [scenesLoading, setScenesLoading] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [confirm, setConfirm]             = useState(false)
  const [error, setError]                 = useState(null)

  const fetchScenes = (installID) => {
    setScenesLoading(true)
    BlenderApi.getScenes({ installID, fileID })
      .then(list => setScenes(list || []))
      .catch(() => setScenes([]))
      .finally(() => setScenesLoading(false))
  }

  useEffect(() => {
    Promise.all([
      ProjectApi.getFile({ fileID }).catch(() => null),
      BlenderApi.list().catch(() => []),
    ]).then(([f, list]) => {
      setBlenders(list || [])
      const installID = f?.blender_install_id || 0
      setName(f?.name || fileName)
      setBlenderID(installID)
      setScene(f?.scene || '')
      fetchScenes(installID)
    })
  }, [fileID])

  const handleBlenderChange = (installID) => {
    setBlenderID(installID)
    fetchScenes(installID)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await ProjectApi.updateFile({ fileID, name: name.trim(), blenderInstallID, scene })
      if (onUpdated) onUpdated(updated)
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await ProjectApi.deleteFile({ fileID })
      if (onDeleted) onDeleted()
    } catch (e) {
      setError(e?.message ?? String(e))
      setConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="ws-detail-split">
      <div className="ws-detail-left">
        <div className="form" style={{ maxWidth: 480 }}>
          <div className="form-field">
            <label className="form-label">{t('file.displayName')}</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <span className="form-hint">{t('file.displayNameHint')}</span>
          </div>

          <div className="form-field">
            <label className="form-label">{t('file.defaultBlender')}</label>
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
            <span className="form-hint">{t('file.blenderHint')}</span>
          </div>

          <div className="form-field">
            <label className="form-label">{t('file.defaultScene')}</label>
            {scenes.length > 0 ? (
              <select
                className="form-select"
                value={scene}
                onChange={e => setScene(e.target.value)}
                disabled={scenesLoading}
              >
                <option value="">{t('common.notSet')}</option>
                {scenes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input
                className="form-input"
                value={scene}
                onChange={e => setScene(e.target.value)}
                placeholder={t('common.notSetPlaceholder')}
              />
            )}
            <span className="form-hint">{t('file.sceneHint')}</span>
          </div>

          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>{t('common.delete')}</button>
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>

        {confirm && (
          <div className="dialog-overlay" onClick={() => setConfirm(false)}>
            <div className="dialog" onClick={e => e.stopPropagation()}>
              <h3 className="dialog-title">{t('file.confirmDelete')}</h3>
              <div className="dialog-body">
                <p><span className="dialog-label">{t('dialog.file')}</span>{fileName}</p>
                <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                  {t('file.deleteWarning')}
                </p>
              </div>
              <div className="dialog-actions">
                <button className="btn btn-ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ws-detail-right">
        <ThumbnailPanel projectID={projectID} fileID={fileID} />
      </div>
    </div>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function FileDetailPage({ projectID, projectName, fileID, fileName, navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('workspace')
  const [currentFileName, setCurrentFileName] = useState(fileName)

  const tabs = [
    { id: 'workspace', label: t('tabs.workspaceList') },
    { id: 'settings',  label: t('tabs.settings') },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => navigate('projects')}>{t('breadcrumb.projects')}</button>
          <span className="breadcrumb-sep">›</span>
          <button className="breadcrumb-link" onClick={() => navigate('project', { id: projectID })}>{projectName}</button>
          <span className="breadcrumb-sep">›</span>
          <span>{currentFileName}</span>
        </div>
      </div>

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
