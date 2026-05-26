import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EnvironmentApi } from '../../lib/api'
import { useToast } from '../../lib/toast'

function ServerSettings() {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [serverEnabled, setServerEnabled] = useState(false)
  const [serverHost, setServerHost] = useState('')
  const [serverPort, setServerPort] = useState(8080)
  const [initial, setInitial] = useState({ enabled: false, host: '', port: 8080 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    EnvironmentApi.get().then(env => {
      if (env) {
        const s = { enabled: !!env.server, host: env.server_host || '', port: env.server_port || 8080 }
        setServerEnabled(s.enabled)
        setServerHost(s.host)
        setServerPort(s.port)
        setInitial(s)
      }
    })
  }, [])

  const dirty = serverEnabled !== initial.enabled || serverHost !== initial.host || serverPort !== initial.port

  const save = async () => {
    setSaving(true)
    try {
      await EnvironmentApi.setServer({ enabled: serverEnabled, host: serverHost, port: serverPort })
      setInitial({ enabled: serverEnabled, host: serverHost, port: serverPort })
      showToast(t('common.saved'))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="section-title">{t('settings.serverMode')}</h2>
      <p className="form-hint" style={{ marginBottom: 16 }}>{t('settings.serverModeDesc')}</p>

      <div className="form" style={{ maxWidth: 640 }}>
        <div className="form-field" style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={serverEnabled}
              onChange={e => setServerEnabled(e.target.checked)}
            />
            {t('settings.serverEnabled')}
          </label>
        </div>

        <div className="form-row">
          <div className="form-field" style={{ flex: 2 }}>
            <label className="form-label">{t('settings.serverHost')}</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%' }}
              value={serverHost}
              onChange={e => setServerHost(e.target.value)}
              disabled={!serverEnabled}
              placeholder={t('settings.serverHostPlaceholder')}
            />
            <span className="form-hint">{t('settings.serverHostHint')}</span>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label className="form-label">{t('settings.serverPort')}</label>
            <input
              type="number"
              className="form-input"
              style={{ width: '100%' }}
              min={1}
              max={65535}
              value={serverPort}
              onChange={e => setServerPort(parseInt(e.target.value) || 8080)}
              disabled={!serverEnabled}
            />
          </div>
        </div>

        {dirty && (
          <div style={{ marginTop: 16 }}>
            <p className="form-hint" style={{ color: '#d15904', marginBottom: 8 }}>
              {t('settings.serverRestartRequired')}
            </p>
            <button
              className="btn btn-green btn-sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ServerSettings
