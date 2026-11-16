import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../../../lib/api'
import { onAppEvent } from '../../../lib/appEvents'
import { formatDateFull, formatDuration } from '../../../lib/dateFormat'
import Pagination from '../../../components/Pagination'

const HISTORY_PAGE_SIZE = 5

// ファイル画面の「実行履歴」タブ。このファイルの全ワークスペースの実行を新しい順に出す。
// 行を選ぶと実行結果を開き、戻るとこのタブに戻る。
export default function FileHistory({ projectID, fileID, navigate, projectName, fileName }) {
  const { t } = useTranslation()
  const [jobs, setJobs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE)

  const load = useCallback((p, ps) => {
    QueueApi.listJobsByProjectFilePaged({ projectID, fileID, page: p ?? page, pageSize: ps ?? pageSize })
      .then(result => {
        setJobs(result?.jobs || [])
        setTotal(result?.total || 0)
      })
      .catch(() => {})
  }, [projectID, fileID, page, pageSize])

  useEffect(() => { load() }, [load])

  useEffect(() => onAppEvent('queue:changed', () => load()), [load])

  const statusLabel = (s) => t(`status.${s || 'running'}`)

  const totalPages  = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)

  if (total === 0) {
    return <p className="empty-msg">{t('workspace.noHistory')}</p>
  }

  const openJob = (j) => {
    navigate('job', {
      job: j,
      initialTab: 'render',
      backPage: 'file',
      backParams: { projectID, projectName, fileID, fileName, initialTab: 'history' },
    })
  }

  return (
    <>
      <div className="queue-history-list">
        {jobs.map(j => (
          <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => openJob(j)}>
            <div className="queue-history-top">
              <div>
                <span className="queue-history-name">{j.name || j.workspace_name}</span>
                <div className="queue-history-detail" style={{ marginTop: 4 }}>
                  {j.started_at && <span>{formatDateFull(j.started_at)}</span>}
                  {j.started_at && j.completed_at && <span>{formatDuration(j.started_at, j.completed_at, t)}</span>}
                </div>
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
