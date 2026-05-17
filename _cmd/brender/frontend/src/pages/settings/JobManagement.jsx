import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../../lib/api'
import { useMessage, useToast } from '../../lib/toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'

const DATA_STATUS_LABELS = {
  0: 'none',
  1: 'noneLocked',
  2: 'available',
  3: 'availableLocked',
  4: 'deleted',
  5: 'deletedLocked',
  6: 'corrupted',
  7: 'corruptedLocked',
  8: 'modified',
  9: 'modifiedLocked',
}

function DataStatusBadge({ status }) {
  const { t } = useTranslation()
  const key = DATA_STATUS_LABELS[status] ?? 'none'
  const isLocked = status % 2 === 1
  return (
    <span className={`status-badge ${isLocked ? 'status-locked' : ''} data-status-${key}`}>
      {t(`dataStatus.${key}`)}
    </span>
  )
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const PAGE_SIZE = 20

function JobManagement() {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const { showToast } = useToast()
  const [jobs, setJobs] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [cleanConfirm, setCleanConfirm] = useState(false)
  const [cleanStats, setCleanStats] = useState(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanMsg, setCleanMsg] = useState('')

  const load = useCallback(() => {
    QueueApi.listJobs()
      .then(list => setJobs(list || []))
      .catch(err => showError(String(err)))
  }, [])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const totalSize = jobs.reduce((sum, j) => {
    if (j.data_status === 2 || j.data_status === 3 || j.data_status === 6 || j.data_status === 7) {
      return sum + (j.disk_size || 0)
    }
    return sum
  }, 0)

  const handleCleanClick = async () => {
    try {
      const stats = await QueueApi.getCleanableJobStats()
      setCleanStats(stats)
      setCleanMsg('')
      setCleanConfirm(true)
    } catch (err) {
      showError(String(err))
    }
  }

  const handleCleanConfirm = async () => {
    setCleaning(true)
    setCleanMsg('')
    try {
      const deleted = await QueueApi.cleanJobData()
      setCleanConfirm(false)
      showToast(t('jobManagement.cleanComplete', { count: deleted }))
      load()
    } catch (err) {
      setCleanMsg(String(err))
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          {t('jobManagement.totalJobs', { count: jobs.length })} / {t('jobManagement.totalSize', { size: formatSize(totalSize) })}
        </div>
        <button className="btn btn-danger btn-sm" onClick={handleCleanClick}>
          {t('jobManagement.cleanData')}
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="empty-msg">{t('jobManagement.noJobs')}</p>
      ) : (
        <>
          <table className="queue-table">
            <thead>
              <tr>
                <th>{t('table.project')}</th>
                <th>{t('table.workspace')}</th>
                <th className="col-c">{t('table.status')}</th>
                <th className="col-c">{t('jobManagement.dataStatus')}</th>
                <th className="col-r">{t('jobManagement.diskSize')}</th>
                <th className="col-c">{t('table.completedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {pageJobs.map(j => (
                <tr key={j.id}>
                  <td>{j.project_name || '—'}</td>
                  <td>{j.workspace_name || '—'}</td>
                  <td className="col-c">
                    <span className={`status-badge status-${j.status}`}>{t(`status.${j.status}`)}</span>
                  </td>
                  <td className="col-c"><DataStatusBadge status={j.data_status} /></td>
                  <td className="col-r num-cell">{formatSize(j.disk_size)}</td>
                  <td className="col-c date-cell">{formatDate(j.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={currentPage} totalPages={totalPages} onChange={p => setPage(p)} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={jobs.length} />
        </>
      )}

      <ConfirmDialog
        open={cleanConfirm}
        title={t('jobManagement.cleanTitle')}
        onConfirm={handleCleanConfirm}
        onCancel={() => setCleanConfirm(false)}
        confirmLabel={t('jobManagement.cleanConfirm')}
        busy={cleaning}
        message={cleanMsg}
      >
        {cleanStats && (
          <p>{t('jobManagement.cleanDescription', { count: cleanStats.count, size: formatSize(cleanStats.total_size) })}</p>
        )}
      </ConfirmDialog>
    </div>
  )
}

export default JobManagement
