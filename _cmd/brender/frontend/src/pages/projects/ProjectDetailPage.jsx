import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectApi } from '../../lib/api'
import WorkspaceTab from './tabs/WorkspaceTab'
import SettingsTab from './tabs/SettingsTab'

function ProjectDetailPage({ id, navigate }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('workspace')
  const [error, setError] = useState('')

  const tabs = [
    { id: 'workspace', label: t('tabs.fileList') },
    { id: 'settings',  label: t('tabs.settings') },
  ]

  const load = () => {
    ProjectApi.get({ id })
      .then(setDetail)
      .catch(err => setError(String(err)))
  }

  useEffect(() => { load() }, [id])

  if (error) {
    return <div className="page"><div className="error-msg">{error}</div></div>
  }

  if (!detail) {
    return <div className="page"><p className="setting-desc">{t('common.loading')}</p></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => navigate('projects')}>
            {t('breadcrumb.projects')}
          </button>
          <span className="breadcrumb-sep">›</span>
          <span>{detail.project.name}</span>
        </div>
      </div>

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
