import { useState, useEffect } from 'react'
import { QueueApi } from '../lib/api'

const STATUS_LABELS = {
  completed: '完了',
  error:     'エラー',
  cancelled: 'キャンセル',
  running:   '実行中',
  waiting:   '実行待ち',
}

// data_status: 0=なし 1=なしロック 2=あり 3=ありロック 4=削除 5=削除ロック
function dataStatusLabel(s) {
  if (s % 2 === 1) return 'ロック'
  if (s === 0)     return 'データなし'
  if (s === 2)     return 'あり'
  if (s === 4)     return 'データ削除'
  return String(s)
}

function dataStatusClass(s) {
  if (s % 2 === 1) return 'data-status-locked'
  if (s === 0)     return 'data-status-none'
  if (s === 2)     return 'data-status-available'
  if (s === 4)     return 'data-status-deleted'
  return ''
}

function DataStatusBadge({ status }) {
  return <span className={`data-status-badge ${dataStatusClass(status)}`}>{dataStatusLabel(status)}</span>
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

function duration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return '—'
  const sec = Math.floor((new Date(completedAt) - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${Math.floor(sec / 3600)}時間${Math.floor((sec % 3600) / 60)}分`
}

function Row({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="job-detail-row">
      <span className="job-detail-label">{label}</span>
      <span className="job-detail-value">{value}</span>
    </div>
  )
}

function JobDetailDialog({ job, onClose, onDeleted, onStatusChanged }) {
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
        <h3 className="dialog-title">ジョブ詳細</h3>

        <div className="dialog-body job-detail-body">
          <div className="job-detail-section">
            <Row label="ステータス"    value={<span className={`status-badge status-${status}`}>{STATUS_LABELS[status] ?? status}</span>} />
            <Row label="データ" value={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DataStatusBadge status={dataStatus} />
                <button className="btn btn-sm btn-ghost" onClick={handleLock} disabled={locking}>
                  {isLocked ? 'ロック解除' : 'ロック'}
                </button>
              </div>
            } />
            <Row label="プロジェクト"  value={job.project_name} />
            <Row label="ワークスペース" value={job.workspace_name} />
          </div>

          <div className="job-detail-section">
            <Row label="シーン"    value={job.scene   || 'デフォルト'} />
            <Row label="エンジン"  value={job.engine  || 'デフォルト'} />
            <Row label="フレーム"  value={`${job.start_frame} – ${job.end_frame}${job.frame_step > 1 ? ` (ステップ ${job.frame_step})` : ''}`} />
            <Row label="スレッド"  value={job.thread === 0 ? '自動' : String(job.thread)} />
          </div>

          <div className="job-detail-section">
            <Row label="Blender"  value={job.blender_path} />
            <Row label="ファイル" value={job.blender_file} />
            <Row label="出力先"   value={job.output_dir} />
            <Row label="データ容量" value={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={dataStatus >= 4 ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{formatBytes(job.disk_size)}</span>
                {dataStatus === 2 && (
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirmData(true)} disabled={isLocked}>
                    データ削除
                  </button>
                )}
              </div>
            } />
          </div>

          <div className="job-detail-section">
            <Row label="登録日時" value={fmt(job.enqueued_at)} />
            <Row label="開始日時" value={fmt(job.started_at)} />
            <Row label="完了日時" value={fmt(job.completed_at)} />
            <Row label="所要時間" value={duration(job.started_at, job.completed_at)} />
          </div>

          {status === 'error' && job.error_msg && (
            <div className="job-detail-error">{job.error_msg}</div>
          )}
          {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        {confirmData ? (
          <div className="job-delete-confirm">
            <span className="job-delete-confirm-msg">出力フォルダを削除します。ジョブ履歴は残ります。この操作は取り消せません。</span>
            <div className="dialog-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmData(false)} disabled={deletingData}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteData} disabled={deletingData}>
                {deletingData ? '削除中...' : 'データ削除する'}
              </button>
            </div>
          </div>
        ) : confirm ? (
          <div className="job-delete-confirm">
            <span className="job-delete-confirm-msg">出力フォルダも含めて削除します。この操作は取り消せません。</span>
            <div className="dialog-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)} disabled={deleting}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        ) : (
          <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={isLocked}>削除</button>
            <button className="btn btn-ghost" onClick={onClose}>閉じる</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default JobDetailDialog
