import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, WorkspaceApi } from '../../lib/api'

// ── ユーティリティ ────────────────────────────────────────
function dataStatusClass(s) {
  if (s % 2 === 1) return 'data-status-locked'
  if (s === 0)     return 'data-status-none'
  if (s === 2)     return 'data-status-available'
  if (s === 4)     return 'data-status-deleted'
  return ''
}

function DataStatusBadge({ status }) {
  const { t } = useTranslation()
  const labels = { 0: t('dataStatus.none'), 2: t('dataStatus.available'), 4: t('dataStatus.deleted') }
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

  const status   = job.status || 'completed'
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
          <Row label={t('dialog.engine')}  value={job.engine || t('common.default')} />
          <Row label={t('dialog.frames')}  value={`${job.start_frame} – ${job.end_frame}${job.frame_step > 1 ? ` (${t('dialog.step')}${job.frame_step})` : ''}`} />
          <Row label={t('dialog.threads')} value={job.thread === 0 ? t('common.automatic') : String(job.thread)} />
        </div>

        <div className="job-detail-section">
          <Row label={t('dialog.blender')}  value={job.blender_path} selectable />
          <Row label={t('dialog.file')}     value={job.blender_file} selectable />
          <Row label={t('dialog.output')}   value={job.output_dir}   selectable />
          <Row label={t('dialog.dataSize')} value={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={dataStatus >= 4 ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{formatBytes(job.disk_size)}</span>
              {dataStatus === 2 && (
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

  const handleCreateMovie = async () => {
    setMsg('')
    try {
      await WorkspaceApi.createMovie({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        jobID:       job.id,
      })
      setMsg(t('viewer.movieCreated'))
    } catch (e) { setMsg(String(e)) }
  }

  const filename = images[index] ? images[index].replace(/\\/g, '/').split('/').pop() : ''

  return (
    <div className="job-page-viewer">
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
          <button className="btn btn-sm btn-secondary" onClick={handleCreateMovie} disabled={settingThumb || images.length === 0}>
            {t('viewer.createMovie')}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={handleSetThumbnail} disabled={settingThumb || images.length === 0}>
            {settingThumb ? '...' : t('viewer.setAsThumbnail')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function JobPage({ job: initialJob, navigate, backPage, backParams }) {
  const { t } = useTranslation()
  const [tab, setTab]       = useState('detail')
  const [job, setJob]       = useState(initialJob)

  const handleDataStatusChanged = (next) => {
    setJob(prev => ({ ...prev, data_status: next }))
  }

  const handleDeleted = () => {
    navigate(backPage || 'projects', backParams || {})
  }

  const tabs = [
    { id: 'detail', label: t('tabs.jobDetail') },
    { id: 'render', label: t('tabs.renderResults') },
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
              <button className="breadcrumb-link" onClick={() => navigate(backPage, backParams)}>{bp.workspaceName}</button>
            </>
          )}
          <span className="breadcrumb-sep">›</span>
          <span>{job.workspace_name || t('breadcrumb.job')}</span>
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
      </div>
    </div>
  )
}

export default JobPage
