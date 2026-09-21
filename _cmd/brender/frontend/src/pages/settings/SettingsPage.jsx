import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isWails } from '../../lib/api/_client'
import BasicSettings from './BasicSettings'
import BlenderSettings from './BlenderSettings'
import DirectorySettings from './DirectorySettings'
import VideoSettings from './VideoSettings'
import CodeSettings from './CodeSettings'
import TagSettings from './TagSettings'
import ServerSettings from './ServerSettings'
import SystemSettings from './SystemSettings'

function SettingsPage({ initialTab, navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(initialTab || 'basic')

  const wails = isWails()
  const tabs = [
    { id: 'basic',       label: t('tabs.basic') },
    ...(wails ? [
      { id: 'blender',     label: t('tabs.blender') },
      { id: 'directory',   label: t('tabs.directory') },
      { id: 'video',       label: t('tabs.video') },
      { id: 'code',        label: t('tabs.code') },
      { id: 'tag',         label: t('tabs.tag') },
      { id: 'server',      label: <>{t('tabs.server')}<span className="badge-experimental" style={{ marginLeft: 6 }}>{t('common.experimental')}</span></> },
      { id: 'system',      label: t('tabs.system') },
    ] : []),
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
        {tab === 'blender'   && <BlenderSettings navigate={navigate} />}
        {tab === 'directory' && <DirectorySettings navigate={navigate} />}
        {tab === 'video'     && <VideoSettings />}
        {tab === 'code'      && <CodeSettings />}
        {tab === 'tag'       && <TagSettings />}
        {tab === 'server'    && <ServerSettings />}
        {tab === 'system'    && <SystemSettings />}
      </div>
    </div>
  )
}

export default SettingsPage
