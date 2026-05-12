import { useState, useEffect } from 'react'
import { QueueApi } from './lib/api'

function LogViewerApp() {
  const jobID = new URLSearchParams(window.location.search).get('log') || ''
  const [log, setLog]     = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobID) { setLog(''); return }
    QueueApi.getJobLog({ id: jobID })
      .then(text => setLog(text ?? ''))
      .catch(err => setError(String(err)))
  }, [jobID])

  return (
    <div className="log-viewer-root">
      {error && <div className="error-msg" style={{ margin: 12 }}>{error}</div>}
      {log === null && !error && (
        <p className="log-viewer-status">読み込み中...</p>
      )}
      {log !== null && log === '' && !error && (
        <p className="log-viewer-status">ログファイルがありません</p>
      )}
      {log && (
        <pre className="log-viewer-pre">{log}</pre>
      )}
    </div>
  )
}

export default LogViewerApp
