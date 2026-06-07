import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectApi, WorkDirApi } from '../../lib/api'
import { useMessage } from '../../lib/toast'
import WorkspaceTab from './tabs/WorkspaceTab'
import SettingsTab from './tabs/SettingsTab'
import Breadcrumb from '../../components/Breadcrumb'

function ProjectDetailPage({ id, initialTab, focusName, navigate }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [detail, setDetail]   = useState(null)
  const [workDir, setWorkDir] = useState(null)
  const [workDirs, setWorkDirs] = useState([])
  const [tab, setTab]         = useState(initialTab || 'workspace')
  const [loadError, setLoadError] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)

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
      .catch(err => {
        if (String(err).includes('access denied')) {
          setAccessDenied(true)
        } else {
          showError(String(err))
          setLoadError(true)
        }
      })
  }

  useEffect(() => { load() }, [id])

  if (accessDenied) {
    return <div className="page"><p className="setting-desc">{t('permission.accessDenied')}</p></div>
  }

  if (loadError) {
    return <div className="page" />
  }

  if (!detail) {
    return <div className="page"><p className="setting-desc">{t('common.loading')}</p></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <Breadcrumb items={[
          { label: t('breadcrumb.projects'), onClick: () => navigate('projects') },
          { label: detail.project.name },
        ]} />
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
            role={detail.my_role || 'owner'}
            onUpdated={load}
            onDeleted={() => navigate('projects')}
          />
        )}
      </div>
    </div>
  )
}

export default ProjectDetailPage
