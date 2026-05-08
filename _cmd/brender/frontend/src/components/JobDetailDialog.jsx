const STATUS_LABELS = {
  completed: '完了',
  error:     'エラー',
  cancelled: 'キャンセル',
  running:   '実行中',
  waiting:   '実行待ち',
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

function JobDetailDialog({ job, onClose }) {
  if (!job) return null

  const status = job.status || 'running'

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-wide" onClick={e => e.stopPropagation()}>
        <h3 className="dialog-title">ジョブ詳細</h3>

        <div className="dialog-body job-detail-body">
          <div className="job-detail-section">
            <Row label="ステータス"    value={<span className={`status-badge status-${status}`}>{STATUS_LABELS[status] ?? status}</span>} />
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
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  )
}

export default JobDetailDialog
