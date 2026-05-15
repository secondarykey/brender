import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, WorkspaceApi } from '../../lib/api'
import { onAppEvent } from '../../lib/appEvents'

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'])
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
  return ''
}

function DataStatusBadge({ status }) {
  const { t } = useTranslation()
  const labels = { 0: t('dataStatus.none'), 2: t('dataStatus.available'), 4: t('dataStatus.deleted'), 6: t('dataStatus.corrupted') }
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
  const [confirm, setConfirm]           = useState(false)
  const [confirmData, setConfirmData]   = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [locking, setLocking]           = useState(false)
  const [error, setError]               = useState('')
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
    setLocking(true); setError('')
    try {
      if (isLocked) {
        await QueueApi.unlockJob({ id: job.id })
        updateStatus(dataStatus - 1)
      } else {
        await QueueApi.lockJob({ id: job.id })
        updateStatus(dataStatus + 1)
      }
    } catch (err) { setError(String(err)) }
    finally { setLocking(false) }
  }

  const handleDeleteData = async () => {
    setDeletingData(true); setError('')
    try {
      await QueueApi.deleteJobData({ id: job.id })
      setConfirmData(false)
      updateStatus(4)
    } catch (err) { setError(String(err)) }
    finally { setDeletingData(false) }
  }

  const handleDelete = async () => {
    setDeleting(true); setError('')
    try {
      await QueueApi.deleteJob({ id: job.id })
      setConfirm(false)
      onDeleted()
    } catch (err) { setError(String(err)) }
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

        {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {confirmData ? (
        <div className="job-delete-confirm">
          <span className="job-delete-confirm-msg">{t('job.deleteDataWarning')}</span>
          <div className="dialog-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setConfirmData(false)} disabled={deletingData}>{t('common.cancel')}</button>
            <button className="btn btn-danger" onClick={handleDeleteData} disabled={deletingData}>
              {deletingData ? t('common.deleting') : t('job.deleteDataAction')}
            </button>
          </div>
        </div>
      ) : confirm ? (
        <div className="job-delete-confirm">
          <span className="job-delete-confirm-msg">{t('job.deleteWarning')}</span>
          <div className="dialog-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)} disabled={deleting}>{t('common.cancel')}</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('common.deleting') : t('common.delete')}
            </button>
          </div>
        </div>
      ) : (
        <div className="dialog-actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={isLocked}>{t('common.delete')}</button>
          <button className="btn btn-ghost" onClick={() => QueueApi.openLogWindow({ id: job.id })}>{t('job.showLog')}</button>
        </div>
      )}
    </div>
  )
}

// ── レンダリング結果タブ ───────────────────────────────────
function RenderResultTab({ job }) {
  const { t } = useTranslation()
  const [images, setImages]             = useState([])
  const [index, setIndex]               = useState(0)
  const [imgSrc, setImgSrc]             = useState('')
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingImg, setLoadingImg]     = useState(false)
  const [error, setError]               = useState('')
  const [playing, setPlaying]           = useState(false)
  const [loop, setLoop]                 = useState(false)
  const [msg, setMsg]                   = useState('')
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
    setSettingThumb(true); setMsg('')
    try {
      await WorkspaceApi.setThumbnail({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        imagePath:   images[index],
      })
      setMsg(t('viewer.thumbnailSet'))
    } catch (e) { setMsg(String(e)) }
    finally { setSettingThumb(false) }
  }

  useEffect(() => {
    return onAppEvent('movie:created', (data) => {
      if (data.job_id !== job.id) return
      setCreatingMovie(false)
      if (data.error) {
        setMsg(data.error)
      } else {
        setMoviePath(data.path || '')
        setMsg(t('viewer.movieCreated'))
      }
    })
  }, [job.id, t])

  const handleCreateMovie = async () => {
    setMsg('')
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
      setMsg(String(e))
    }
  }

  const handlePlayMovie = () => {
    if (moviePath) QueueApi.openMovieWindow({ path: moviePath })
  }

  const filename = images[index] ? images[index].replace(/\\/g, '/').split('/').pop() : ''

  return (
    <div className="job-page-viewer">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button className="btn btn-sm btn-secondary" onClick={handleSetThumbnail} disabled={settingThumb || images.length === 0}>
          {settingThumb ? '...' : t('viewer.setAsThumbnail')}
        </button>
      </div>

      {msg && <div className="image-viewer-message">{msg}</div>}

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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {moviePath && (
            <button className="btn btn-sm btn-primary" onClick={handlePlayMovie}>
              {t('viewer.playMovie')}
            </button>
          )}
          <button className="btn btn-sm btn-green" onClick={handleCreateMovie} disabled={creatingMovie || images.length === 0}>
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
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!job) return
    setLoading(true)
    setError('')
    QueueApi.listJobFiles({ id: job.id })
      .then(list => { setFiles(list || []); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [job])

  if (loading) return <p className="setting-desc">{t('common.loading')}</p>
  if (error)   return <div className="error-msg">{error}</div>
  if (files.length === 0) return <p className="empty-msg">{t('job.noFiles')}</p>

  return (
    <div className="job-data-view">
      <p className="setting-desc job-data-path">{job.output_dir}</p>
      <table className="queue-table">
        <thead>
          <tr>
            <th>{t('table.name')}</th>
            <th style={{ textAlign: 'right' }}>{t('dialog.dataSize')}</th>
            <th>{t('dialog.completedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {files.map(f => {
            const canPlay = !f.is_dir && isVideoFile(f.name)
            return (
              <tr
                key={f.name}
                className={`${f.is_dir ? 'job-data-row-dir' : ''} ${canPlay ? 'job-data-row-video' : ''}`.trim()}
                onClick={canPlay ? () => QueueApi.openMovieWindow({ path: f.path }) : undefined}
                title={canPlay ? t('viewer.playMovie') : undefined}
              >
                <td>{f.is_dir ? '📁 ' : canPlay ? '▶ ' : ''}{f.name}</td>
                <td style={{ textAlign: 'right' }}>{f.is_dir ? '—' : formatBytes(f.size)}</td>
                <td className="date-cell">{new Date(f.mod_time).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function JobPage({ job: initialJob, navigate, backPage, backParams }) {
  const { t } = useTranslation()
  const hasData = initialJob && (initialJob.data_status === 2 || initialJob.data_status === 3 || initialJob.data_status === 6 || initialJob.data_status === 7)
  const [tab, setTab]       = useState(hasData ? 'render' : 'detail')
  const [job, setJob]       = useState(initialJob)

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

  const bp = backParams || {}

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => navigate('projects')}>{t('breadcrumb.projects')}</button>
          {bp.projectName && (
            <>
              <span className="breadcrumb-sep">›</span>
              <button className="breadcrumb-link" onClick={() => navigate('project', { id: bp.projectID })}>{bp.projectName}</button>
            </>
          )}
          {bp.fileName && (
            <>
              <span className="breadcrumb-sep">›</span>
              <button className="breadcrumb-link" onClick={() => navigate('file', { projectID: bp.projectID, projectName: bp.projectName, fileID: bp.fileID, fileName: bp.fileName })}>{bp.fileName}</button>
            </>
          )}
          {bp.workspaceName && (
            <>
              <span className="breadcrumb-sep">›</span>
              {bp.workspaceID
                ? <button className="breadcrumb-link" onClick={() => navigate(backPage, backParams)}>{bp.workspaceName}</button>
                : <span>{bp.workspaceName}</span>
              }
            </>
          )}
          <span className="breadcrumb-sep">›</span>
          <span>{t('breadcrumb.jobResult')}</span>
        </div>
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
