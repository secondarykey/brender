import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../languages'
import { useTheme } from '../../lib/theme'
import { EnvironmentApi } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { isWails } from '../../lib/api/_client'

const THEME_OPTIONS = ['system', 'dark', 'light']

function BasicSettings() {
  const { t, i18n } = useTranslation()
  const { preference, changeTheme } = useTheme()
  const { showToast } = useToast()

  const [serverEnabled, setServerEnabled] = useState(false)
  const [serverPort, setServerPort] = useState(8080)
  const [initialServer, setInitialServer] = useState(false)
  const [initialPort, setInitialPort] = useState(8080)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    EnvironmentApi.get().then(env => {
      if (env) {
        setServerEnabled(!!env.server)
        setInitialServer(!!env.server)
        const p = env.server_port || 8080
        setServerPort(p)
        setInitialPort(p)
      }
    })
  }, [])

  const dirty = serverEnabled !== initialServer || serverPort !== initialPort

  const saveServer = async () => {
    setSaving(true)
    try {
      await EnvironmentApi.setServer({ enabled: serverEnabled, port: serverPort })
      setInitialServer(serverEnabled)
      setInitialPort(serverPort)
      showToast(t('common.saved'))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="section-title">{t('settings.language')}</h2>
      <div className="setting-row">
        <select
          className="form-select"
          style={{ width: 200 }}
          value={i18n.language}
          onChange={e => i18n.changeLanguage(e.target.value)}
        >
          {LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
      </div>

      <h2 className="section-title" style={{ marginTop: 24 }}>{t('settings.theme')}</h2>
      <div className="setting-row">
        <select
          className="form-select"
          style={{ width: 200 }}
          value={preference}
          onChange={e => changeTheme(e.target.value)}
        >
          {THEME_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{t(`settings.themes.${opt}`)}</option>
          ))}
        </select>
      </div>

      {isWails() && (
        <>
          <h2 className="section-title" style={{ marginTop: 24 }}>{t('settings.serverMode')}</h2>
          <p className="form-hint" style={{ marginBottom: 12 }}>{t('settings.serverModeDesc')}</p>
          <div className="form" style={{ maxWidth: 640 }}>
            <div className="form-row" style={{ alignItems: 'center' }}>
              <div className="form-field" style={{ flex: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={serverEnabled}
                    onChange={e => setServerEnabled(e.target.checked)}
                  />
                  {t('settings.serverMode')}
                </label>
              </div>
              <div className="form-field" style={{ flex: 0, minWidth: 120 }}>
                <label className="form-label">{t('settings.serverPort')}</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: 100 }}
                  min={1}
                  max={65535}
                  value={serverPort}
                  onChange={e => setServerPort(parseInt(e.target.value) || 8080)}
                  disabled={!serverEnabled}
                />
              </div>
            </div>
            {dirty && (
              <div style={{ marginTop: 12 }}>
                <p className="form-hint" style={{ color: '#d15904', marginBottom: 8 }}>
                  {t('settings.serverRestartRequired')}
                </p>
                <button
                  className="btn btn-green btn-sm"
                  onClick={saveServer}
                  disabled={saving}
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default BasicSettings
