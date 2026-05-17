import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BasicSettings from './BasicSettings'
import EnvironmentSettings from './EnvironmentSettings'
import BlenderSettings from './BlenderSettings'
import VideoSettings from './VideoSettings'
import CodeSettings from './CodeSettings'

function SettingsPage({ initialTab }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(initialTab || 'basic')

  const tabs = [
    { id: 'basic',       label: t('tabs.basic') },
    { id: 'envSettings', label: t('tabs.envSettings') },
    { id: 'video',       label: t('tabs.video') },
    { id: 'code',        label: t('tabs.code') },
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
            <div style={{ marginTop: 12 }}><BlenderSettings /></div>
          </>
        )}
        {tab === 'video'       && <VideoSettings />}
        {tab === 'code'        && <CodeSettings />}
      </div>
    </div>
  )
}

export default SettingsPage
