import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../languages'

function BasicSettings() {
  const { t, i18n } = useTranslation()

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
    </div>
  )
}

export default BasicSettings
