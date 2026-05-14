import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectApi, WorkDirApi } from '../../lib/api'
import WorkspaceTab from './tabs/WorkspaceTab'
import SettingsTab from './tabs/SettingsTab'

function ProjectDetailPage({ id, initialTab, focusName, navigate }) {
  const { t } = useTranslation()
  const [detail, setDetail]   = useState(null)
  const [workDir, setWorkDir] = useState(null)
  const [workDirs, setWorkDirs] = useState([])
  const [tab, setTab]         = useState(initialTab || 'workspace')
  const [error, setError]     = useState('')

  const tabs = [
    { id: 'workspace', label: t('tabs.fileList') },
    { id: 'settings',  label: t('tabs.projectSettings') },
  ]

  const load = () => {
    Promise.all([ProjectApi.get({ id }), WorkDirApi.list()])
      .then(([d, list]) => {
        setDetail(d)
        const dirs = list || []
        setWorkDirs(dirs)
        setWorkDir(dirs.find(w => w.id === d.project.work_dir_id) || null)
      })
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

      {workDir?.status === 'lock' && (
        <div className="notice-banner notice-error">
          {t('project.workDirLockError')}
        </div>
      )}
      {workDir?.status === 'inactive' && (
        <div className="notice-banner">
          {t('project.workDirInactiveWarning')}
        </div>
      )}

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
          <SettingsTab
            detail={detail}
            focusName={focusName}
            workDir={workDir}
            workDirs={workDirs}
            onUpdated={load}
            onDeleted={() => navigate('projects')}
          />
        )}
      </div>
    </div>
  )
}

export default ProjectDetailPage
