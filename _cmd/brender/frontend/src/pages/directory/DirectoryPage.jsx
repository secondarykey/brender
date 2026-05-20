import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EnvironmentSettings from '../settings/EnvironmentSettings'
import JobManagement from '../settings/JobManagement'

function DirectoryPage({ initialTab, navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(initialTab || 'workDirs')

  const tabs = [
    { id: 'workDirs',       label: t('tabs.workDirs') },
    { id: 'dataManagement', label: t('tabs.dataManagement') },
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
        {tab === 'workDirs' && <EnvironmentSettings />}
        {tab === 'dataManagement' && <JobManagement navigate={navigate} />}
      </div>
    </div>
  )
}

export default DirectoryPage
