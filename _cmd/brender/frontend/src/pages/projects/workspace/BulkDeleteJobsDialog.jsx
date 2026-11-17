import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../../../lib/api'
import Dialog from '../../../components/Dialog'
import HoldButton from '../../../components/HoldButton'

// ワークスペースの実行履歴の一括削除。新しい順に keepCount 件を残して消す
// （データだけ消す・エラーのものだけ消す、も選べる）。入力は閉じても残し、エラーは閉じるときに消す。
//   onDeleted … (件数) 消せたとき
export default function BulkDeleteJobsDialog({ open, onClose, projectID, workspaceID, onDeleted }) {
  const { t } = useTranslation()
  const [keepCount, setKeepCount] = useState(5)
  const [dataOnly, setDataOnly]   = useState(false)
  const [errorOnly, setErrorOnly] = useState(false)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState('')

  const close = () => { setError(''); onClose() }

  const handleDelete = async () => {
    setBusy(true)
    setError('')
    try {
      const count = await QueueApi.bulkDeleteJobsByWorkspace({ projectID, workspaceID, keepCount: keepCount >= 0 ? keepCount : 0, dataOnly, errorOnly })
      close()
      onDeleted(count)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={t('job.bulkDeleteTitle')}
      onClose={close}
      closeOnBackdrop={!busy}
      message={error}
      messageSeverity="error"
      actions={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>
            {t('common.cancel')}
          </button>
          <HoldButton
            onClick={handleDelete}
            disabled={busy}
            className="btn btn-danger"
            helpText={t('common.holdToConfirm')}
          >
            {busy ? t('common.deleting') : t('common.delete')}
          </HoldButton>
        </div>
      }
    >
      <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
        {t('job.bulkDeleteDesc')}
      </p>
      <div className="form-field" style={{ marginBottom: 12 }}>
        <label className="form-label">{t('job.keepCount')}</label>
        <input
          type="number"
          min="0"
          value={keepCount}
          onChange={e => setKeepCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
          className="form-input"
          style={{ width: 100, opacity: errorOnly ? 0.4 : 1 }}
          disabled={busy || errorOnly}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: (busy || errorOnly) ? 'not-allowed' : 'pointer', fontSize: '0.9rem', marginBottom: 8, opacity: errorOnly ? 0.4 : 1 }}>
        <input
          type="checkbox"
          checked={dataOnly}
          onChange={e => setDataOnly(e.target.checked)}
          disabled={busy || errorOnly}
        />
        {t('job.bulkDeleteDataOnly')}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
        <input
          type="checkbox"
          checked={errorOnly}
          onChange={e => { setErrorOnly(e.target.checked); if (e.target.checked) setDataOnly(false) }}
          disabled={busy}
        />
        {t('job.bulkDeleteErrorOnly')}
      </label>
    </Dialog>
  )
}
