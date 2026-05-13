import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, EnvironmentApi } from './lib/api'

function LogViewerApp() {
  const { t } = useTranslation()
  const params  = new URLSearchParams(window.location.search)
  const jobID   = params.get('log') || ''
  const isSysLog = params.has('syslog')
  const [log, setLog]     = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSysLog) {
      EnvironmentApi.getSystemLog()
        .then(text => setLog(text ?? ''))
        .catch(err => setError(String(err)))
      return
    }
    if (!jobID) { setLog(''); return }
    QueueApi.getJobLog({ id: jobID })
      .then(text => setLog(text ?? ''))
      .catch(err => setError(String(err)))
  }, [jobID, isSysLog])

  return (
    <div className="log-viewer-root">
      {error && <div className="error-msg" style={{ margin: 12 }}>{error}</div>}
      {log === null && !error && (
        <p className="log-viewer-status">{t('common.loading')}</p>
      )}
      {log !== null && log === '' && !error && (
        <p className="log-viewer-status">{t('job.noLog')}</p>
      )}
      {log && (
        <pre className="log-viewer-pre">{log}</pre>
      )}
    </div>
  )
}

export default LogViewerApp
