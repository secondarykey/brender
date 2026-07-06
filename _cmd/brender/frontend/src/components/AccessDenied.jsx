import { useTranslation } from 'react-i18next'
import { MdWarning } from 'react-icons/md'

function AccessDenied({ onBack }) {
  const { t } = useTranslation()
  return (
    <div className="page">
      <div className="access-denied">
        <span className="access-denied-icon"><MdWarning /></span>
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
