import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from './lib/api'
import { onAppEvent } from './lib/appEvents'

function subFramePct(q) {
  const sample = Math.max(0, q.now_sample - 1)
  if (q.total_tiles > 0 && q.total_samples > 0) {
    const done = q.now_tile * q.total_samples + sample
    return done / (q.total_tiles * q.total_samples)
  }
  if (q.total_samples > 0) return sample / q.total_samples
  return 0
}

function formatETA(iso, t) {
  if (!iso) return null
  const d = new Date(iso)
  const diffSec = Math.floor((d - new Date()) / 1000)
  if (diffSec <= 0) return t('queue.almostComplete')
  if (diffSec < 60) return `${diffSec}${t('time.seconds')}`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}${t('time.minutes')}${diffSec % 60}${t('time.seconds')}`
  return `${Math.floor(diffSec / 3600)}${t('time.hours')}${Math.floor((diffSec % 3600) / 60)}${t('time.minutes')}`
}

function MiniMonitorApp() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])

  useEffect(() => {
    import('@wailsio/runtime').then(({ Window }) => {
      Window.SetAlwaysOnTop(true).catch(() => {})
    }).catch(() => {})
  }, [])

  const load = useCallback(() => {
    QueueApi.listItems()
      .then(list => setItems(list || []))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [load])
  useEffect(() => onAppEvent('queue:changed', load), [load])

  const running = items.find(q => q.status === 'running')
  const waitingCount = items.filter(q => q.status === 'waiting' || q.status === 'recovering').length

  let pct = 0
  if (running && running.now_frame > 0 && running.frame_active) {
    const totalFrames = Math.max(1, running.end_frame - running.start_frame + 1)
    const framesDone = running.now_frame - running.start_frame
    pct = Math.min(99.99, ((framesDone + subFramePct(running)) / totalFrames) * 100)
  }

  const etaText = running ? formatETA(running.expected_at, t) : null

  const handleRestore = () => { QueueApi.closeMiniMonitor() }
  const handleMinimise = () => {
    import('@wailsio/runtime').then(({ Window }) => Window.Minimise()).catch(() => {})
  }

  return (
    <div className="mini-monitor-root">
      <div className="mini-monitor-titlebar">
        <span className="mini-monitor-title">{t('miniMonitor.title')}</span>
        <div className="titlebar-controls">
          <button className="titlebar-btn titlebar-btn-min" onClick={handleMinimise}>&#8211;</button>
          <button className="titlebar-btn titlebar-btn-close" onClick={handleRestore}>&#10005;</button>
        </div>
      </div>

      <div className="mini-monitor-body">
        {running ? (
          <>
            <div className="mini-monitor-job-name">{running.name || '—'}</div>
            <div className="mini-monitor-progress-row">
              <div className="progress-bar-track mini-monitor-track">
                <div className="progress-bar-fill" style={{ width: `${pct.toFixed(2)}%` }} />
              </div>
              <span className="mini-monitor-pct">{pct.toFixed(1)}%</span>
            </div>
            {etaText && <div className="mini-monitor-eta">{t('miniMonitor.eta', { time: etaText })}</div>}
          </>
        ) : (
          <div className="mini-monitor-empty">{t('miniMonitor.noActiveJobs')}</div>
        )}

        <div className="mini-monitor-footer">
          <span className="mini-monitor-waiting">
            {t('miniMonitor.waiting', { count: waitingCount })}
          </span>
          <button className="btn btn-sm" onClick={handleRestore}>
            {t('miniMonitor.restore')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MiniMonitorApp
