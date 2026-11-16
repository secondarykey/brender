import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../../../lib/api'
import { useToast, useMessage } from '../../../lib/toast'
import { roleAtLeast } from '../../../lib/roles'
import { formatDateFull } from '../../../lib/dateFormat'
import ConfirmDialog from '../../../components/ConfirmDialog'
import DataStatusBadge from './DataStatusBadge'
import { isJobLocked, formatBytes, jobDuration } from './jobFiles'

function Row({ label, value, selectable }) {
  if (!value && value !== 0) return null
  return (
    <div className="job-detail-row">
      <span className="job-detail-label">{label}</span>
      <span className={`job-detail-value${selectable ? ' job-detail-value-selectable' : ''}`}>{value}</span>
    </div>
  )
}

// 実行結果の「詳細」タブ。左: 名前とメモの編集・削除 / 右: 状態・設定・パス・時刻。
// runner 以上が保存・削除・ロックの切り替えをできる（viewer は見るだけ）。
//   onDataStatusChanged … ロックを切り替えたとき（ページの job を合わせる）
export default function JobDetailTab({ job, onDeleted, onDataStatusChanged, role }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [confirm, setConfirm]           = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [locking, setLocking]           = useState(false)
  const [dataStatus, setDataStatus]     = useState(job?.data_status ?? 0)
  const [metaName, setMetaName]         = useState(job?.name || '')
  const [metaNote, setMetaNote]         = useState(job?.note || '')
  const [savingMeta, setSavingMeta]     = useState(false)
  const savedMeta = useRef({ name: job?.name || '', note: job?.note || '' })

  const canModify = roleAtLeast(role, 'runner')
  const readOnly  = !canModify

  const isMetaDirty = metaName !== savedMeta.current.name || metaNote !== savedMeta.current.note

  const handleSaveMeta = async () => {
    setSavingMeta(true)
    try {
      await QueueApi.updateJobMeta({ id: job.id, name: metaName, note: metaNote })
      savedMeta.current = { name: metaName, note: metaNote }
      showToast(t('common.saved'))
    } catch (e) { showError(String(e)) }
    finally { setSavingMeta(false) }
  }

  useEffect(() => { if (job) setDataStatus(job.data_status ?? 0) }, [job])

  const status   = job.status || 'running'
  const isLocked = isJobLocked(dataStatus)

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
    <div className="ws-detail-split">
      <div className="ws-detail-left" style={{ flex: 2 }}>
        <div className="form form-field" style={{ gap: 16 }}>
          <div className="form-field">
            <label className="form-label">{t('job.name')}</label>
            <input
              type="text" className="form-input" style={{ width: '100%' }}
              value={metaName}
              onChange={e => setMetaName(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="form-field">
            <label className="form-label">{t('job.note')}</label>
            <textarea
              className="form-input"
              style={{ width: '100%', minHeight: 140, resize: 'vertical' }}
              value={metaNote}
              onChange={e => setMetaNote(e.target.value)}
              placeholder={t('job.notePlaceholder')}
              disabled={readOnly}
            />
          </div>
        </div>
        {canModify && (
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={isLocked}>{t('common.delete')}</button>
            <button className="btn btn-green" onClick={handleSaveMeta} disabled={savingMeta || !isMetaDirty}>
              {savingMeta ? t('common.saving') : t('common.save')}
            </button>
          </div>
        )}
      </div>

      <div className="ws-detail-right" style={{ flex: 3 }}>
        <div className="job-page-detail">
          <div className="job-detail-body">
            <div className="job-detail-section">
              <Row label={t('dialog.status')} value={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <span className={`status-badge status-${status}`}>{t(`status.${status}`)}</span>
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
                <span style={dataStatus >= 4 ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{formatBytes(job.disk_size)}</span>
              } />
            </div>

            <div className="job-detail-section">
              <Row label={t('dialog.enrolledAt')}  value={formatDateFull(job.enqueued_at)} />
              <Row label={t('dialog.startedAt')}   value={formatDateFull(job.started_at)} />
              <Row label={t('dialog.completedAt')} value={formatDateFull(job.completed_at)} />
              <Row label={t('dialog.duration')}    value={jobDuration(job.started_at, job.completed_at, t)} />
            </div>

            {status === 'error' && job.error_msg && (
              <div className="job-detail-error">{job.error_msg}</div>
            )}
          </div>

        </div>
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
    </div>
  )
}
