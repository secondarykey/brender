import { useTranslation } from 'react-i18next'

function AccessDenied({ onBack }) {
  const { t } = useTranslation()
  return (
    <div className="page">
      <div className="access-denied">
        <span className="access-denied-icon">&#9888;</span>
        <p className="access-denied-message">{t('permission.accessDenied')}</p>
        {onBack && (
          <button className="btn" onClick={onBack}>
            {t('common.back')}
          </button>
        )}
      </div>
    </div>
  )
}

export default AccessDenied
