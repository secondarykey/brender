import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { BlenderApi } from '../../lib/api'

function BlenderSettings() {
  const { t } = useTranslation()
  const [blenders, setBlenders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const dragIndex = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const load = () => {
    BlenderApi.list()
      .then(list => setBlenders(list || []))
      .catch(err => setError(String(err)))
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    setError('')
    const filters = window.navigator.platform.startsWith('Win')
      ? [{ DisplayName: 'Blender Executable', Pattern: '*.exe' }]
      : []
    try {
      const result = await Dialogs.OpenFile({ Filters: filters })
      if (!result) return
      setLoading(true)
      await BlenderApi.register({ path: result })
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm) return
    setDeleting(true)
    setError('')
    try {
      await BlenderApi.delete({ id: confirm.id })
      setConfirm(null)
      load()
    } catch (err) {
      setError(String(err))
      setConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleDragStart = (e, index) => {
    dragIndex.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(index)
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    setDragOver(null)
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === dropIndex) return

    const newList = [...blenders]
    const [moved] = newList.splice(from, 1)
    newList.splice(dropIndex, 0, moved)
    setBlenders(newList)

    try {
      await BlenderApi.reorder({ ids: newList.map(b => b.id) })
    } catch (err) {
      setError(String(err))
      load()
    }
  }

  const handleDragEnd = () => {
    dragIndex.current = null
    setDragOver(null)
  }

  return (
    <div>
      <h2 className="section-title">{t('tabs.blender')}</h2>

      <div className="toolbar">
        <button className="btn" onClick={handleAdd} disabled={loading}>
          {loading ? t('common.registering') : t('settings.addBlender')}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {blenders.length === 0 ? (
        <p className="empty-msg">{t('settings.noBlenders')}</p>
      ) : (
        <>
          <p className="setting-desc" style={{ marginBottom: 8 }}>
            {t('settings.reorderHint')}
          </p>
          <table className="blender-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>{t('table.name')}</th>
                <th>{t('table.version')}</th>
                <th>{t('table.path')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blenders.map((b, index) => (
                <tr
                  key={b.id}
                  draggable
                  onDragStart={e => handleDragStart(e, index)}
                  onDragOver={e => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={dragOver === index ? 'drag-over' : ''}
                >
                  <td className="drag-handle" title={t('common.dragToReorder')}>≡</td>
                  <td>
                    {index === 0 && <span className="default-badge">{t('common.default')}</span>}
                    {b.name}
                  </td>
                  <td>{b.version || '—'}</td>
                  <td className="path-cell">{b.path}</td>
                  <td>
                    <button className="btn btn-danger" onClick={() => setConfirm(b)}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">{t('settings.confirmDeleteBlender')}</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">{t('dialog.name')}</span>{confirm.name}</p>
              <p><span className="dialog-label">{t('dialog.version')}</span>{confirm.version || '—'}</p>
              <p><span className="dialog-label">{t('dialog.path')}</span>{confirm.path}</p>
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

export default BlenderSettings
