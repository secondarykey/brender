import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { EnvironmentApi } from '../../lib/api'

function SystemLogSettings() {
  const { t } = useTranslation()
  const [log, setLog]       = useState(null)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    EnvironmentApi.getSystemLog()
      .then(text => setLog(text ?? ''))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={load} disabled={loading}>
          {loading ? t('common.loading') : t('common.reload')}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {log === null && !error && (
        <p className="log-viewer-status">{t('common.loading')}</p>
      )}
      {log !== null && log === '' && !error && (
        <p className="log-viewer-status">{t('job.noLog')}</p>
      )}
      {log && (
        <pre className="log-viewer-pre" style={{ flex: 1, minHeight: 0, height: 'calc(100vh - 220px)' }}>
          {log}
        </pre>
      )}
    </div>
  )
}

export default SystemLogSettings
