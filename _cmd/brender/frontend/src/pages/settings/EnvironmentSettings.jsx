import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkDirApi } from '../../lib/api'

function fmtGB(bytes) {
  if (!bytes) return null
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
}

function EnvironmentSettings() {
  const { t } = useTranslation()
  const [dirs, setDirs]       = useState([])
  const [error, setError]     = useState('')
  const [adding, setAdding]   = useState(false)
  const [newPath, setNewPath] = useState('')
  const [diskInfo, setDiskInfo] = useState({})
  const [confirm, setConfirm]   = useState(null)
  const [deleting, setDeleting] = useState(false)
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

  // ── ステータス変更 ────────────────────────────────────────
  const handleStatusChange = async (wd, status) => {
    try {
      await WorkDirApi.update({ id: wd.id, path: wd.path, priority: wd.priority, status })
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  // ── チェック ─────────────────────────────────────────────
  const handleCheck = async (wd) => {
    try {
      const info = await WorkDirApi.checkDir({ path: wd.path })
      setDiskInfo(prev => ({ ...prev, [wd.id]: info }))
    } catch (err) {
      setError(String(err))
    }
  }

  // ── 削除 ─────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm) return
    setDeleting(true)
    setError('')
    try {
      await WorkDirApi.delete({ id: confirm.id })
      setConfirm(null)
      load()
    } catch (err) {
      setError(String(err))
      setConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  // ── 追加 ─────────────────────────────────────────────────
  const handleSelectDir = async () => {
    try {
      const dir = await Dialogs.OpenFile({ CanChooseDirectories: true, CanChooseFiles: false })
      if (dir) setNewPath(dir)
    } catch {}
  }

  const handleAdd = async () => {
    if (!newPath) return
    try {
      await WorkDirApi.create({ path: newPath, priority: dirs.length })
      setAdding(false)
      setNewPath('')
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  const handleCancelAdd = () => { setAdding(false); setNewPath('') }

  return (
    <div>
      <h2 className="section-title">{t('settings.workDirs.title')}</h2>

      <div className="toolbar">
        {!adding && (
          <button className="btn" onClick={() => setAdding(true)}>
            {t('settings.workDirs.add')}
          </button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {dirs.length === 0 && !adding ? (
        <p className="empty-msg">{t('settings.workDirs.empty')}</p>
      ) : (
        <>
          {dirs.length > 0 && (
            <p className="setting-desc" style={{ marginBottom: 8 }}>
              {t('common.dragToReorder')}
            </p>
          )}
          <table className="blender-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>{t('settings.workDirs.path')}</th>
                <th style={{ width: 100 }}>{t('settings.workDirs.status')}</th>
                <th style={{ width: 90 }}>{t('settings.workDirs.freeSpace')}</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {dirs.map((wd, index) => {
                const info = diskInfo[wd.id]
                const free = info?.exists ? fmtGB(info.free) : (info ? '—' : null)
                return (
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
                    <td className="path-cell">
                      {wd.path}
                      {info && !info.exists && (
                        <span className="badge-red" style={{ marginLeft: 8, fontSize: 11 }}>
                          {t('settings.workDirs.notExists')}
                        </span>
                      )}
                    </td>
                    <td>
                      <select
                        className="select-sm"
                        value={wd.status}
                        onChange={e => handleStatusChange(wd, e.target.value)}
                      >
                        <option value="active">{t('settings.workDirs.statusActive')}</option>
                        <option value="inactive">{t('settings.workDirs.statusInactive')}</option>
                        <option value="lock">{t('settings.workDirs.statusLock')}</option>
                      </select>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', textAlign: 'right' }}>
                      {free ?? '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => handleCheck(wd)} style={{ marginRight: 4 }}>
                        {t('settings.workDirs.check')}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setConfirm(wd)}>
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {adding && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <input
            className="input-field"
            style={{ flex: 1 }}
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            placeholder={t('settings.workDirs.path')}
            autoFocus
          />
          <button className="btn btn-sm" onClick={handleSelectDir}>{t('settings.selectFolder')}</button>
          <button className="btn" onClick={handleAdd} disabled={!newPath}>{t('common.create')}</button>
          <button className="btn btn-ghost" onClick={handleCancelAdd}>{t('common.cancel')}</button>
        </div>
      )}

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">{t('settings.workDirs.confirmDelete')}</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">{t('settings.workDirs.path')}</span>{confirm.path}</p>
              <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                {t('settings.workDirs.deleteWarning')}
              </p>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnvironmentSettings
