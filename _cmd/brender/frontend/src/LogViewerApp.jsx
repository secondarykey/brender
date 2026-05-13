import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, EnvironmentApi } from './lib/api'
import LogTitleBar from './components/LogTitleBar'

const TAIL_INTERVAL = 1000

function LogViewerApp() {
  const { t } = useTranslation()
  const params   = new URLSearchParams(window.location.search)
  const jobID    = params.get('log') || ''
  const isSysLog = params.has('syslog')
  const title    = isSysLog ? 'system.log' : 'render.log'

  const [log, setLog]     = useState(null)
  const [error, setError] = useState('')
  const [tail, setTail]   = useState(false)
  const preRef            = useRef(null)

  const fetchLog = useCallback(() => {
    const req = isSysLog
      ? EnvironmentApi.getSystemLog()
      : (jobID ? QueueApi.getJobLog({ id: jobID }) : Promise.resolve(''))
    req
      .then(text => setLog(text ?? ''))
      .catch(err => setError(String(err)))
  }, [isSysLog, jobID])

  // 初回読み込み
  useEffect(() => { fetchLog() }, [fetchLog])

  // tail モード: 1秒ごとに再読み込み
  useEffect(() => {
    if (!tail) return
    const id = setInterval(fetchLog, TAIL_INTERVAL)
    return () => clearInterval(id)
  }, [tail, fetchLog])

  // tail ON のとき、ログ更新のたびに末尾へスクロール
  useEffect(() => {
    if (tail && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [log, tail])

  return (
    <div className="log-viewer-root">
      <LogTitleBar title={title} />
      {error && <div className="error-msg" style={{ margin: 12 }}>{error}</div>}
      {log === null && !error && (
        <p className="log-viewer-status">{t('common.loading')}</p>
      )}
      {log !== null && log === '' && !error && (
        <p className="log-viewer-status">{t('job.noLog')}</p>
      )}
      {log && (
        <pre ref={preRef} className="log-viewer-pre">{log}</pre>
      )}
      <button
        className={`log-tail-btn${tail ? ' active' : ''}`}
        onClick={() => setTail(v => !v)}
        title={t('job.tail')}
      >
        ↓
      </button>
    </div>
  )
}

export default LogViewerApp
