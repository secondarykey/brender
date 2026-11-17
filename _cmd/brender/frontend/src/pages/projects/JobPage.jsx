import { useState, useEffect, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, ProjectApi, WorkspaceApi } from '../../lib/api'
import { onAppEvent } from '../../lib/appEvents'
import HierarchyBreadcrumb from '../../components/HierarchyBreadcrumb'
import AccessDenied from '../../components/AccessDenied'
import JobDetailTab from './job/JobDetailTab'
import RenderResultTab from './job/RenderResultTab'
import DataViewTab from './job/DataViewTab'
import { hasJobData } from './job/jobFiles'

// ── ページ本体 ────────────────────────────────────────────
// 実行結果（ジョブ1件）の画面。タブの中身は job/ に分けてある。
// 出力が残っていれば「レンダリング結果」、無ければ「詳細」を最初に開く。
function JobPage({ job: initialJob, jobID: propJobID, navigate, backPage, backParams, initialTab }) {
  const { t } = useTranslation()
  const id = propJobID || initialJob?.id
  const [tab, setTab]       = useState(initialJob && hasJobData(initialJob.data_status) ? 'render' : 'detail')
  const [job, setJob]       = useState(initialJob || null)
  const [names, setNames]   = useState({ project: '', file: '', workspace: '' })
  const [accessDenied, setAccessDenied] = useState(false)
  const [fileRole, setFileRole] = useState('owner')

  useLayoutEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [])

  useEffect(() => {
    // initialJob が渡されても権限チェックは行う
    QueueApi.getJob({ id }).then(j => { if (j) setJob(j) }).catch(err => {
      if (String(err).includes('access denied')) setAccessDenied(true)
    })
  }, [id])

  // ファイル権限のロール取得
  useEffect(() => {
    const fileID = initialJob?.project_file_id || job?.project_file_id
    if (!fileID) return
    ProjectApi.getFile({ fileID })
      .then(f => { if (f?.my_role) setFileRole(f.my_role) })
      .catch(() => {})
  }, [job?.project_file_id, initialJob?.project_file_id])

  useEffect(() => {
    if (!job) return
    setNames(prev => ({ ...prev, file: job.file_name || '' }))
    // 各名前を独立して取得（一方の権限拒否が他方に影響しない）
    if (job.project_id) {
      ProjectApi.get({ id: job.project_id })
        .then(d => setNames(prev => ({ ...prev, project: d?.project?.name || '' })))
        .catch(err => {
          if (String(err).includes('access denied')) setNames(prev => ({ ...prev, project: t('permission.accessDeniedLabel') }))
        })
    }
    if (job.project_id && job.workspace_id) {
      WorkspaceApi.get({ projectID: job.project_id, workspaceID: job.workspace_id })
        .then(d => setNames(prev => ({ ...prev, workspace: d?.workspace?.name || '' })))
        .catch(() => {})
    }
  }, [job?.project_id, job?.workspace_id, job?.file_name])

  useEffect(() => {
    if (!job?.project_id || !job?.workspace_id) return
    return onAppEvent('queue:changed', () => {
      QueueApi.listJobsByWorkspace({ projectID: job.project_id, workspaceID: job.workspace_id })
        .then(list => {
          const updated = (list || []).find(j => j.id === id)
          if (updated) setJob(updated)
        })
        .catch(() => {})
    })
  }, [id, job?.project_id, job?.workspace_id])

  const handleDataStatusChanged = (next) => {
    setJob(prev => ({ ...prev, data_status: next }))
  }

  const handleDeleted = () => {
    navigate(backPage || 'projects', backParams || {})
  }

  if (accessDenied) {
    return <AccessDenied onBack={() => navigate(backPage || 'projects', backParams || {})} />
  }

  if (!job) {
    return <div className="page"><p className="setting-desc">{t('common.loading')}</p></div>
  }

  const tabs = [
    { id: 'render', label: t('tabs.renderResults') },
    { id: 'data',   label: t('tabs.dataView') },
    { id: 'detail', label: t('tabs.jobResult') },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <HierarchyBreadcrumb
          navigate={navigate}
          projectID={job.project_id}
          projectName={names.project}
          fileID={job.project_file_id}
          fileName={names.file}
          workspaceID={job.workspace_id}
          workspaceName={names.workspace}
          job
        />
      </div>

      <div className="tab-nav">
        {tabs.map(tb => (
          <button key={tb.id} className={`tab-btn${tab === tb.id ? ' active' : ''}`} onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'detail' && (
          <JobDetailTab
            job={job}
            onDeleted={handleDeleted}
            onDataStatusChanged={handleDataStatusChanged}
            role={fileRole}
          />
        )}
        {tab === 'render' && (
          <RenderResultTab job={job} role={fileRole} />
        )}
        {tab === 'data' && (
          <DataViewTab job={job} role={fileRole} />
        )}
      </div>
    </div>
  )
}

export default JobPage
