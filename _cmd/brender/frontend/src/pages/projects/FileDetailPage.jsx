import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, QueueApi, ProjectApi, BlenderApi, WorkDirApi, TagApi } from '../../lib/api'
import { useToast, useMessage } from '../../lib/toast'
import { onAppEvent } from '../../lib/appEvents'
import { formatDateFull, formatDuration } from '../../lib/dateFormat'
import Pagination from '../../components/Pagination'
import SortSelect from '../../components/SortSelect'
import Dialog from '../../components/Dialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import Breadcrumb from '../../components/Breadcrumb'
import NoteSection from '../../components/NoteSection'
import WorkspaceCreateDialog from '../../components/WorkspaceCreateDialog'
import TagInput from '../../components/TagInput'
import PermissionSection from '../../components/PermissionSection'
import { isWails } from '../../lib/api/_client'


// ── ワークスペースカード（サムネイル表示） ──────────────────
function WorkspaceCard({ projectID, fileID, ws, navigate, projectName, fileName, onRunClick, resolvingWsId, thumbnailMode, onSetThumbnail, workDirLocked, small, stale }) {
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
        {stale && <span className="stale-mark" title={t('file.fileChangedTooltip')}>!</span>}
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
  const [fileModifiedAt, setFileModifiedAt] = useState(null)
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
        if (group?.file?.file_modified_at) setFileModifiedAt(group.file.file_modified_at)
      })
      .catch(() => {})
  }

  const isStale = (ws) => {
    if (!fileModifiedAt || !ws.processed_at) return false
    return new Date(fileModifiedAt) > new Date(ws.processed_at)
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
                  <span className="ws-item-name">
                    {ws.name}
                    {isStale(ws) && <span className="stale-mark-inline" title={t('file.fileChangedTooltip')}>!</span>}
                  </span>
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
                stale={isStale(ws)}
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
        {confirm && (() => {
          const pv = confirm.preview
          const prev = pv.previous
          const fileNotModified = confirm.ws.processed_at && !isStale(confirm.ws)
          const allIdentical = prev && pv.scene === prev.scene && pv.engine === prev.engine
            && pv.start_frame === prev.start_frame && pv.end_frame === prev.end_frame
            && pv.frame_step === prev.frame_step && pv.samples === prev.samples
            && pv.resolution_x === prev.resolution_x && pv.resolution_y === prev.resolution_y
            && pv.camera === prev.camera && pv.output_format === prev.output_format
          const showPrev = fileNotModified && prev
          const Prev = ({ cur, prevVal }) => {
            if (!showPrev) return null
            const changed = String(cur) !== String(prevVal)
            return <span className={changed ? 'dialog-prev-changed' : 'dialog-prev'}>({t('render.previousValue')}: {prevVal || '-'})</span>
          }
          return <>
            {fileNotModified && (
              <p className="dialog-message dialog-message-warn">{t('render.fileNotModifiedWarning')}</p>
            )}
            {fileNotModified && allIdentical && (
              <p className="dialog-message dialog-message-danger">{t('render.identicalRenderWarning')}</p>
            )}
            <p><span className="dialog-label">{t('render.workspace')}</span>{confirm.ws.name}</p>
            <p>
              <span className="dialog-label">{t('render.engine')}</span>
              {pv.engine || <span style={{ opacity: 0.5 }}>{t('render.blendDefault')}</span>}
              <Prev cur={pv.engine} prevVal={prev?.engine} />
            </p>
            {pv.samples > 0 && <p><span className="dialog-label">{t('render.samples')}</span>{pv.samples}<Prev cur={pv.samples} prevVal={prev?.samples} /></p>}
            <p><span className="dialog-label">{t('render.scene')}</span>{pv.scene}<Prev cur={pv.scene} prevVal={prev?.scene} /></p>
            {pv.camera && <p><span className="dialog-label">{t('render.camera')}</span>{pv.camera}<Prev cur={pv.camera} prevVal={prev?.camera} /></p>}
            {(pv.resolution_x > 0 || pv.resolution_y > 0) && (
              <p><span className="dialog-label">{t('render.resolution')}</span>{pv.resolution_x} × {pv.resolution_y}
                {showPrev && <Prev cur={`${pv.resolution_x}×${pv.resolution_y}`} prevVal={`${prev.resolution_x}×${prev.resolution_y}`} />}
              </p>
            )}
            <p><span className="dialog-label">{t('render.frames')}</span>{pv.start_frame} – {pv.end_frame}
              {showPrev && <Prev cur={`${pv.start_frame}-${pv.end_frame}`} prevVal={`${prev.start_frame}-${prev.end_frame}`} />}
            </p>
            {pv.frame_step > 1 && <p><span className="dialog-label">{t('render.step')}</span>{pv.frame_step}<Prev cur={pv.frame_step} prevVal={prev?.frame_step} /></p>}
            {pv.output_format && <p><span className="dialog-label">{t('render.outputFormat')}</span>{pv.output_format}<Prev cur={pv.output_format} prevVal={prev?.output_format} /></p>}
          </>
        })()}
      </Dialog>
    </div>
  )
}

const HISTORY_PAGE_SIZE = 5

// ── 履歴タブ ──────────────────────────────────────────────
function HistoryTab({ projectID, fileID, navigate, projectName, fileName }) {
  const { t } = useTranslation()
  const [jobs, setJobs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE)

  const load = useCallback((p, ps) => {
    QueueApi.listJobsByProjectFilePaged({ projectID, fileID, page: p ?? page, pageSize: ps ?? pageSize })
      .then(result => {
        setJobs(result?.jobs || [])
        setTotal(result?.total || 0)
      })
      .catch(() => {})
  }, [projectID, fileID, page, pageSize])

  useEffect(() => { load() }, [load])

  useEffect(() => onAppEvent('queue:changed', () => load()), [load])

  const statusLabel = (s) => t(`status.${s || 'running'}`)

  const totalPages  = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs

  if (total === 0) {
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
                <span className="queue-history-name">{j.name || j.workspace_name}</span>
                <div className="queue-history-detail" style={{ marginTop: 4 }}>
                  {j.started_at && <span>{formatDateFull(j.started_at)}</span>}
                  {j.started_at && j.completed_at && <span>{formatDuration(j.started_at, j.completed_at, t)}</span>}
                </div>
              </div>
              <span className={`status-badge status-${j.status || 'running'}`}>{statusLabel(j.status)}</span>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onChange={p => setPage(p)} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={total} />
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
function SettingsTab({ projectID, fileID, fileName, role, onUpdated, onDeleted }) {
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
  const [forceDel, setForceDel]           = useState(false)
  const [missingScene, setMissingScene]       = useState('')
  const [missingCamera, setMissingCamera]     = useState('')
  const [missingEngine, setMissingEngine]     = useState('')
  const [convertedEngine, setConvertedEngine] = useState(null)
  const [fileTags, setFileTags]             = useState([])

  const isOwner  = role === 'owner'
  const isEditor = role === 'editor'
  const canEdit  = isOwner || isEditor  // editor 以上は保存可能
  const readOnly = !canEdit             // viewer / runner は設定閲覧のみ

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
    TagApi.getFileTags({ projectFileID: fileID })
      .then(tags => setFileTags(tags || []))
      .catch(() => setFileTags([]))
  }, [fileID])

  const handleBlenderChange = (installID) => {
    setBlenderID(installID)
    fetchToolData(installID)
  }

  const handleSceneChange = (val) => {
    setScene(val)
    setCamera('')
    setMissingScene('')
    setMissingCamera('')
  }

  useEffect(() => {
    if (toolLoading || !toolData) return
    const sceneList = toolData?.Scenes?.map(s => s.Name) || []
    const cameraList = toolData?.Cameras || []
    const engineList = toolData?.Engines || []

    if (scene && sceneList.length > 0 && !sceneList.includes(scene)) {
      setMissingScene(scene)
      setScene('')
      setCamera('')
    } else {
      setMissingScene('')
    }

    if (camera && cameraList.length > 0) {
      const filtered = scene
        ? cameraList.filter(c => c.Scenes && c.Scenes.includes(scene))
        : cameraList
      if (!filtered.some(c => c.Name === camera)) {
        setMissingCamera(camera)
        setCamera('')
      } else {
        setMissingCamera('')
      }
    } else {
      setMissingCamera('')
    }

    if (engine && engineList.length > 0 && !engineList.includes(engine)) {
      const keys = ['CYCLES', 'EEVEE', 'WORKBENCH']
      const savedUpper = engine.toUpperCase()
      const savedKey = keys.find(k => savedUpper.includes(k))
      if (savedKey) {
        const candidates = engineList.filter(e => e.toUpperCase().includes(savedKey))
        if (candidates.length === 1) {
          setConvertedEngine({ from: engine, to: candidates[0] })
          setMissingEngine('')
          setEngine(candidates[0])
          return
        }
      }
      setMissingEngine(engine)
      setConvertedEngine(null)
      setEngine('')
    } else {
      setMissingEngine('')
      setConvertedEngine(null)
    }
  }, [toolLoading])

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
    try {
      await ProjectApi.deleteFile({ fileID, force: forceDel })
      if (onDeleted) onDeleted()
    } catch (e) {
      const msg = String(e?.message ?? e)
      if (msg.includes('locked_jobs_exist')) {
        showError(t('file.lockedJobsExist'))
      } else {
        showError(msg)
      }
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
          {!isWails() && filePath && (() => {
            const norm = filePath.replace(/\\/g, '/')
            const expected = `${projectID}/${fileID}/${fileID}.blend`
            return !norm.endsWith(expected)
          })() && (
            <div className="pack-warning-bar">{t('file.serverIncompatible')}</div>
          )}
          <div className="form-row">
            <div className="form-field" style={{ flex: 2 }}>
              <label className="form-label">{t('file.displayName')} <span className="required">*</span></label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={readOnly}
              />
              {isWails() && (
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
              )}
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
                  disabled={readOnly}
                >
                  <option value={0}>{t('common.notSet')}</option>
                  {blenders.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.version || t('common.versionUnknown')})</option>
                  ))}
                </select>
              )}
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={blenderFixed} onChange={e => setBlenderFixed(e.target.checked)} disabled={readOnly} />
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
                  onChange={e => { setEngine(e.target.value); setMissingEngine(''); setConvertedEngine(null) }}
                  disabled={toolLoading || readOnly}
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
                  disabled={readOnly}
                />
              )}
              {missingEngine && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.engineMissing', { name: missingEngine })}</span>}
              {convertedEngine && <span className="form-hint" style={{ color: '#e0a030' }}>{t('workspace.engineConverted', { from: convertedEngine.from, to: convertedEngine.to })}</span>}
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={engineFixed} onChange={e => setEngineFixed(e.target.checked)} disabled={readOnly} />
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
                  disabled={toolLoading || readOnly}
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
                  disabled={readOnly}
                />
              )}
              {missingScene && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.sceneMissing', { name: missingScene })}</span>}
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={sceneFixed} onChange={e => setSceneFixed(e.target.checked)} disabled={readOnly} />
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
                onChange={e => { setCamera(e.target.value); setMissingCamera('') }}
                disabled={toolLoading || readOnly}
              >
                <option value="">{t('common.notSet')}</option>
                {allCameras
                  .filter(c => !scene || (c.Scenes && c.Scenes.includes(scene)))
                  .map(c => <option key={c.Name} value={c.Name}>{c.Name}</option>)
                }
              </select>
              {missingCamera && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.cameraMissing', { name: missingCamera })}</span>}
              <label className="form-checkbox-label" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={cameraFixed} onChange={e => setCameraFixed(e.target.checked)} disabled={readOnly} />
                <span style={{ marginLeft: 6 }}>{t('file.fixed')}</span>
              </label>
            </div>
          </div>

          <NoteSection value={note} onChange={setNote} disabled={readOnly} />

          {canEdit && (
          <div className="form-actions" style={isOwner ? undefined : { justifyContent: 'flex-end' }}>
            {isOwner && (
            <button className="btn btn-danger" onClick={() => { setForceDel(false); setConfirm(true) }}>{t('common.delete')}</button>
            )}
            <button className="btn btn-green" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
          )}
        </div>

        {isOwner && (
        <ConfirmDialog
          open={confirm}
          hold
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
          <label className="form-checkbox-label" style={{ marginTop: 12, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={forceDel} onChange={e => setForceDel(e.target.checked)} />
            {t('file.forceDeleteLabel')}
          </label>
        </ConfirmDialog>
        )}

        {isOwner && (
        <PermissionSection mode="file" resourceID={fileID} />
        )}
      </div>

      <div className="ws-detail-right">
        <ThumbnailPanel projectID={projectID} fileID={fileID} />
        <div style={{ marginTop: 20 }}>
          <h3 className="ws-detail-section-title">{t('tag.tags')}</h3>
          <TagInput
            projectFileID={fileID}
            tags={fileTags}
            onTagsChanged={setFileTags}
          />
        </div>
      </div>
    </div>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function FileDetailPage({ projectID, projectName: initialProjectName, fileID, fileName, initialTab, navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(initialTab || 'workspace')
  const [projectName, setProjectName] = useState(initialProjectName)
  const [currentFileName, setCurrentFileName] = useState(fileName)
  const [workDirStatus, setWorkDirStatus] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [fileRole, setFileRole] = useState('owner')

  useEffect(() => {
    // ファイル権限チェック + ロール取得
    ProjectApi.getFile({ fileID })
      .then(f => {
        if (f?.my_role) setFileRole(f.my_role)
      })
      .catch(err => {
        if (String(err).includes('access denied')) setAccessDenied(true)
      })
    // プロジェクト情報取得（パンくず名もAPIから取得して統一）
    ProjectApi.get({ id: projectID })
      .then(d => {
        if (d?.project?.name) setProjectName(d.project.name)
        WorkDirApi.list().then(dirs => {
          const wd = (dirs || []).find(w => w.id === d?.project?.work_dir_id)
          setWorkDirStatus(wd?.status || null)
        }).catch(() => {})
      })
      .catch(err => {
        if (String(err).includes('access denied')) setProjectName(t('permission.accessDeniedLabel'))
      })
  }, [projectID, fileID])

  if (accessDenied) {
    return <div className="page"><p className="setting-desc">{t('permission.accessDenied')}</p></div>
  }

  const tabs = [
    { id: 'workspace', label: t('tabs.workspaceList') },
    { id: 'settings',  label: t('tabs.fileSettings') },
  ]

  return (
    <div className="page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <Breadcrumb items={[
          { label: t('breadcrumb.projects'), onClick: () => navigate('projects') },
          { label: projectName, onClick: () => navigate('project', { id: projectID, initialTab: 'settings' }) },
          { label: currentFileName },
        ]} />
        <button className="back-to-list" onClick={() => navigate('project', { id: projectID, initialTab: 'workspace' })}>
          {t('breadcrumb.backToFileList')}
        </button>
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
            role={fileRole}
            onUpdated={f => setCurrentFileName(f.name)}
            onDeleted={() => navigate('project', { id: projectID })}
          />
        )}
      </div>
    </div>
  )
}

export default FileDetailPage
