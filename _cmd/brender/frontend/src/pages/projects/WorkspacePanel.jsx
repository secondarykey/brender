import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WorkspaceApi } from '../../lib/api'
import { useMessage } from '../../lib/toast'
import ThumbnailPicker from '../../components/ThumbnailPicker'
import AccessDenied from '../../components/AccessDenied'
import WorkspaceSettingsForm from './workspace/WorkspaceSettingsForm'
import WorkspaceHistory from './workspace/WorkspaceHistory'

// ── パネル本体 ────────────────────────────────────────────
// ファイル画面の右側に出す、ワークスペース1件ぶんの表示。単独のページにはしない
// （ワークスペースは必ずファイルの中で開く。どのファイルの設定かを画面から消さないため）。
// 中身は workspace/ に分けてある（設定フォーム・実行履歴とそのダイアログ）。
//   onChanged … 名称変更・複製など、左の一覧を読み直すべき変更があったとき
//   onDeleted … 削除したとき
//   onMissing … 読み込めなかったとき（既に消えたワークスペースを指していた等）
function WorkspacePanel({ projectID, projectName, fileID, fileName, workspaceID, focusName, role, workDirLocked, navigate, onChanged, onDeleted, onMissing }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [detail, setDetail]             = useState(null)
  const [name, setName]                 = useState('')
  const [loadFailed, setLoadFailed]     = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [historyReload, setHistoryReload] = useState(0)

  useEffect(() => {
    let alive = true
    WorkspaceApi.get({ projectID, workspaceID })
      .then(d => {
        if (!alive) return
        setDetail(d)
        setName(d.workspace.name)
      })
      .catch(err => {
        if (!alive) return
        if (String(err).includes('access denied')) {
          setAccessDenied(true)
        } else {
          showError(String(err))
          setLoadFailed(true)
          if (onMissing) onMissing()
        }
      })
    return () => { alive = false }
  }, [projectID, workspaceID, showError])

  if (accessDenied) {
    return <AccessDenied onBack={() => navigate('file', { projectID, projectName, fileID, fileName })} />
  }
  if (loadFailed) return null
  if (!detail) {
    return <p className="setting-desc">{t('common.loading')}</p>
  }

  // 設定と履歴は横に並べ、それぞれ別々にスクロールする（狭いときは縦に積む。style.css の .ws-pane）。
  // テストレンダリングの結果を、設定を見たまま確かめられるようにするため。
  // 設定フォーム末尾の操作行（削除・Test・実行・保存）は .form-actions の sticky で下端に固定している。
  return (
    <>
      <div className="ws-pane-body">
        <div className="ws-pane-form">
          <WorkspaceSettingsForm
            projectID={projectID}
            projectName={projectName}
            fileID={fileID}
            fileName={fileName}
            workspaceID={workspaceID}
            detail={detail}
            focusName={focusName}
            role={role}
            onUpdated={savedName => { setName(savedName); onChanged() }}
            onCopied={onChanged}
            onDeleted={onDeleted}
            onTestEnqueued={() => setHistoryReload(n => n + 1)}
            onRenderEnqueued={() => navigate('queue')}
            workDirLocked={workDirLocked}
            navigate={navigate}
          />
        </div>
        <div className="ws-pane-history">
          <ThumbnailPicker
            fetcher={() => (fileID ? WorkspaceApi.getThumbnail({ projectID, fileID, workspaceID }) : null)}
            deps={[projectID, fileID, workspaceID]}
            save={imagePath => WorkspaceApi.setThumbnail({ projectID, fileID, workspaceID, imagePath })}
            disabled={!fileID}
          />
          <h3 className="ws-detail-section-title">{t('tabs.history')}</h3>
          <WorkspaceHistory
            projectID={projectID}
            workspaceID={workspaceID}
            navigate={navigate}
            projectName={projectName}
            fileID={fileID}
            fileName={fileName}
            workspaceName={name}
            reloadTrigger={historyReload}
          />
        </div>
      </div>
    </>
  )
}

export default WorkspacePanel
