import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../../../lib/api'
import { useToast } from '../../../lib/toast'
import { onAppEvent } from '../../../lib/appEvents'
import { formatDateShort } from '../../../lib/dateFormat'
import Pagination from '../../../components/Pagination'
import BulkDeleteJobsDialog from './BulkDeleteJobsDialog'

const HISTORY_PAGE_SIZE = 5

// ワークスペースの実行履歴（ファイル画面の右側、サムネイルの下）。行を選ぶと実行結果を開く。
// キューが変わるたび（と reloadTrigger が変わったとき）に読み直す。
export default function WorkspaceHistory({ projectID, workspaceID, navigate, projectName, fileName, fileID, workspaceName, reloadTrigger }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [jobs, setJobs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE)
  const [bulkOpen, setBulkOpen] = useState(false)

  const load = useCallback((p, ps) => {
    QueueApi.listJobsByWorkspacePaged({ projectID, workspaceID, page: p ?? page, pageSize: ps ?? pageSize })
      .then(result => {
        setJobs(result?.jobs || [])
        setTotal(result?.total || 0)
      })
      .catch(() => {})
  }, [projectID, workspaceID, page, pageSize])

  useEffect(() => { load() }, [load, reloadTrigger])

  useEffect(() => onAppEvent('queue:changed', () => load()), [load])

  const statusLabel = (s) => t(`status.${s || 'running'}`)

  const totalPages  = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)

  const openJob = (j) => {
    navigate('job', {
      job: j,
      initialTab: 'render',
      backPage: 'workspace',
      backParams: { projectID, projectName, fileID, fileName, workspaceID, workspaceName },
    })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setBulkOpen(true)}>
          {t('job.bulkDelete')}
        </button>
      </div>

      {total === 0
        ? <p className="empty-msg">{t('workspace.noHistory')}</p>
        : (
          <>
            <div className="queue-history-list">
              {jobs.map(j => (
                <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => openJob(j)}>
                  <div className="queue-history-top">
                    <div className="queue-history-detail" style={{ marginTop: 0 }}>
                      <span>{j.start_frame}–{j.end_frame}f</span>
                      {j.engine  && <span>{j.engine}</span>}
                      {j.scene   && <span>{j.scene}</span>}
                      {j.camera  && <span>{j.camera}</span>}
                      {j.samples > 0 && <span>{j.samples}smp</span>}
                      {(j.resolution_x > 0 && j.resolution_y > 0) && <span>{j.resolution_x}×{j.resolution_y}</span>}
                      {j.enqueued_at && (
                        <span>{formatDateShort(j.enqueued_at)}</span>
                      )}
                    </div>
                    <span className={`status-badge status-${j.status || 'running'}`}>{statusLabel(j.status)}</span>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={currentPage} totalPages={totalPages} onChange={p => setPage(p)} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={total} />
          </>
        )
      }

      <BulkDeleteJobsDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        projectID={projectID}
        workspaceID={workspaceID}
        onDeleted={count => { load(); showToast(t('job.bulkDeleteResult', { count })) }}
      />
    </>
  )
}
