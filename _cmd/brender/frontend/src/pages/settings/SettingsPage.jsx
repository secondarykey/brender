import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EnvironmentSettings from './EnvironmentSettings'
import BlenderSettings from './BlenderSettings'
import VideoSettings from './VideoSettings'

function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('env')

  const tabs = [
    { id: 'env',     label: t('tabs.environment') },
    { id: 'blender', label: t('tabs.blender') },
    { id: 'video',   label: t('tabs.video') },
  ]

  return (
    <div className="page">
      <div className="tab-nav">
        {tabs.map(tb => (
          <button
            key={tb.id}
            className={`tab-btn${tab === tb.id ? ' active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tab === 'env'     && <EnvironmentSettings />}
        {tab === 'blender' && <BlenderSettings />}
        {tab === 'video'   && <VideoSettings />}
      </div>
    </div>
  )
}

export default SettingsPage
