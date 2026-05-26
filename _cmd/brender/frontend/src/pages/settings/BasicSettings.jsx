import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../languages'
import { useTheme } from '../../lib/theme'

const THEME_OPTIONS = ['system', 'dark', 'light']

function BasicSettings() {
  const { t, i18n } = useTranslation()
  const { preference, changeTheme } = useTheme()

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
    </div>
  )
}

export default BasicSettings
