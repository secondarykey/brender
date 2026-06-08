import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../../lib/api'
import { useMessage } from '../../lib/toast'
import { onAppEvent } from '../../lib/appEvents'
import JobDetailDialog from '../../components/JobDetailDialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { formatDate, formatDateFull } from '../../lib/dateFormat'
import { isWails } from '../../lib/api/_client'

function StatusBadge({ status }) {
  const { t } = useTranslation()
  return <span className={`status-badge status-${status}`}>{t(`status.${status}`)}</span>
}

function elapsed(startedAt, t) {
  if (!startedAt) return '—'
  const sec = Math.floor((new Date() - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}${t('time.seconds')}`
  if (sec < 3600) return `${Math.floor(sec / 60)}${t('time.minutes')}${sec % 60}${t('time.seconds')}`
  return `${Math.floor(sec / 3600)}${t('time.hours')}${Math.floor((sec % 3600) / 60)}${t('time.minutes')}`
}

function duration(startedAt, completedAt, t) {
  if (!startedAt || !completedAt) return '—'
  const sec = Math.floor((new Date(completedAt) - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}${t('time.seconds')}`
  if (sec < 3600) return `${Math.floor(sec / 60)}${t('time.minutes')}${sec % 60}${t('time.seconds')}`
  return `${Math.floor(sec / 3600)}${t('time.hours')}${Math.floor((sec % 3600) / 60)}${t('time.minutes')}`
}

function formatETA(iso, t) {
  if (!iso) return null
  const d = new Date(iso)
  const diffSec = Math.floor((d - new Date()) / 1000)
  if (diffSec <= 0) return t('queue.almostComplete')
  if (diffSec < 60) return `約${diffSec}${t('time.seconds')}後`
  if (diffSec < 3600) return `約${Math.floor(diffSec / 60)}${t('time.minutes')}後`
  return `約${Math.floor(diffSec / 3600)}${t('time.hours')}${Math.floor((diffSec % 3600) / 60)}${t('time.minutes')}後`
}

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
  const { t } = useTranslation()
  const isRunning = q.status === 'running'
  const isWaiting = q.status === 'waiting' || q.status === 'recovering'
  const isSamplesComparison = q.job_type === 'samples_comparison'

  if (isSamplesComparison) {
    const total = q.end_frame || 1
    const done = q.now_frame || 0
    const pct = Math.min(99.99, (done / total) * 100)
    const pctText = pct.toFixed(2)
    const label = isWaiting
      ? t('queue.samplesComparison', { total })
      : isRunning
        ? `sample ${done}/${total} (${q.log1 || ''}) ${pctText}%`
        : `sample ${done}/${total}`
    const eta = isRunning ? formatETA(q.expected_at, t) : null
    const logText = q.log2 || ''
    return (
      <td className="queue-progress-cell" style={{ width: 300, minWidth: 300, maxWidth: 300 }}>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pctText}%` }} />
        </div>
        <div className="progress-meta">
          <span className="progress-frame">{label}</span>
          {eta && <span className="progress-ave">{eta}</span>}
        </div>
        <div className="progress-log" title={logText}>{logText}</div>
      </td>
    )
  }

  const totalFrames = Math.max(1, q.end_frame - q.start_frame + 1)
  const hasFrame   = isRunning && q.now_frame > 0 && q.frame_active
  const framesDone = hasFrame ? q.now_frame - q.start_frame : 0

  const pct = hasFrame
    ? Math.min(99.99, ((framesDone + subFramePct(q)) / totalFrames) * 100)
    : 0
  const pctText = pct.toFixed(2)

  const aveText = isRunning && q.average_sec > 0 ? ` ${q.average_sec.toFixed(1)}${t('queue.secondsPerFrame')}` : ''
  const frameText = isWaiting ? `${q.start_frame}–${q.end_frame}f`
                  : hasFrame  ? `${q.now_frame}f (${q.start_frame}–${q.end_frame}${aveText})`
                  : isRunning ? `${t('queue.preparing')}${q.start_frame}–${q.end_frame}f)`
                  :             `${q.start_frame}–${q.end_frame}f`

  const logText = q.log2 || ''
  return (
    <td className="queue-progress-cell" style={{ width: 300, minWidth: 300, maxWidth: 300 }}>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pctText}%` }} />
      </div>
      <div className="progress-meta">
        <span className="progress-frame">{frameText}</span>
      </div>
      <div className="progress-log" title={logText}>{logText}</div>
    </td>
  )
}

// ── 実行中タブ ────────────────────────────────────────────
function ActiveTab({ navigate }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [items, setItems]           = useState([])
  const [confirmId, setConfirmId]   = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(() => {
    QueueApi.listItems()
      .then(list => setItems(list || []))
      .catch(err => showError(String(err)))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => onAppEvent('queue:changed', load), [load])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await QueueApi.cancel({ id: confirmId })
      setConfirmId(null)
      load()
    } catch (err) {
      showError(String(err))
    } finally {
      setCancelling(false)
    }
  }

  const confirmItem = items.find(q => q.id === confirmId)

  return (
    <>
      {items.length === 0 ? (
        <p className="empty-msg">{t('queue.noJobs')}</p>
      ) : (
        <table className="queue-table">
          <thead>
            <tr>
              <th className="col-name">{t('table.jobName')}</th>
              <th className="col-status">{t('table.status')}</th>
              <th className="col-progress" style={{ width: 300, minWidth: 300, maxWidth: 300 }}>{t('table.frameProgress')}</th>
              <th className="col-datetime">{t('table.startExpected')}</th>
              <th className="col-duration">{t('table.elapsedRemaining')}</th>
              <th className="col-action"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(q => (
              <tr key={q.id} className={q.status === 'running' ? 'row-running' : ''}>
                <td>
                  <button className="link-btn" onClick={() => navigate && navigate('job', {
                    jobID: q.id,
                    initialTab: 'detail',
                    backPage: 'queue',
                    backParams: {},
                  })}>
                    {q.name || '—'}
                  </button>
                </td>
                <td className="col-status"><StatusBadge status={q.status} /></td>
                <ProgressCell q={q} />
                <td className="col-datetime date-cell">
                  <div>{formatDate(q.started_at)}</div>
                  {q.expected_at && <div className="cell-sub">{formatDate(q.expected_at)}</div>}
                </td>
                <td className="col-duration duration-cell">
                  <div>{elapsed(q.started_at, t)}</div>
                  {q.expected_at && <div className="cell-sub">{formatETA(q.expected_at, t)}</div>}
                </td>
                <td className="col-action">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmId(q.id)}
                    disabled={q.can_cancel === false}
                  >
                    {t('common.cancelAction')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title={t('queue.confirmCancel')}
        onCancel={() => setConfirmId(null)}
        onConfirm={handleCancel}
        cancelLabel={t('common.back')}
        confirmLabel={cancelling ? t('common.cancelling') : t('common.cancelAction')}
        busy={cancelling}
      >
        {confirmItem && (
          <>
            <p><span className="dialog-label">{t('dialog.jobName')}</span>{confirmItem.name || '—'}</p>
            <p><span className="dialog-label">{t('dialog.status')}</span><StatusBadge status={confirmItem.status} /></p>
          </>
        )}
      </ConfirmDialog>
    </>
  )
}

const PAGE_SIZE = 10

// ── 実行履歴タブ ──────────────────────────────────────────
function HistoryTab({ navigate }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [jobs, setJobs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [selected, setSelected] = useState(null)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const load = useCallback((p, ps) => {
    const pg = p ?? page
    const sz = ps ?? pageSize
    QueueApi.listJobsPaged({ filter: {}, page: pg, pageSize: sz })
      .then(result => {
        const items = result?.jobs || []
        setJobs(items)
        setTotal(result?.total || 0)
        setSelected(prev => prev ? (items.find(j => j.id === prev.id) ?? prev) : null)
      })
      .catch(err => showError(String(err)))
  }, [page, pageSize])

  useEffect(() => { load() }, [load])

  useEffect(() => onAppEvent('queue:changed', () => load()), [load])

  const totalPages  = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs

  const handlePageChange = (p) => { setPage(p); setSelected(null) }

  return (
    <>
      {total === 0 ? (
        <p className="empty-msg">{t('queue.noHistory')}</p>
      ) : (
        <>
          <table className="queue-table">
            <thead>
              <tr>
                <th className="col-c">{t('table.status')}</th>
                <th>{t('breadcrumb.jobResult')}</th>
                <th className="col-c">{t('table.engine')}</th>
                <th className="col-c">{t('table.scene')}</th>
                <th className="col-c">{t('table.camera')}</th>
                <th className="col-c">{t('table.frames')}</th>
                <th className="col-r">{t('table.samples')}</th>
                <th className="col-c">{t('table.resolution')}</th>
                <th className="col-c">{t('table.startedAt')}</th>
                <th className="col-c">{t('table.completedAt')}</th>
                <th className="col-r">{t('table.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {pageJobs.map(j => (
                <tr key={j.id} className={`${j.status === 'error' ? 'row-error' : ''} row-clickable`} onClick={() => setSelected(j)}>
                  <td className="col-c">
                    <StatusBadge status={j.status || 'running'} />
                    {j.status === 'error' && j.error_msg && (
                      <div className="queue-history-error" title={j.error_msg}>
                        {j.error_msg.slice(0, 40)}{j.error_msg.length > 40 ? '…' : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <button className="link-btn" onClick={e => { e.stopPropagation(); navigate && navigate('job', {
                      job: j,
                      initialTab: 'render',
                      backPage: 'queue',
                      backParams: {},
                    })}}>
                      {j.name || '—'}
                    </button>
                  </td>
                  <td className="col-c">{j.engine || '—'}</td>
                  <td className="col-c">{j.scene  || '—'}</td>
                  <td className="col-c">{j.camera || '—'}</td>
                  <td className="col-c frames-cell">{j.start_frame}–{j.end_frame}</td>
                  <td className="col-r num-cell">{j.samples > 0 ? j.samples : '—'}</td>
                  <td className="col-c num-cell">{(j.resolution_x > 0 && j.resolution_y > 0) ? `${j.resolution_x}×${j.resolution_y}` : '—'}</td>
                  <td className="col-c date-cell">{formatDateFull(j.started_at)}</td>
                  <td className="col-c date-cell">{formatDateFull(j.completed_at)}</td>
                  <td className="duration-cell">{duration(j.started_at, j.completed_at, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={currentPage} totalPages={totalPages} onChange={handlePageChange} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={total} />
        </>
      )}
      <JobDetailDialog job={selected} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); load() }}
        onStatusChanged={(id, status) => {
          setJobs(prev => prev.map(j => j.id === id ? { ...j, data_status: status } : j))
          setSelected(prev => prev && prev.id === id ? { ...prev, data_status: status } : prev)
        }} />
    </>
  )
}

// ── ページ本体 ────────────────────────────────────────────
function QueuePage({ navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('active')

  return (
    <div className="page">
      <div className="tab-nav">
        <button
          className={`tab-btn${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          {t('tabs.queue')}
        </button>
        <button
          className={`tab-btn${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          {t('tabs.history')}
        </button>
        {isWails() && (
          <button
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => QueueApi.openMiniMonitor()}
          >
            {t('menu.miniMonitor')}
          </button>
        )}
      </div>

      <div className="tab-content">
        {tab === 'active'  && <ActiveTab  navigate={navigate} />}
        {tab === 'history' && <HistoryTab navigate={navigate} />}
      </div>
    </div>
  )
}

export default QueuePage
