import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi } from '../../lib/api'
import { useMessage, useToast } from '../../lib/toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import JobDetailDialog from '../../components/JobDetailDialog'
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

const DATA_STATUS_GROUPS = [
  { key: 'available', statuses: [2, 3] },
  { key: 'deleted', statuses: [4, 5] },
  { key: 'corrupted', statuses: [6, 7] },
  { key: 'modified', statuses: [8, 9] },
  { key: 'none', statuses: [0, 1] },
]

function DataStatusBadge({ status }) {
  const { t } = useTranslation()
  const base = status % 2 === 1 ? status - 1 : status
  const baseKey = DATA_STATUS_LABELS[base] ?? 'none'
  const isLocked = status % 2 === 1
  return (
    <>
      <span className={`data-status-badge data-status-${baseKey}`}>{t(`dataStatus.${baseKey}`)}</span>
      {isLocked && <span className="data-status-badge data-status-locked">{t('common.locked')}</span>}
    </>
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

function JobManagement({ navigate }) {
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
  const [selected, setSelected] = useState(null)
  const [excludeStatuses, setExcludeStatuses] = useState(new Set([4, 5]))
  const [lockFilter, setLockFilter] = useState('hide')
  const [sortBySize, setSortBySize] = useState(true)

  const load = useCallback(() => {
    QueueApi.listJobs()
      .then(list => setJobs(list || []))
      .catch(err => showError(String(err)))
  }, [])

  useEffect(() => { load() }, [load])

  const filteredJobs = useMemo(() => {
    let result = jobs.filter(j => {
      if (excludeStatuses.has(j.data_status)) return false
      const isLocked = j.data_status % 2 === 1
      if (lockFilter === 'hide' && isLocked) return false
      if (lockFilter === 'only' && !isLocked) return false
      return true
    })
    if (sortBySize) {
      result = [...result].sort((a, b) => (b.disk_size || 0) - (a.disk_size || 0))
    }
    return result
  }, [jobs, excludeStatuses, lockFilter, sortBySize])

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs = filteredJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const totalSize = useMemo(() =>
    filteredJobs.reduce((sum, j) => sum + (j.disk_size || 0), 0),
    [filteredJobs]
  )

  const toggleStatusGroup = (statuses) => {
    setExcludeStatuses(prev => {
      const next = new Set(prev)
      const allExcluded = statuses.every(s => next.has(s))
      if (allExcluded) {
        statuses.forEach(s => next.delete(s))
      } else {
        statuses.forEach(s => next.add(s))
      }
      return next
    })
    setPage(1)
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          {t('jobManagement.totalJobs', { count: filteredJobs.length })} / {t('jobManagement.totalSize', { size: formatSize(totalSize) })}
        </div>
        <button className="btn btn-danger btn-sm" onClick={handleCleanClick}>
          {t('jobManagement.cleanData')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{t('jobManagement.filterLabel')}</span>
          {DATA_STATUS_GROUPS.map(g => {
            const included = !g.statuses.every(s => excludeStatuses.has(s))
            return (
              <button
                key={g.key}
                className={`btn btn-sm ${included ? 'btn-outline-active' : 'btn-outline'}`}
                onClick={() => toggleStatusGroup(g.statuses)}
              >
                {t(`jobManagement.statusFilter.${g.key}`)}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${lockFilter === 'include' ? 'btn-outline-active' : 'btn-outline'}`}
            onClick={() => { setLockFilter(v => v === 'include' ? 'hide' : 'include'); setPage(1) }}
          >
            {t('jobManagement.statusFilter.lockInclude')}
          </button>
          <button
            className={`btn btn-sm ${lockFilter === 'only' ? 'btn-outline-active' : 'btn-outline'}`}
            onClick={() => { setLockFilter(v => v === 'only' ? 'hide' : 'only'); setPage(1) }}
          >
            {t('jobManagement.statusFilter.lockOnly')}
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', opacity: 0.8, marginLeft: 'auto' }}>
          <input type="checkbox" checked={sortBySize} onChange={e => setSortBySize(e.target.checked)} />
          {t('jobManagement.sortBySize')}
        </label>
      </div>

      {filteredJobs.length === 0 ? (
        <p className="empty-msg">{t('jobManagement.noJobs')}</p>
      ) : (
        <>
          <table className="queue-table">
            <thead>
              <tr>
                <th>{t('table.jobName')}</th>
                <th className="col-c">{t('table.status')}</th>
                <th className="col-c">{t('jobManagement.dataStatus')}</th>
                <th className="col-r">{t('jobManagement.diskSize')}</th>
                <th className="col-c">{t('table.completedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {pageJobs.map(j => (
                <tr key={j.id} className="row-clickable" onClick={() => setSelected(j)}>
                  <td>
                    <button className="link-btn" onClick={e => { e.stopPropagation(); navigate && navigate('job', { job: j, initialTab: 'render', backPage: 'settings', backParams: { tab: 'jobManagement' } }) }}>
                      {j.name || '—'}
                    </button>
                  </td>
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
          <Pagination page={currentPage} totalPages={totalPages} onChange={p => setPage(p)} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={filteredJobs.length} />
        </>
      )}

      <JobDetailDialog
        job={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => { setSelected(null); load() }}
        onStatusChanged={(id, status) => {
          setJobs(prev => prev.map(j => j.id === id ? { ...j, data_status: status } : j))
          setSelected(prev => prev && prev.id === id ? { ...prev, data_status: status } : prev)
        }}
        navigate={navigate}
      />

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
