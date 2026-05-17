import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../lib/api'
import Dialog from './Dialog'
import ConfirmDialog from './ConfirmDialog'

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

function JobDetailDialog({ job, onClose, onDeleted, onStatusChanged, navigate }) {
  const { t } = useTranslation()
  const [confirm, setConfirm]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [locking, setLocking]   = useState(false)
  const [error, setError]       = useState('')
  const [dataStatus, setDataStatus] = useState(job?.data_status ?? 0)
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
    <>
      <Dialog
        open
        wide
        title={t('dialog.jobDetails')}
        onClose={onClose}
        closeOnBackdrop={!confirm}
        message={error || undefined}
        bodyClassName="job-detail-body"
        actions={
          <>
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => setConfirm(true)} disabled={isLocked}>{t('common.delete')}</button>
            <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
          </>
        }
      >
        <div className="job-detail-section">
          <Row label={t('dialog.status')} value={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
              <span className={`status-badge status-${status}`}>{statusLabels[status] ?? status}</span>
              <button className="btn btn-outline btn-sm" onClick={() => QueueApi.openLogWindow({ id: job.id })}>{t('job.showLog')}</button>
            </div>
          } />
          <Row label={t('dialog.data')} value={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DataStatusBadge status={dataStatus} />
              <button className="btn btn-sm btn-ghost" onClick={handleLock} disabled={locking}>
                {isLocked ? t('common.unlock') : t('common.lock')}
              </button>
            </div>
          } />
          {navigate && (
            <Row label={t('dialog.jobName')} value={
              <button className="link-btn" onClick={() => { onClose(); navigate('job', { job, backPage: 'settings', backParams: { tab: 'jobManagement' } }) }}>{job.name || '—'}</button>
            } />
          )}
        </div>

        <div className="job-detail-section">
          <Row label={t('dialog.blender')}    value={job.blender_path} selectable />
          <Row label={t('dialog.file')}       value={job.blender_file} selectable />
          <Row label={t('dialog.scene')}      value={job.scene   || t('common.default')} />
          <Row label={t('dialog.camera')}     value={job.camera} />
          <Row label={t('dialog.engine')}     value={job.engine  || t('common.default')} />
          <Row label={t('dialog.frames')}     value={`${job.start_frame} – ${job.end_frame}${job.frame_step > 1 ? ` (${t('dialog.step')}${job.frame_step})` : ''}`} />
          <Row label={t('dialog.threads')}    value={job.thread === 0 ? t('common.automatic') : String(job.thread)} />
          <Row label={t('dialog.samples')}    value={job.samples === 0 ? t('common.default') : String(job.samples)} />
          <Row label={t('dialog.resolution')} value={(job.resolution_x > 0 && job.resolution_y > 0) ? `${job.resolution_x}×${job.resolution_y}` : t('common.default')} />
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
      </Dialog>

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
    </>
  )
}

export default JobDetailDialog
