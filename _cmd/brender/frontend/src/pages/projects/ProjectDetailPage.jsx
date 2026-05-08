import { useState, useEffect } from 'react'
import { ProjectService } from '../../../bindings/changeme'
import WorkspaceTab from './tabs/WorkspaceTab'
import SettingsTab from './tabs/SettingsTab'

const TABS = [
  { id: 'workspace', label: 'ファイル一覧' },
  { id: 'settings',  label: '設定' },
]

function ProjectDetailPage({ id, navigate }) {
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('workspace')
  const [error, setError] = useState('')

  const load = () => {
    ProjectService.Get(id)
      .then(setDetail)
      .catch(err => setError(String(err)))
  }

  useEffect(() => { load() }, [id])

  if (error) {
    return <div className="page"><div className="error-msg">{error}</div></div>
  }

  if (!detail) {
    return <div className="page"><p className="setting-desc">読み込み中...</p></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => navigate('projects')}>
            プロジェクト
          </button>
          <span className="breadcrumb-sep">›</span>
          <span>{detail.project.name}</span>
        </div>
      </div>

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
        {tab === 'workspace' && (
          <WorkspaceTab
            projectID={id}
            projectName={detail.project.name}
            navigate={navigate}
          />
        )}
        {tab === 'settings' && (
          <SettingsTab detail={detail} onUpdated={load} onDeleted={() => navigate('projects')} />
        )}
      </div>
    </div>
  )
}

export default ProjectDetailPage
