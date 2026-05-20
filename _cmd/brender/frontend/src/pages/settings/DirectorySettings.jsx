import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EnvironmentSettings from './EnvironmentSettings'
import JobManagement from './JobManagement'

function DirectorySettings({ initialSubTab, navigate }) {
  const { t } = useTranslation()
  const [subTab, setSubTab] = useState(initialSubTab || 'workDirs')

  const subTabs = [
    { id: 'workDirs',       label: t('tabs.workDirs') },
    { id: 'dataManagement', label: t('tabs.jobManagement') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {subTabs.map(st => (
          <button
            key={st.id}
            className={`btn btn-sm ${subTab === st.id ? 'btn-outline-active' : 'btn-outline'}`}
            onClick={() => setSubTab(st.id)}
          >
            {st.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {subTab === 'workDirs' && <EnvironmentSettings />}
        {subTab === 'dataManagement' && <JobManagement navigate={navigate} />}
      </div>
    </div>
  )
}

export default DirectorySettings
