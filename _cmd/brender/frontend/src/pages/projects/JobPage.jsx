import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { QueueApi, WorkspaceApi } from '../../lib/api'
import { onAppEvent } from '../../lib/appEvents'
import { useToast, useMessage } from '../../lib/toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import Breadcrumb from '../../components/Breadcrumb'

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'])
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.exr', '.tiff', '.tif', '.bmp', '.hdr', '.webp', '.tga'])
const LOG_EXTS   = new Set(['.log'])
function isVideoFile(name) {
  const ext = name.lastIndexOf('.')
  return ext !== -1 && VIDEO_EXTS.has(name.slice(ext).toLowerCase())
}

// ── ユーティリティ ────────────────────────────────────────
function dataStatusClass(s) {
  if (s % 2 === 1) return 'data-status-locked'
  if (s === 0)     return 'data-status-none'
  if (s === 2)     return 'data-status-available'
  if (s === 4)     return 'data-status-deleted'
  if (s === 6)     return 'data-status-corrupted'
  if (s === 8)     return 'data-status-modified'
  return ''
}

function DataStatusBadge({ status }) {
  const { t } = useTranslation()
  const labels = {
    0: t('dataStatus.none'),
    2: t('dataStatus.available'),
    4: t('dataStatus.deleted'),
    6: t('dataStatus.corrupted'),
    8: t('dataStatus.modified'),
  }
  const label = status % 2 === 1 ? t('dataStatus.locked') : (labels[status] ?? String(status))
  return <span className={`data-status-badge ${dataStatusClass(status)}`}>{label}</span>
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${i === 0 ? val : val.toFixed(2)} ${units[i]}`
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function duration(startedAt, completedAt, t) {
  if (!startedAt || !completedAt) return '—'
  const sec = Math.floor((new Date(completedAt) - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}${t('time.seconds')}`
  if (sec < 3600) return `${Math.floor(sec / 60)}${t('time.minutes')}${sec % 60}${t('time.seconds')}`
  return `${Math.floor(sec / 3600)}${t('time.hours')}${Math.floor((sec % 3600) / 60)}${t('time.minutes')}`
}

function Row({ label, value, selectable }) {
  if (!value && value !== 0) return null
  return (
    <div className="job-detail-row">
      <span className="job-detail-label">{label}</span>
      <span className={`job-detail-value${selectable ? ' job-detail-value-selectable' : ''}`}>{value}</span>
    </div>
  )
}

// ── 詳細タブ ──────────────────────────────────────────────
function DetailTab({ job, onDeleted, onDataStatusChanged }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [confirm, setConfirm]           = useState(false)
  const [confirmData, setConfirmData]   = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [locking, setLocking]           = useState(false)
  const [dataStatus, setDataStatus]     = useState(job?.data_status ?? 0)

  useEffect(() => { if (job) setDataStatus(job.data_status ?? 0) }, [job])

  const statusLabels = {
    completed: t('status.completed'),
    error:     t('status.error'),
    cancelled: t('status.cancelled'),
    running:   t('status.running'),
    waiting:   t('status.waiting'),
  }

  const status   = job.status || 'running'
  const isLocked = dataStatus % 2 === 1

  const updateStatus = (next) => {
    setDataStatus(next)
    onDataStatusChanged(next)
  }

  const handleLock = async () => {
    setLocking(true); showError('')
    try {
      if (isLocked) {
        await QueueApi.unlockJob({ id: job.id })
        updateStatus(dataStatus - 1)
      } else {
        await QueueApi.lockJob({ id: job.id })
        updateStatus(dataStatus + 1)
      }
    } catch (err) { showError(String(err)) }
    finally { setLocking(false) }
  }

  const handleDeleteData = async () => {
    setDeletingData(true); showError('')
    try {
      await QueueApi.deleteJobData({ id: job.id })
      setConfirmData(false)
      updateStatus(4)
    } catch (err) { showError(String(err)) }
    finally { setDeletingData(false) }
  }

  const handleDelete = async () => {
    setDeleting(true); showError('')
    try {
      await QueueApi.deleteJob({ id: job.id })
      setConfirm(false)
      onDeleted()
    } catch (err) { showError(String(err)) }
    finally { setDeleting(false) }
  }

  return (
    <div className="job-page-detail">
      <div className="job-detail-body">
        <div className="job-detail-section">
          <Row label={t('dialog.status')} value={
            <span className={`status-badge status-${status}`}>{statusLabels[status] ?? status}</span>
          } />
          <Row label={t('dialog.data')} value={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DataStatusBadge status={dataStatus} />
              <button className="btn btn-sm btn-ghost" onClick={handleLock} disabled={locking}>
                {isLocked ? t('common.unlock') : t('common.lock')}
              </button>
            </div>
          } />
          <Row label={t('dialog.project')}   value={job.project_name} />
          <Row label={t('dialog.workspace')} value={job.workspace_name} />
        </div>

        <div className="job-detail-section">
          <Row label={t('dialog.scene')}   value={job.scene  || t('common.default')} />
          <Row label={t('dialog.camera')}  value={job.camera} />
          <Row label={t('dialog.engine')}  value={job.engine || t('common.default')} />
          <Row label={t('dialog.frames')}  value={`${job.start_frame} – ${job.end_frame}${job.frame_step > 1 ? ` (${t('dialog.step')}${job.frame_step})` : ''}`} />
          <Row label={t('dialog.threads')} value={job.thread === 0 ? t('common.automatic') : String(job.thread)} />
          <Row label={t('dialog.samples')}    value={job.samples === 0 ? t('common.default') : String(job.samples)} />
          <Row label={t('dialog.resolution')} value={(job.resolution_x > 0 && job.resolution_y > 0) ? `${job.resolution_x}×${job.resolution_y}` : t('common.default')} />
        </div>

        <div className="job-detail-section">
          <Row label={t('dialog.blender')}  value={job.blender_path} selectable />
          <Row label={t('dialog.file')}     value={job.blender_file} selectable />
          <Row label={t('dialog.output')}   value={job.output_dir}   selectable />
          <Row label={t('dialog.dataSize')} value={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={dataStatus >= 4 ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{formatBytes(job.disk_size)}</span>
              {(dataStatus === 2 || dataStatus === 6) && (
                <button className="btn btn-sm btn-danger" onClick={() => setConfirmData(true)} disabled={isLocked}>
                  {t('common.deleteData')}
                </button>
              )}
            </div>
          } />
        </div>

        <div className="job-detail-section">
          <Row label={t('dialog.enrolledAt')}  value={fmt(job.enqueued_at)} />
          <Row label={t('dialog.startedAt')}   value={fmt(job.started_at)} />
          <Row label={t('dialog.completedAt')} value={fmt(job.completed_at)} />
          <Row label={t('dialog.duration')}    value={duration(job.started_at, job.completed_at, t)} />
        </div>

        {status === 'error' && job.error_msg && (
          <div className="job-detail-error">{job.error_msg}</div>
        )}
      </div>

      <div className="dialog-actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={isLocked}>{t('common.delete')}</button>
        <button className="btn btn-ghost" onClick={() => QueueApi.openLogWindow({ id: job.id })}>{t('job.showLog')}</button>
      </div>

      <ConfirmDialog
        open={confirm}
        title={t('common.delete')}
        onCancel={() => setConfirm(false)}
        onConfirm={handleDelete}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
      >
        <p>{t('job.deleteWarning')}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmData}
        title={t('common.deleteData')}
        onCancel={() => setConfirmData(false)}
        onConfirm={handleDeleteData}
        confirmLabel={deletingData ? t('common.deleting') : t('job.deleteDataAction')}
        busy={deletingData}
      >
        <p>{t('job.deleteDataWarning')}</p>
      </ConfirmDialog>
    </div>
  )
}

// ── レンダリング結果タブ ───────────────────────────────────
function RenderResultTab({ job }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [images, setImages]             = useState([])
  const [index, setIndex]               = useState(0)
  const [imgSrc, setImgSrc]             = useState('')
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingImg, setLoadingImg]     = useState(false)
  const [error, setError]               = useState('')
  const [playing, setPlaying]           = useState(false)
  const [loop, setLoop]                 = useState(false)
  const [settingThumb, setSettingThumb] = useState(false)
  const [moviePath, setMoviePath]       = useState('')
  const [creatingMovie, setCreatingMovie] = useState(false)
  const playingRef = useRef(false)
  const loopRef    = useRef(false)

  const stopPlay = () => { playingRef.current = false; setPlaying(false) }
  const toggleLoop = () => { const v = !loopRef.current; loopRef.current = v; setLoop(v) }

  useEffect(() => {
    if (!job) return
    stopPlay()
    setLoadingList(true); setError(''); setImages([]); setIndex(0); setImgSrc('')
    QueueApi.listJobImages({ id: job.id })
      .then(list => { setImages(list || []); setLoadingList(false) })
      .catch(err => { setError(String(err)); setLoadingList(false) })
    QueueApi.listJobFiles({ id: job.id })
      .then(files => {
        const movie = (files || []).find(f => !f.is_dir && /^movie\./i.test(f.name) && isVideoFile(f.name))
        if (movie) setMoviePath(movie.path)
      })
      .catch(() => {})
  }, [job])

  useEffect(() => {
    if (images.length === 0) return
    setLoadingImg(true)
    QueueApi.getImageBase64({ path: images[index] })
      .then(src => {
        setImgSrc(src); setLoadingImg(false)
        if (playingRef.current) {
          setIndex(prev => {
            if (prev < images.length - 1) return prev + 1
            if (loopRef.current) return 0
            playingRef.current = false; setPlaying(false)
            return prev
          })
        }
      })
      .catch(err => { setError(String(err)); setLoadingImg(false); stopPlay() })
  }, [images, index])

  const handleTogglePlay = () => {
    if (playing) { stopPlay(); return }
    playingRef.current = true; setPlaying(true)
    if (index >= images.length - 1) setIndex(0)
    else if (!loadingImg) setIndex(prev => prev + 1)
  }

  const handleSetThumbnail = async () => {
    if (settingThumb || !images[index]) return
    setSettingThumb(true)
    try {
      await WorkspaceApi.setThumbnail({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        imagePath:   images[index],
      })
      showToast(t('viewer.thumbnailSet'))
    } catch (e) { showError(String(e)) }
    finally { setSettingThumb(false) }
  }

  useEffect(() => {
    return onAppEvent('movie:created', (data) => {
      if (data.job_id !== job.id) return
      setCreatingMovie(false)
      if (data.error) {
        showError(data.error)
      } else {
        setMoviePath(data.path || '')
        showToast(t('viewer.movieCreated'))
      }
    })
  }, [job.id, t, showToast, showError])

  const handleCreateMovie = async () => {
    showError('')
    setCreatingMovie(true)
    try {
      await WorkspaceApi.createMovie({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        jobID:       job.id,
      })
    } catch (e) {
      setCreatingMovie(false)
      showError(String(e))
    }
  }

  const handlePlayMovie = () => {
    if (moviePath) QueueApi.openMovieWindow({ path: moviePath })
  }

  const filename = images[index] ? images[index].replace(/\\/g, '/').split('/').pop() : ''

  return (
    <div className="job-page-viewer">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button className="btn btn-sm btn-outline" onClick={handleSetThumbnail} disabled={settingThumb || images.length === 0}>
          {settingThumb ? '...' : t('viewer.setAsThumbnail')}
        </button>
      </div>

      <div className="image-viewer-body">
        {loadingList && <div className="image-viewer-loading">{t('common.loading')}</div>}
        {imgSrc && <img src={imgSrc} alt={filename} className="image-viewer-img" />}
        {!loadingList && !imgSrc && !error && images.length === 0 && (
          <div className="image-viewer-empty">{t('viewer.noImages')}</div>
        )}
        {error && <div className="error-msg">{error}</div>}
      </div>

      <div className="image-viewer-controls" style={{ visibility: images.length > 0 ? 'visible' : 'hidden' }}>
        <span className="image-viewer-filename" title={filename}>
          {filename}{loadingImg && <span className="image-viewer-loading-inline"> {t('common.loading')}</span>}
        </span>
        <div className="image-viewer-slider-row">
          <input
            type="range" min={0} max={Math.max(0, images.length - 1)} value={index}
            onChange={e => { stopPlay(); setIndex(Number(e.target.value)) }}
            className="image-viewer-slider" disabled={images.length <= 1}
          />
          <span className="image-viewer-counter">{images.length > 0 ? `${index + 1} / ${images.length}` : '— / —'}</span>
        </div>
      </div>

      <div className="dialog-actions" style={{ justifyContent: 'space-between', visibility: images.length > 0 ? 'visible' : 'hidden', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-ghost" onClick={handleTogglePlay} disabled={images.length <= 1}>
            {playing ? t('viewer.stop') : t('viewer.play')}
          </button>
          <button
            className={`btn btn-sm ${loop ? '' : 'btn-ghost'} image-viewer-loop-btn`}
            onClick={toggleLoop} disabled={images.length <= 1} title={t('common.loop')}
          >⟳ {t('common.loop')}</button>
          {moviePath && (
            <button className="btn btn-sm" onClick={handlePlayMovie}>
              {t('viewer.playMovie')}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-sm btn-green" onClick={handleCreateMovie} disabled={creatingMovie || images.length <= 1}>
            {creatingMovie ? t('viewer.movieCreating') : t('viewer.createMovie')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── データ表示タブ ────────────────────────────────────────
function DataViewTab({ job }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [files, setFiles]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(new Set())
  const [downloading, setDownloading]   = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!job) return
    setLoading(true)
    showError('')
    setSelected(new Set())
    QueueApi.listJobFiles({ id: job.id })
      .then(list => { setFiles(list || []); setLoading(false) })
      .catch(err => { showError(String(err)); setLoading(false) })
  }, [job])

  const selectableFiles = files.filter(f => !f.is_dir)
  const allSelected     = selectableFiles.length > 0 && selectableFiles.every(f => selected.has(f.path))
  const someSelected    = selectableFiles.some(f => selected.has(f.path))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableFiles.map(f => f.path)))
    }
  }

  const selectByExts = (exts) => {
    const paths = selectableFiles.filter(f => {
      const dot = f.name.lastIndexOf('.')
      return dot !== -1 && exts.has(f.name.slice(dot).toLowerCase())
    }).map(f => f.path)
    setSelected(prev => new Set([...prev, ...paths]))
  }

  const toggleFile = (path) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const handleDownloadAll = async () => {
    const savePath = await Dialogs.SaveFile({
      DefaultFilename: job.id + '.zip',
      Filters: [{ DisplayName: 'ZIP Archive', Pattern: '*.zip' }],
    })
    if (!savePath) return
    setDownloading(true); showError('')
    try {
      await QueueApi.zipJobData({ id: job.id, savePath })
    } catch (err) {
      showError(String(err))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadSelected = async () => {
    const savePath = await Dialogs.SaveFile({
      DefaultFilename: job.id + '_selected.zip',
      Filters: [{ DisplayName: 'ZIP Archive', Pattern: '*.zip' }],
    })
    if (!savePath) return
    setDownloading(true); showError('')
    try {
      await QueueApi.zipJobSelectedFiles({ id: job.id, filePaths: [...selected], savePath })
    } catch (err) {
      showError(String(err))
    } finally {
      setDownloading(false)
    }
  }

  const handleDeleteSelected = async () => {
    setDeleting(true); showError('')
    try {
      await QueueApi.deleteJobFiles({ id: job.id, filePaths: [...selected] })
      setSelected(new Set())
      const list = await QueueApi.listJobFiles({ id: job.id })
      setFiles(list || [])
      setConfirmDelete(false)
    } catch (err) {
      showError(String(err))
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="setting-desc">{t('common.loading')}</p>
  if (files.length === 0) return <p className="empty-msg">{t('job.noFiles')}</p>

  const isLocked    = job && job.data_status % 2 === 1
  const canDownload = job && [2, 3, 6, 7, 8, 9].includes(job.data_status)

  return (
    <div className="job-data-view">
      <div style={{ marginBottom: 8 }}>
        <p className="setting-desc job-data-path" style={{ margin: 0 }}>{job.output_dir}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={handleDownloadSelected} disabled={downloading || !someSelected}>
            {downloading ? t('common.downloading') : `${t('common.downloadZip')}${someSelected ? ` (${selected.size})` : ''}`}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => selectByExts(IMAGE_EXTS)}>{t('job.filterImage')}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => selectByExts(VIDEO_EXTS)}>{t('job.filterVideo')}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => selectByExts(LOG_EXTS)}>{t('job.filterLog')}</button>
        </div>
        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)} disabled={deleting || isLocked || !someSelected}>
          {deleting ? t('common.deleting') : `${t('common.deleteSelected')}${someSelected ? ` (${selected.size})` : ''}`}
        </button>
      </div>
      <table className="queue-table">
        <thead>
          <tr>
            <th style={{ width: 32, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={toggleAll}
                title={allSelected ? t('common.deselectAll') : t('common.selectAll')}
              />
            </th>
            <th>{t('table.name')}</th>
            <th style={{ textAlign: 'right' }}>{t('dialog.dataSize')}</th>
            <th>{t('table.updatedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {files.map(f => {
            const canPlay = !f.is_dir && isVideoFile(f.name)
            const isSelected = !f.is_dir && selected.has(f.path)
            return (
              <tr
                key={f.name}
                className={`${f.is_dir ? 'job-data-row-dir' : ''} ${canPlay ? 'job-data-row-video' : ''} ${isSelected ? 'job-data-row-selected' : ''}`.trim()}
                onClick={canPlay ? () => QueueApi.openMovieWindow({ path: f.path }) : undefined}
                title={canPlay ? t('viewer.playMovie') : undefined}
              >
                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  {!f.is_dir && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFile(f.path)}
                    />
                  )}
                </td>
                <td>{f.is_dir ? '📁 ' : canPlay ? '▶ ' : ''}{f.name}</td>
                <td style={{ textAlign: 'right' }}>{f.is_dir ? '—' : formatBytes(f.size)}</td>
                <td className="date-cell">{new Date(f.mod_time).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={confirmDelete}
        title={t('common.deleteSelected')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteSelected}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
      >
        <p>{t('common.confirmDeleteFiles')}</p>
      </ConfirmDialog>
    </div>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function JobPage({ job: initialJob, navigate, backPage, backParams, initialTab }) {
  const { t } = useTranslation()
  const hasData = initialJob && [2, 3, 6, 7, 8, 9].includes(initialJob.data_status)
  const [tab, setTab]       = useState(hasData ? 'render' : 'detail')
  const [job, setJob]       = useState(initialJob)

  useLayoutEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [])

  useEffect(() => {
    return onAppEvent('queue:changed', () => {
      QueueApi.listJobsByWorkspace({ projectID: initialJob.project_id, workspaceID: initialJob.workspace_id })
        .then(list => {
          const updated = (list || []).find(j => j.id === initialJob.id)
          if (updated) setJob(updated)
        })
        .catch(() => {})
    })
  }, [initialJob.id, initialJob.project_id, initialJob.workspace_id])

  const handleDataStatusChanged = (next) => {
    setJob(prev => ({ ...prev, data_status: next }))
  }

  const handleDeleted = () => {
    navigate(backPage || 'projects', backParams || {})
  }

  const tabs = [
    { id: 'render', label: t('tabs.renderResults') },
    { id: 'data',   label: t('tabs.dataView') },
    { id: 'detail', label: t('tabs.jobResult') },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <Breadcrumb items={[
          { label: t('breadcrumb.projects'), onClick: () => navigate('projects') },
          { label: job.project_name, onClick: () => navigate('project', { id: job.project_id }) },
          { label: job.file_name,    onClick: () => navigate('file', { projectID: job.project_id, projectName: job.project_name, fileID: job.project_file_id, fileName: job.file_name }) },
          { label: job.workspace_name, onClick: () => navigate('workspace', { projectID: job.project_id, projectName: job.project_name, fileID: job.project_file_id, fileName: job.file_name, workspaceID: job.workspace_id }) },
          { label: t('breadcrumb.jobResult') },
        ].filter(Boolean)} />
      </div>

      <div className="tab-nav">
        {tabs.map(tb => (
          <button key={tb.id} className={`tab-btn${tab === tb.id ? ' active' : ''}`} onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'detail' && (
          <DetailTab
            job={job}
            onDeleted={handleDeleted}
            onDataStatusChanged={handleDataStatusChanged}
          />
        )}
        {tab === 'render' && (
          <RenderResultTab job={job} />
        )}
        {tab === 'data' && (
          <DataViewTab job={job} />
        )}
      </div>
    </div>
  )
}

export default JobPage
