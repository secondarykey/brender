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

  const [log, setLog]         = useState(null)
  const [error, setError]     = useState('')
  const [tail, setTail]       = useState(false)
  const [wrap, setWrap]       = useState(false)
  const [logLevel, setLogLevel]   = useState(null)
  const [logLevels, setLogLevels] = useState(null)
  const preRef                = useRef(null)

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

  // システムログ時のみログレベルを取得
  useEffect(() => {
    if (!isSysLog) return
    Promise.all([
      EnvironmentApi.getLogLevel(),
      EnvironmentApi.getLogLevels(),
    ]).then(([lv, lvs]) => {
      setLogLevel(lv)
      setLogLevels(lvs)
    }).catch(() => {})
  }, [isSysLog])

  const handleLogLevelChange = (level) => {
    EnvironmentApi.setLogLevel({ level })
      .then(() => setLogLevel(level))
      .catch(() => {})
  }

  const handleDownload = () => {
    if (!log) return
    const now = new Date()
    const ts = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0') + '-'
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0')
    const filename = isSysLog ? `brender-${ts}.log` : `brender-rendering-${ts}.log`
    const url = URL.createObjectURL(new Blob([log], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

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
      <LogTitleBar
        title={title}
        logLevel={logLevel}
        logLevels={logLevels}
        onLogLevelChange={handleLogLevelChange}
        onDownload={log ? handleDownload : null}
      />
      {error && <div className="error-msg" style={{ margin: 12 }}>{error}</div>}
      {log === null && !error && (
        <p className="log-viewer-status">{t('common.loading')}</p>
      )}
      {log !== null && log === '' && !error && (
        <p className="log-viewer-status">{t('job.noLog')}</p>
      )}
      {log && (
        <pre ref={preRef} className={`log-viewer-pre${wrap ? '' : ' no-wrap'}`}>{log}</pre>
      )}
      <button
        className={`log-wrap-btn${wrap ? ' active' : ''}`}
        onClick={() => setWrap(v => !v)}
        title={t('job.wrap')}
      >
        ⇌
      </button>
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
