import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../lib/api'

// data_status: 0=なし 1=なしロック 2=あり 3=ありロック 4=削除 5=削除ロック
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
  const labels = {
    0: t('dataStatus.none'),
    2: t('dataStatus.available'),
    4: t('dataStatus.deleted'),
    6: t('dataStatus.corrupted'),
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

function JobDetailDialog({ job, onClose, onDeleted, onStatusChanged }) {
  const { t } = useTranslation()
  const [confirm, setConfirm]           = useState(false)
  const [confirmData, setConfirmData]   = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [locking, setLocking]           = useState(false)
  const [error, setError]               = useState('')
  const [dataStatus, setDataStatus]     = useState(job?.data_status ?? 0)
  useEffect(() => {
    if (job) setDataStatus(job.data_status ?? 0)
  }, [job])

  if (!job) return null

  const statusLabels = {
    completed: t('status.completed'),
    error:     t('status.error'),
    cancelled: t('status.cancelled'),
    running:   t('status.running'),
    waiting:   t('status.waiting'),
  }

  const status   = job.status || 'running'
  const isLocked = dataStatus % 2 === 1

  const handleLock = async () => {
    setLocking(true)
    setError('')
    try {
      if (isLocked) {
        await QueueApi.unlockJob({ id: job.id })
        const next = dataStatus - 1
        setDataStatus(next)
        if (onStatusChanged) onStatusChanged(job.id, next)
      } else {
        await QueueApi.lockJob({ id: job.id })
        const next = dataStatus + 1
        setDataStatus(next)
        if (onStatusChanged) onStatusChanged(job.id, next)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLocking(false)
    }
  }

  const handleDeleteData = async () => {
    setDeletingData(true)
    setError('')
    try {
      await QueueApi.deleteJobData({ id: job.id })
      setDataStatus(4)
      setConfirmData(false)
      if (onStatusChanged) onStatusChanged(job.id, 4)
    } catch (err) {
      setError(String(err))
    } finally {
      setDeletingData(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await QueueApi.deleteJob({ id: job.id })
      setConfirm(false)
      onClose()
      if (onDeleted) onDeleted(job.id)
    } catch (err) {
      setError(String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={() => { if (!confirm) onClose() }}>
      <div className="dialog dialog-wide" onClick={e => e.stopPropagation()}>
        <h3 className="dialog-title">{t('dialog.jobDetails')}</h3>

        <div className="dialog-body job-detail-body">
          <div className="job-detail-section">
            <Row label={t('dialog.status')}    value={<span className={`status-badge status-${status}`}>{statusLabels[status] ?? status}</span>} />
            <Row label={t('dialog.data')} value={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DataStatusBadge status={dataStatus} />
                <button className="btn btn-sm btn-ghost" onClick={handleLock} disabled={locking}>
                  {isLocked ? t('common.unlock') : t('common.lock')}
                </button>
              </div>
            } />
            <Row label={t('dialog.project')}  value={job.project_name} />
            <Row label={t('dialog.workspace')} value={job.workspace_name} />
          </div>

          <div className="job-detail-section">
            <Row label={t('dialog.scene')}    value={job.scene   || t('common.default')} />
            <Row label={t('dialog.camera')}  value={job.camera} />
            <Row label={t('dialog.engine')}  value={job.engine  || t('common.default')} />
            <Row label={t('dialog.frames')}  value={`${job.start_frame} – ${job.end_frame}${job.frame_step > 1 ? ` (${t('dialog.step')}${job.frame_step})` : ''}`} />
            <Row label={t('dialog.threads')}  value={job.thread === 0 ? t('common.automatic') : String(job.thread)} />
          </div>

          <div className="job-detail-section">
            <Row label={t('dialog.blender')}  value={job.blender_path} selectable />
            <Row label={t('dialog.file')} value={job.blender_file} selectable />
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
            <Row label={t('dialog.enrolledAt')} value={fmt(job.enqueued_at)} />
            <Row label={t('dialog.startedAt')} value={fmt(job.started_at)} />
            <Row label={t('dialog.completedAt')} value={fmt(job.completed_at)} />
            <Row label={t('dialog.duration')} value={duration(job.started_at, job.completed_at, t)} />
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
          <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={isLocked}>{t('common.delete')}</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => QueueApi.openLogWindow({ id: job.id })}>{t('job.showLog')}</button>
              <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default JobDetailDialog
