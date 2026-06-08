import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../languages'
import { useTheme } from '../../lib/theme'
import { isWails } from '../../lib/api/_client'
import { AuthApi } from '../../lib/api'
import { useToast, useMessage } from '../../lib/toast'

const THEME_OPTIONS = ['system', 'dark', 'light']

function BasicSettings() {
  const { t, i18n } = useTranslation()
  const { preference, changeTheme } = useTheme()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [loggingOut, setLoggingOut] = useState(false)
  const [user, setUser] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const savedDisplayName = useRef('')

  const serverMode = !isWails()

  useEffect(() => {
    if (!serverMode) return
    AuthApi.me()
      .then(u => {
        if (u) {
          setUser(u)
          setDisplayName(u.display_name || '')
          savedDisplayName.current = u.display_name || ''
        }
      })
      .catch(() => {})
  }, [])

  const isDisplayNameDirty = displayName !== savedDisplayName.current

  const handleSaveDisplayName = async () => {
    if (!user) return
    setSavingName(true)
    try {
      await AuthApi.updateUser({ id: user.id, name: user.name, displayName })
      savedDisplayName.current = displayName
      showToast(t('common.saved'))
    } catch (e) {
      showError(String(e))
    } finally {
      setSavingName(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await AuthApi.logout()
    } catch (_) {
      // エラーでもリロードしてログイン画面に遷移
    }
    window.location.reload()
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

      {serverMode && (
        <>
          <h2 className="section-title" style={{ marginTop: 24 }}>{t('settings.account')}</h2>
          {user && (
            <div className="form" style={{ maxWidth: 480 }}>
              <div className="form-field">
                <label className="form-label">{t('settings.loginId')}</label>
                <input
                  type="text" className="form-input" style={{ width: '100%' }}
                  value={user.name}
                  disabled
                />
              </div>
              <div className="form-field" style={{ marginTop: 12 }}>
                <label className="form-label">{t('settings.displayName')}</label>
                <input
                  type="text" className="form-input" style={{ width: '100%' }}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>
              <div className="form-actions" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-danger"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? t('settings.loggingOut') : t('settings.logout')}
                </button>
                <button
                  className="btn btn-green"
                  onClick={handleSaveDisplayName}
                  disabled={savingName || !isDisplayNameDirty}
                >
                  {savingName ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default BasicSettings
