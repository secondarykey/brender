import { useTranslation } from 'react-i18next'

function CodeSettings() {
  const { t } = useTranslation()

  return (
    <div>
      <p className="empty-msg">{t('common.loading')}</p>
    </div>
  )
}

export default CodeSettings
