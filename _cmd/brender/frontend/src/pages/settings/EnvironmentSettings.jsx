import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkDirApi } from '../../lib/api'

// ── 空き容量を GB 表示に変換 ────────────────────────────────
function fmtGB(bytes) {
  if (!bytes) return '—'
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
}

// ── ステータスバッジ ─────────────────────────────────────────
function StatusBadge({ status, t }) {
  const map = {
    active:   { cls: 'badge-green',  label: t('settings.workDirs.statusActive') },
    inactive: { cls: 'badge-yellow', label: t('settings.workDirs.statusInactive') },
    lock:     { cls: 'badge-red',    label: t('settings.workDirs.statusLock') },
  }
  const { cls, label } = map[status] || map.active
  return <span className={`status-badge ${cls}`}>{label}</span>
}

// ── 作業ディレクトリ一覧パネル ───────────────────────────────
function WorkDirPanel() {
  const { t } = useTranslation()
  const [dirs, setDirs]     = useState([])
  const [error, setError]   = useState('')
  const [adding, setAdding] = useState(false)
  const [newPath, setNewPath]         = useState('')
  const [newPriority, setNewPriority] = useState(0)
  const [diskInfo, setDiskInfo]       = useState({})

  const load = () => {
    WorkDirApi.list()
      .then(list => setDirs(list || []))
      .catch(err => setError(String(err)))
  }

  useEffect(() => { load() }, [])

  const handleCheck = async (wd) => {
    try {
      const info = await WorkDirApi.checkDir({ path: wd.path })
      setDiskInfo(prev => ({ ...prev, [wd.id]: info }))
    } catch (err) {
      setError(String(err))
    }
  }

  const handleStatusChange = async (wd, status) => {
    try {
      await WorkDirApi.update({ id: wd.id, path: wd.path, priority: wd.priority, status })
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  const handleDelete = async (wd) => {
    if (!window.confirm(t('settings.workDirs.confirmDelete') + '\n' + t('settings.workDirs.deleteWarning'))) return
    try {
      await WorkDirApi.delete({ id: wd.id })
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  const handleSelectDir = async () => {
    try {
      const dir = await Dialogs.OpenFile({ CanChooseDirectories: true, CanChooseFiles: false })
      if (dir) setNewPath(dir)
    } catch {}
  }

  const handleAdd = async () => {
    if (!newPath) return
    try {
      await WorkDirApi.create({ path: newPath, priority: newPriority })
      setAdding(false)
      setNewPath('')
      setNewPriority(0)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div>
      <h2 className="section-title">{t('settings.workDirs.title')}</h2>

      {error && <div className="error-msg">{error}</div>}

      <table className="data-table" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>{t('settings.workDirs.path')}</th>
            <th style={{ width: 60 }}>{t('settings.workDirs.priority')}</th>
            <th style={{ width: 90 }}>{t('settings.workDirs.status')}</th>
            <th style={{ width: 100 }}>{t('settings.workDirs.freeSpace')}</th>
            <th style={{ width: 160 }}></th>
          </tr>
        </thead>
        <tbody>
          {dirs.map(wd => {
            const info = diskInfo[wd.id]
            return (
              <tr key={wd.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {wd.path}
                  {info && !info.exists && (
                    <span className="badge-red" style={{ marginLeft: 8, fontSize: 11 }}>
                      {t('settings.workDirs.notExists')}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>{wd.priority}</td>
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
                <td style={{ textAlign: 'right', fontSize: 12 }}>
                  {info ? (info.exists ? fmtGB(info.free) : '—') : '—'}
                </td>
                <td style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm" onClick={() => handleCheck(wd)}>
                    {t('settings.workDirs.check')}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(wd)}>
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            )
          })}
          {dirs.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>—</td></tr>
          )}
        </tbody>
      </table>

      {adding ? (
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <input
              className="input-field"
              style={{ flex: 1 }}
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              placeholder={t('settings.workDirs.path')}
            />
            <button className="btn btn-sm" onClick={handleSelectDir}>{t('settings.selectFolder')}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13 }}>{t('settings.workDirs.priority')}</label>
            <input
              type="number"
              className="input-field"
              style={{ width: 80 }}
              value={newPriority}
              onChange={e => setNewPriority(Number(e.target.value))}
            />
            <button className="btn" onClick={handleAdd} disabled={!newPath}>{t('common.create')}</button>
            <button className="btn btn-ghost" onClick={() => { setAdding(false); setNewPath(''); setNewPriority(0) }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>{t('settings.workDirs.add')}</button>
      )}
    </div>
  )
}

function EnvironmentSettings() {
  return <WorkDirPanel />
}

export default EnvironmentSettings
