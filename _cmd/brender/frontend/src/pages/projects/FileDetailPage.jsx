import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WorkspaceApi, ProjectApi, WorkDirApi, FavoriteApi } from '../../lib/api'
import HierarchyBreadcrumb from '../../components/HierarchyBreadcrumb'
import EntityIcon from '../../components/EntityIcon'
import AccessDenied from '../../components/AccessDenied'
import WorkspacePanel from './WorkspacePanel'
import WorkspaceRail from './file/WorkspaceRail'
import FileHistory from './file/FileHistory'
import FileSettingsTab from './file/FileSettingsTab'

// ── ページ本体 ────────────────────────────────────────────
// ファイル1件の画面。ワークスペースはこの中で開く（単独のページは無い）。
//   タブ「ワークスペース」… 左: 一覧（WorkspaceRail） / 右: 選んだ1件（WorkspacePanel）
//   タブ「実行履歴」    … このファイル全体の履歴
//   タブ「ファイル設定」
// タブの中身は file/（一覧・履歴・設定）と WorkspacePanel に分けてある。
// workspaceID は「どのワークスペースを開いておくか」。無ければ一覧の先頭を開く。
// fileID が無く workspaceID だけ渡された場合（古い実行結果からの遷移など）は、ワークスペースから引く。
function FileDetailPage({ projectID, projectName: initialProjectName, fileID: initialFileID, fileName, workspaceID, focusName, initialTab, navigate }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(workspaceID ? 'workspace' : (initialTab || 'workspace'))
  const [projectName, setProjectName] = useState(initialProjectName)
  const [fileID, setFileID] = useState(initialFileID || '')
  const [currentFileName, setCurrentFileName] = useState(fileName || '')
  const [workDirStatus, setWorkDirStatus] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [fileRole, setFileRole] = useState('owner')
  const [workspaces, setWorkspaces] = useState(null) // null = 未読込
  const [railReload, setRailReload] = useState(0)
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    if (fileID || !workspaceID) return
    WorkspaceApi.get({ projectID, workspaceID })
      .then(d => {
        const fid = d?.workspace?.project_file_id
        if (!fid) return
        setFileID(fid)
        setCurrentFileName(prev => prev || d.project_files?.find(f => f.id === fid)?.name || '')
      })
      .catch(err => {
        if (String(err).includes('access denied')) setAccessDenied(true)
      })
  }, [projectID, fileID, workspaceID])

  useEffect(() => {
    if (!fileID) return
    FavoriteApi.isFavorite({ fileID })
      .then(v => setFavorite(!!v))
      .catch(() => {})
  }, [fileID])

  useEffect(() => {
    if (!fileID) return
    // ファイル権限チェック + ロール取得
    ProjectApi.getFile({ fileID })
      .then(f => {
        if (f?.my_role) setFileRole(f.my_role)
        if (f?.name) setCurrentFileName(prev => prev || f.name)
      })
      .catch(err => {
        if (String(err).includes('access denied')) setAccessDenied(true)
      })
    // プロジェクト情報取得（パンくず名もAPIから取得して統一）
    ProjectApi.get({ id: projectID })
      .then(d => {
        if (d?.project?.name) setProjectName(d.project.name)
        WorkDirApi.list().then(dirs => {
          const wd = (dirs || []).find(w => w.id === d?.project?.work_dir_id)
          setWorkDirStatus(wd?.status || null)
        }).catch(() => {})
      })
      .catch(err => {
        if (String(err).includes('access denied')) setProjectName(t('permission.accessDeniedLabel'))
      })
  }, [projectID, fileID])

  if (accessDenied) {
    return <AccessDenied onBack={() => navigate('project', { id: projectID })} />
  }

  if (!fileID) {
    return <div className="page"><p className="setting-desc">{t('common.loading')}</p></div>
  }

  const tabs = [
    { id: 'workspace', label: t('tabs.workspaceList'), icon: 'workspace', count: workspaces ? workspaces.length : null },
    { id: 'history',   label: t('tabs.history'), icon: 'job' },
    { id: 'settings',  label: t('tabs.fileSettings') },
  ]

  // 開いておくワークスペース。指定が無ければ一覧の先頭。
  // 指定は一覧に載っているかを見ずに信じる（作成・複製の直後は一覧の読み直しより先に指定が届く）。
  // 既に消えたものを指していた場合は WorkspacePanel が onMissing で知らせるので、指定を外す。
  const selectedID = workspaceID || workspaces?.[0]?.id || null

  const selectWorkspace = (id, extra = {}) => {
    navigate('file', { projectID, projectName, fileID, fileName: currentFileName, workspaceID: id, ...extra })
  }

  return (
    <div className="page">
      <div className="page-header">
        <HierarchyBreadcrumb
          navigate={navigate}
          projectID={projectID}
          projectName={projectName}
          fileID={fileID}
          fileName={currentFileName}
        />
      </div>

      {workDirStatus === 'lock' && (
        <div className="notice-banner notice-error">{t('project.workDirLockError')}</div>
      )}
      {workDirStatus === 'inactive' && (
        <div className="notice-banner">{t('project.workDirInactiveWarning')}</div>
      )}

      <div className="tab-nav">
        {tabs.map(tb => (
          <button
            key={tb.id}
            className={`tab-btn${tab === tb.id ? ' active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.icon && <EntityIcon type={tb.icon} />}
            {tb.label}
            {tb.count !== null && tb.count !== undefined && <span className="tab-count">{tb.count}</span>}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'workspace' && (
          <div className="file-split">
            <WorkspaceRail
              projectID={projectID}
              fileID={fileID}
              fileName={currentFileName}
              selectedID={selectedID}
              onSelect={selectWorkspace}
              onEnqueued={() => navigate('queue')}
              workDirLocked={workDirStatus === 'lock'}
              role={fileRole}
              onLoaded={setWorkspaces}
              reloadTrigger={railReload}
            />
            <div className="ws-pane entity-workspace">
              {selectedID && (
                <WorkspacePanel
                  key={selectedID}
                  projectID={projectID}
                  projectName={projectName}
                  fileID={fileID}
                  fileName={currentFileName}
                  workspaceID={selectedID}
                  focusName={focusName && selectedID === workspaceID}
                  role={fileRole}
                  workDirLocked={workDirStatus === 'lock'}
                  navigate={navigate}
                  onChanged={() => setRailReload(n => n + 1)}
                  onDeleted={() => { setRailReload(n => n + 1); selectWorkspace(undefined) }}
                  onMissing={() => selectWorkspace(undefined)}
                />
              )}
            </div>
          </div>
        )}
        {tab === 'history' && (
          <div className="file-history">
            <FileHistory
              projectID={projectID}
              fileID={fileID}
              navigate={navigate}
              projectName={projectName}
              fileName={currentFileName}
            />
          </div>
        )}
        {tab === 'settings' && (
          <FileSettingsTab
            projectID={projectID}
            fileID={fileID}
            fileName={currentFileName}
            role={fileRole}
            favorite={favorite}
            onFavoriteChange={setFavorite}
            onUpdated={f => setCurrentFileName(f.name)}
            onDeleted={() => navigate('project', { id: projectID })}
          />
        )}
      </div>
    </div>
  )
}

export default FileDetailPage
