import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkDirApi } from '../../lib/api'
import { onAppEvent } from '../../lib/appEvents'

function fmtGB(bytes) {
  if (!bytes) return null
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
}

function StatusBadge({ status, t }) {
  const map = {
    active:   { cls: 'badge-green',  label: t('settings.workDirs.statusActive') },
    inactive: { cls: 'badge-yellow', label: t('settings.workDirs.statusInactive') },
    lock:     { cls: 'badge-red',    label: t('settings.workDirs.statusLock') },
  }
  const { cls, label } = map[status] || map.active
  return <span className={cls}>{label}</span>
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(1) + ' GB'
}

function InfoRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: last ? 0 : 6 }}>
      <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem' }}>{value}</span>
    </div>
  )
}

// ── 編集ダイアログ ────────────────────────────────────────
function EditDialog({ wd, onClose, onSaved }) {
  const { t } = useTranslation()
  const [path, setPath]           = useState(wd.path)
  const [status, setStatus]       = useState(wd.status)
  const [saving, setSaving]       = useState(false)
  const [checking, setChecking]   = useState(false)
  const [checkInfo, setCheckInfo] = useState(null) // null | { free, exists, projectCount, dataSize }
  const [error, setError]         = useState('')
  const [changeDirProgress, setChangeDirProgress] = useState(null) // null | { pct }

  const pathChanged = path !== wd.path

  useEffect(() => {
    const off = onAppEvent('workdir:changedir', data => {
      if (data.work_dir_id !== wd.id) return
      if (data.status === 'done') {
        setChangeDirProgress(null)
        onSaved()
        onClose()
      } else if (data.status === 'error') {
        setChangeDirProgress(null)
        setError(t('project.migrateError'))
        setSaving(false)
      } else {
        setChangeDirProgress({ pct: data.pct })
      }
    })
    return off
  }, [wd.id, onSaved, onClose, t])

  const handleBrowse = async () => {
    try {
      const dir = await Dialogs.OpenFile({ CanChooseDirectories: true, CanChooseFiles: false })
      if (dir) { setPath(dir); setCheckInfo(null) }
    } catch (err) {
      setError(String(err))
    }
  }

  const handleCheck = async () => {
    setChecking(true)
    setError('')
    try {
      const [disk, stats] = await Promise.all([
        WorkDirApi.checkDir({ path }),
        WorkDirApi.getWorkDirStats({ id: wd.id }),
      ])
      setCheckInfo({
        free:         disk.free,
        exists:       disk.exists,
        projectCount: stats.project_count,
        dataSize:     stats.data_size,
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setChecking(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (pathChanged) {
        await WorkDirApi.update({ id: wd.id, path: wd.path, priority: wd.priority, status })
        await WorkDirApi.changeDir({ id: wd.id, newPath: path })
        setChangeDirProgress({ pct: 0 })
        // onClose は workdir:changedir done イベントで呼ばれる
      } else {
        await WorkDirApi.update({ id: wd.id, path: wd.path, priority: wd.priority, status })
        onSaved()
        onClose()
      }
    } catch (err) {
      setError(String(err))
      setSaving(false)
    }
  }

  const busy        = saving || changeDirProgress !== null
  const saveBlocked = busy || (pathChanged && !checkInfo)

  const row = { marginBottom: 16 }
  const lbl = { display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }

  return (
    <div className="dialog-overlay" onClick={busy ? undefined : onClose}>
      <div className="dialog dialog-wide" onClick={e => e.stopPropagation()}>
        <h3 className="dialog-title" style={{ marginBottom: 0 }}>{t('settings.workDirs.editTitle')}</h3>
        <div className="dialog-body">

          {/* Path */}
          <div style={row}>
            <span style={lbl}>{t('settings.workDirs.path')}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', color: pathChanged ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                {path}
              </span>
              <button className="btn btn-sm" onClick={handleBrowse} disabled={busy} style={{ flexShrink: 0 }}>
                {t('settings.selectDirectory')}
              </button>
            </div>
          </div>

          {/* Status */}
          <div style={row}>
            <span style={lbl}>{t('settings.workDirs.status')}</span>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <select
              className="form-select"
              style={{ width: 160 }}
              value={status}
              onChange={e => setStatus(e.target.value)}
              disabled={busy}
            >
              <option value="active">{t('settings.workDirs.statusActive')}</option>
              <option value="inactive">{t('settings.workDirs.statusInactive')}</option>
              <option value="lock">{t('settings.workDirs.statusLock')}</option>
            </select>
            </div>
          </div>

          {/* Check */}
          <div style={{ ...row, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-sm" onClick={handleCheck} disabled={checking || busy}>
              {checking ? t('common.processing') : t('settings.workDirs.checkSpace')}
            </button>
            {pathChanged && !checkInfo && (
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,200,100,0.85)' }}>
                {t('settings.workDirs.checkRequired')}
              </span>
            )}
          </div>

          {/* Check results */}
          {checkInfo && (
            <div style={{ ...row, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '10px 14px' }}>
              <InfoRow label={t('settings.workDirs.projects')}  value={`${checkInfo.projectCount} ${t('settings.workDirs.projectsUnit')}`} />
              <InfoRow label={t('settings.workDirs.dataSize')}  value={fmtBytes(checkInfo.dataSize)} />
              <InfoRow
                label={`${t('settings.workDirs.freeSpace')} (${pathChanged ? t('settings.workDirs.destination') : t('settings.workDirs.current')})`}
                value={checkInfo.exists ? fmtBytes(checkInfo.free) : <span className="badge-red">{t('settings.workDirs.notExists')}</span>}
                last
              />
            </div>
          )}

          {/* Migration progress */}
          {changeDirProgress && (
            <div style={row}>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                {t('project.migrateRunning')} {Math.round(changeDirProgress.pct * 100)}%
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 6 }}>
                <div style={{ background: '#4a7cdc', borderRadius: 4, height: 6, width: `${Math.round(changeDirProgress.pct * 100)}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}
        </div>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
          <button className="btn" onClick={handleSave} disabled={saveBlocked}>
            {changeDirProgress ? t('project.migrateRunning') : saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function EnvironmentSettings() {
  const { t } = useTranslation()
  const [dirs, setDirs]       = useState([])
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(null)
  const dragIndex = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const load = () => {
    WorkDirApi.list()
      .then(list => setDirs(list || []))
      .catch(err => setError(String(err)))
  }

  useEffect(() => { load() }, [])

  // ── ドラッグ並び替え ──────────────────────────────────────
  const handleDragStart = (e, index) => {
    dragIndex.current = index
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(index)
  }
  const handleDragLeave = () => setDragOver(null)
  const handleDragEnd   = () => { dragIndex.current = null; setDragOver(null) }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    setDragOver(null)
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === dropIndex) return

    const next = [...dirs]
    const [moved] = next.splice(from, 1)
    next.splice(dropIndex, 0, moved)
    setDirs(next)

    try {
      await WorkDirApi.reorder({ ids: next.map(d => d.id) })
    } catch (err) {
      setError(String(err))
      load()
    }
  }

  // ── 削除 ─────────────────────────────────────────────────
  const handleDelete = async (wd) => {
    setError('')
    try {
      await WorkDirApi.delete({ id: wd.id })
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  // ── 追加 ─────────────────────────────────────────────────
  const handleAdd = async () => {
    setError('')
    try {
      const dir = await Dialogs.OpenFile({ CanChooseDirectories: true, CanChooseFiles: false })
      if (!dir) return
      await WorkDirApi.create({ path: dir, priority: dirs.length })
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div>
      <h2 className="section-title">{t('settings.workDirs.title')}</h2>

      <div className="toolbar">
        <button className="btn" onClick={handleAdd}>
          {t('settings.workDirs.add')}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {dirs.length === 0 ? (
        <p className="empty-msg">{t('settings.workDirs.empty')}</p>
      ) : (
        <>
          <p className="setting-desc" style={{ marginBottom: 8 }}>
            {t('common.dragToReorder')}
          </p>
          <table className="blender-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>{t('settings.workDirs.path')}</th>
                <th style={{ width: 90 }}>{t('settings.workDirs.status')}</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {dirs.map((wd, index) => (
                <tr
                  key={wd.id}
                  draggable
                  onDragStart={e => handleDragStart(e, index)}
                  onDragOver={e => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={dragOver === index ? 'drag-over' : ''}
                >
                  <td className="drag-handle" title={t('common.dragToReorder')}>≡</td>
                  <td className="path-cell">{wd.path}</td>
                  <td><StatusBadge status={wd.status} t={t} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => setEditing(wd)} style={{ marginRight: 4 }}>
                      {t('common.edit')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(wd)}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {editing && (
        <EditDialog
          wd={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

export default EnvironmentSettings
