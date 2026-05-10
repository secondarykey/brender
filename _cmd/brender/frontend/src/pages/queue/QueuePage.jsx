import { useState, useEffect, useCallback } from 'react'
import { QueueApi } from '../../lib/api'
import JobDetailDialog from '../../components/JobDetailDialog'
import ImageViewerDialog from '../../components/ImageViewerDialog'
import Pagination from '../../components/Pagination'

const STATUS_LABELS = {
  waiting:   '実行待ち',
  running:   '実行中',
  completed: '完了',
  error:     'エラー',
  cancelled: 'キャンセル',
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] ?? status}</span>
}

function elapsed(startedAt) {
  if (!startedAt) return '—'
  const sec = Math.floor((new Date() - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${Math.floor(sec / 3600)}時間${Math.floor((sec % 3600) / 60)}分`
}

function duration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return '—'
  const sec = Math.floor((new Date(completedAt) - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${Math.floor(sec / 3600)}時間${Math.floor((sec % 3600) / 60)}分`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatETA(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const diffSec = Math.floor((d - new Date()) / 1000)
  if (diffSec <= 0) return '間もなく完了'
  if (diffSec < 60) return `約${diffSec}秒後`
  if (diffSec < 3600) return `約${Math.floor(diffSec / 60)}分後`
  return `約${Math.floor(diffSec / 3600)}時間${Math.floor((diffSec % 3600) / 60)}分後`
}

// フレーム内サブ進捗を 0.0–1.0 で返す（バー計算用のみ）
// Cycles (tiles+samples): (完了タイル×totalSamples + nowSample) / (totalTiles×totalSamples)
// Cycles/EEVEE (samples のみ): nowSample / totalSamples
// 「1/n を0とする」: sample は 1-indexed なので -1 してから計算（sample 1 = 進捗0）
function subFramePct(q) {
  const sample = Math.max(0, q.now_sample - 1)
  if (q.total_tiles > 0 && q.total_samples > 0) {
    const done  = q.now_tile * q.total_samples + sample
    return done / (q.total_tiles * q.total_samples)
  }
  if (q.total_samples > 0) return sample / q.total_samples
  return 0
}

function ProgressCell({ q }) {
  const isRunning = q.status === 'running'
  const isWaiting = q.status === 'waiting'

  const totalFrames = Math.max(1, q.end_frame - q.start_frame + 1)
  // frame_active が true になるまで準備中（Cycles sync 中・EEVEE フレーム間は false）
  const hasFrame   = isRunning && q.now_frame > 0 && q.frame_active
  const framesDone = hasFrame ? q.now_frame - q.start_frame : 0

  const pct = hasFrame
    ? Math.min(99.99, ((framesDone + subFramePct(q)) / totalFrames) * 100)
    : 0
  const pctText = pct.toFixed(2)

  const frameText = isWaiting ? `${q.start_frame}–${q.end_frame}f`
                  : hasFrame  ? `${q.now_frame} / ${q.end_frame}f (${pctText}%)`
                  : isRunning ? `準備中... (${q.start_frame}–${q.end_frame}f)`
                  :             `${q.start_frame}–${q.end_frame}f`
  const aveSec = isRunning && q.average_sec > 0 ? `${q.average_sec.toFixed(1)}秒/f` : ''

  const logText = q.log2 || ''
  return (
    <td className="queue-progress-cell" style={{ width: 300, minWidth: 300, maxWidth: 300 }}>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pctText}%` }} />
      </div>
      <div className="progress-meta">
        <span className="progress-frame">{frameText}</span>
        <span className="progress-ave">{aveSec}</span>
      </div>
      <div className="progress-log" title={logText}>{logText}</div>
    </td>
  )
}

// ── 実行中タブ ────────────────────────────────────────────
function ActiveTab({ navigate }) {
  const [items, setItems]           = useState([])
  const [error, setError]           = useState('')
  const [confirmId, setConfirmId]   = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(() => {
    QueueApi.listItems()
      .then(list => setItems(list || []))
      .catch(err => setError(String(err)))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [load])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await QueueApi.cancel({ id: confirmId })
      setConfirmId(null)
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setCancelling(false)
    }
  }

  const confirmItem = items.find(q => q.id === confirmId)

  return (
    <>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {items.length === 0 ? (
        <p className="empty-msg">実行中・待機中のジョブはありません</p>
      ) : (
        <table className="queue-table">
          <thead>
            <tr>
              <th className="col-name">ワークスペース</th>
              <th className="col-status">ステータス</th>
              <th className="col-progress" style={{ width: 300, minWidth: 300, maxWidth: 300 }}>フレーム / 進捗</th>
              <th className="col-datetime">開始 / 完了予定</th>
              <th className="col-duration">経過 / 残り</th>
              <th className="col-action"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(q => (
              <tr key={q.id} className={q.status === 'running' ? 'row-running' : ''}>
                <td>
                  <button className="link-btn" onClick={() => navigate && navigate('workspace', {
                    projectID: q.project_id, projectName: q.project_name, workspaceID: q.workspace_id,
                  })}>
                    {q.workspace_name || q.workspace_id}
                  </button>
                </td>
                <td className="col-status"><StatusBadge status={q.status} /></td>
                <ProgressCell q={q} />
                <td className="col-datetime date-cell">
                  <div>{formatDate(q.started_at)}</div>
                  {q.expected_at && <div className="cell-sub">{formatDate(q.expected_at)}</div>}
                </td>
                <td className="col-duration duration-cell">
                  <div>{elapsed(q.started_at)}</div>
                  {q.expected_at && <div className="cell-sub">{formatETA(q.expected_at)}</div>}
                </td>
                <td className="col-action">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmId(q.id)}
                  >
                    キャンセル
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmId && (
        <div className="dialog-overlay" onClick={() => setConfirmId(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">ジョブをキャンセルしますか？</h3>
            <div className="dialog-body">
              {confirmItem && (
                <>
                  <p><span className="dialog-label">プロジェクト</span>{confirmItem.project_name}</p>
                  <p><span className="dialog-label">ワークスペース</span>{confirmItem.workspace_name}</p>
                  <p><span className="dialog-label">ステータス</span><StatusBadge status={confirmItem.status} /></p>
                </>
              )}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>戻る</button>
              <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'キャンセル中...' : 'キャンセルする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const PAGE_SIZE = 10

// ── 実行履歴タブ ──────────────────────────────────────────
function HistoryTab({ navigate }) {
  const [jobs, setJobs]         = useState([])
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)
  const [viewing, setViewing]   = useState(null)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const load = useCallback(() => {
    QueueApi.listJobs()
      .then(list => setJobs(list || []))
      .catch(err => setError(String(err)))
  }, [])

  useEffect(() => { load() }, [load])

  const totalPages  = Math.max(1, Math.ceil(jobs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handlePageChange = (p) => { setPage(p); setSelected(null) }

  return (
    <>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {jobs.length === 0 ? (
        <p className="empty-msg">実行履歴がありません</p>
      ) : (
        <>
          <table className="queue-table">
            <thead>
              <tr>
                <th>ワークスペース</th>
                <th>ステータス</th>
                <th>プロジェクト</th>
                <th>エンジン</th>
                <th>フレーム</th>
                <th>登録時刻</th>
                <th>所要時間</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageJobs.map(j => (
                <tr key={j.id} className={`${j.status === 'error' ? 'row-error' : ''} row-clickable`} onClick={() => setSelected(j)}>
                  <td>
                    <button className="link-btn" onClick={e => { e.stopPropagation(); navigate && navigate('workspace', {
                      projectID: j.project_id, projectName: j.project_name, workspaceID: j.workspace_id,
                    })}}>
                      {j.workspace_name || j.workspace_id}
                    </button>
                  </td>
                  <td>
                    <StatusBadge status={j.status || 'running'} />
                    {j.status === 'error' && j.error_msg && (
                      <div className="queue-history-error" title={j.error_msg}>
                        {j.error_msg.slice(0, 60)}{j.error_msg.length > 60 ? '…' : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <button className="link-btn" onClick={() => navigate && navigate('project', { id: j.project_id })}>
                      {j.project_name || j.project_id}
                    </button>
                  </td>
                  <td>{j.engine || 'デフォルト'}</td>
                  <td className="frames-cell">{j.start_frame}–{j.end_frame}</td>
                  <td className="date-cell">{formatDate(j.enqueued_at)}</td>
                  <td className="duration-cell">{duration(j.started_at, j.completed_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {(j.data_status === 2 || j.data_status === 3) && (
                      <button className="btn btn-sm" onClick={() => setViewing(j)}>開く</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={currentPage} totalPages={totalPages} onChange={handlePageChange} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={jobs.length} />
        </>
      )}
      <JobDetailDialog job={selected} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); load() }}
        onStatusChanged={(id, status) => {
          setJobs(prev => prev.map(j => j.id === id ? { ...j, data_status: status } : j))
          setSelected(prev => prev && prev.id === id ? { ...prev, data_status: status } : prev)
        }} />
      <ImageViewerDialog job={viewing} onClose={() => setViewing(null)} />
    </>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function QueuePage({ navigate }) {
  const [tab, setTab] = useState('active')

  return (
    <div className="page">
<div className="tab-nav">
        <button
          className={`tab-btn${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          実行中
        </button>
        <button
          className={`tab-btn${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          実行履歴
        </button>
      </div>

      <div className="tab-content">
        {tab === 'active'  && <ActiveTab  navigate={navigate} />}
        {tab === 'history' && <HistoryTab navigate={navigate} />}
      </div>
    </div>
  )
}

export default QueuePage
