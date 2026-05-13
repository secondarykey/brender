import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BasicSettings from './BasicSettings'
import EnvironmentSettings from './EnvironmentSettings'
import BlenderSettings from './BlenderSettings'
import VideoSettings from './VideoSettings'
import SystemLogSettings from './SystemLogSettings'

function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('basic')

  const tabs = [
    { id: 'basic',      label: t('tabs.basic') },
    { id: 'envSettings', label: t('tabs.envSettings') },
    { id: 'video',      label: t('tabs.video') },
    { id: 'systemLog',  label: t('tabs.systemLog') },
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
        {tab === 'basic'       && <BasicSettings />}
        {tab === 'envSettings' && (
          <>
            <EnvironmentSettings />
            <BlenderSettings />
          </>
        )}
        {tab === 'video'       && <VideoSettings />}
        {tab === 'systemLog'   && <SystemLogSettings />}
      </div>
    </div>
  )
}

export default SettingsPage
