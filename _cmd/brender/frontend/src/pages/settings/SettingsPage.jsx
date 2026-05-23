import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BasicSettings from './BasicSettings'
import BlenderSettings from './BlenderSettings'
import DirectorySettings from './DirectorySettings'
import VideoSettings from './VideoSettings'
import CodeSettings from './CodeSettings'
import TagSettings from './TagSettings'

function SettingsPage({ initialTab, navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(initialTab || 'basic')

  const tabs = [
    { id: 'basic',       label: t('tabs.basic') },
    { id: 'blender',     label: t('tabs.blender') },
    { id: 'directory',   label: t('tabs.directory') },
    { id: 'video',       label: t('tabs.video') },
    { id: 'code',        label: t('tabs.code') },
    { id: 'tag',         label: t('tabs.tag') },
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
        {tab === 'basic'     && <BasicSettings />}
        {tab === 'blender'   && <BlenderSettings />}
        {tab === 'directory' && <DirectorySettings navigate={navigate} />}
        {tab === 'video'     && <VideoSettings />}
        {tab === 'code'      && <CodeSettings />}
        {tab === 'tag'       && <TagSettings />}
      </div>
    </div>
  )
}

export default SettingsPage
