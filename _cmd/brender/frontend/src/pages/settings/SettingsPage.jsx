import { useState } from 'react'
import EnvironmentSettings from './EnvironmentSettings'
import BlenderSettings from './BlenderSettings'

const TABS = [
  { id: 'env', label: '環境' },
  { id: 'blender', label: 'Blender' },
]

function SettingsPage() {
  const [tab, setTab] = useState('env')

  return (
    <div className="page">
      <h1 className="page-title">設定</h1>
      <div className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tab === 'env' && <EnvironmentSettings />}
        {tab === 'blender' && <BlenderSettings />}
      </div>
    </div>
  )
}

export default SettingsPage
