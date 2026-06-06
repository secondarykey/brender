import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../languages'
import { useTheme } from '../../lib/theme'
import { isWails } from '../../lib/api/_client'
import { AuthApi } from '../../lib/api'

const THEME_OPTIONS = ['system', 'dark', 'light']

function BasicSettings() {
  const { t, i18n } = useTranslation()
  const { preference, changeTheme } = useTheme()
  const [loggingOut, setLoggingOut] = useState(false)

  const serverMode = !isWails()

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
          <div className="setting-row">
            <button
              className="btn btn-danger"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? t('settings.loggingOut') : t('settings.logout')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default BasicSettings
