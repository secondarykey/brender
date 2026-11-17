import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WorkspaceApi } from '../../../lib/api'
import { useMessage } from '../../../lib/toast'
import ConfirmDialog from '../../../components/ConfirmDialog'

// ワークスペースの削除の確認。開くたびに作り直す（「強制削除」のチェックを毎回外しておく）。
// ロックしたジョブがあると、強制しない限りサーバが断る（locked_jobs_exist）。
// 失敗したら全体のメッセージに出して閉じる。
export default function WorkspaceDeleteDialog({ projectID, workspaceID, workspaceName, onCancel, onDeleted }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [deleting, setDeleting] = useState(false)
  const [force, setForce]       = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await WorkspaceApi.delete({ projectID, workspaceID, force })
      onDeleted()
    } catch (err) {
      const msg = String(err)
      showError(msg.includes('locked_jobs_exist') ? t('workspace.lockedJobsExist') : msg)
      onCancel()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ConfirmDialog
      open
      hold
      title={t('workspace.confirmDelete')}
      onCancel={onCancel}
      onConfirm={handleDelete}
      confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
      busy={deleting}
    >
      <p><span className="dialog-label">{t('dialog.workspace')}</span>{workspaceName}</p>
      <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
        {t('workspace.deleteWarning')}
      </p>
      <label className="form-checkbox-label" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
        {t('workspace.forceDeleteLabel')}
      </label>
    </ConfirmDialog>
  )
}
