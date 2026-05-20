import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { BlenderApi, EnvironmentApi, CodesApi } from '../../lib/api'
import { useToast } from '../../lib/toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useMessage } from '../../lib/toast'

function BlenderSettings() {
  const { t } = useTranslation()
  const [blenders, setBlenders] = useState([])
  const [loading, setLoading] = useState(false)
  const { showError } = useMessage()
  const { showToast } = useToast()
  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const dragIndex = useRef(null)
  const [dragOver, setDragOver] = useState(null)
  const [maxJobs, setMaxJobs] = useState(1)
  const [savingMaxJobs, setSavingMaxJobs] = useState(false)
  const [outputFormat, setOutputFormat] = useState('')
  const [savingOutputFormat, setSavingOutputFormat] = useState(false)
  const [imageFormats, setImageFormats] = useState([])

  const load = () => {
    BlenderApi.list()
      .then(list => setBlenders(list || []))
      .catch(err => showError(String(err)))
  }

  useEffect(() => {
    load()
    EnvironmentApi.get()
      .then(env => {
        if (env?.max_concurrent_jobs > 0) setMaxJobs(env.max_concurrent_jobs)
        setOutputFormat(env?.output_format || '')
      })
      .catch(() => {})
    CodesApi.getImageFormats().then(list => setImageFormats(list || [])).catch(() => {})
  }, [])

  const handleMaxJobsSave = async () => {
    setSavingMaxJobs(true)
    try {
      await EnvironmentApi.setMaxConcurrentJobs({ n: maxJobs })
      showToast(t('common.saved'))
    } catch (err) {
      showError(String(err))
    } finally {
      setSavingMaxJobs(false)
    }
  }

  const handleOutputFormatSave = async () => {
    setSavingOutputFormat(true)
    try {
      await EnvironmentApi.setOutputFormat({ format: outputFormat })
      showToast(t('common.saved'))
    } catch (err) {
      showError(String(err))
    } finally {
      setSavingOutputFormat(false)
    }
  }

  const handleAdd = async () => {
    showError('')
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
      showError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm) return
    setDeleting(true)
    setConfirmError('')
    try {
      await BlenderApi.delete({ id: confirm.id })
      setConfirm(null)
      load()
    } catch (err) {
      setConfirmError(String(err))
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
      showError(String(err))
      load()
    }
  }

  const handleDragEnd = () => {
    dragIndex.current = null
    setDragOver(null)
  }

  return (
    <div>
      {blenders.length === 0 ? (
        <p className="empty-msg">{t('settings.noBlenders')}</p>
      ) : (
        <>
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
                    <button className="btn btn-danger" onClick={() => { setConfirm(b); setConfirmError('') }}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <span className="setting-desc">{blenders.length > 0 ? t('settings.reorderHint') : ''}</span>
        <button className="btn btn-green" onClick={handleAdd} disabled={loading}>
          {loading ? t('common.registering') : t('settings.addBlender')}
        </button>
      </div>

      <div className="form" style={{ maxWidth: 360, marginTop: 32 }}>
        <div className="form-field">
          <label className="form-label">{t('settings.maxConcurrentJobs')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              className="form-input"
              type="number"
              min={1}
              max={16}
              value={maxJobs}
              onChange={e => setMaxJobs(Math.max(1, Number(e.target.value)))}
              style={{ width: 80, textAlign: 'right' }}
            />
            <button className="btn btn-green btn-sm" onClick={handleMaxJobsSave} disabled={savingMaxJobs}>
              {savingMaxJobs ? t('common.saving') : t('common.save')}
            </button>
          </div>
          <span className="form-hint">{t('settings.maxConcurrentJobsHint')}</span>
        </div>
        <div className="form-field">
          <label className="form-label">{t('settings.renderOutputFormat')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="form-select"
              style={{ width: 160 }}
              value={outputFormat}
              onChange={e => setOutputFormat(e.target.value)}
            >
              {imageFormats.map(f => (
                <option key={f.code} value={f.code}>{f.label}</option>
              ))}
            </select>
            <button className="btn btn-green btn-sm" onClick={handleOutputFormatSave} disabled={savingOutputFormat}>
              {savingOutputFormat ? t('common.saving') : t('common.save')}
            </button>
          </div>
          <span className="form-hint">{t('settings.renderOutputFormatHint')}</span>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={t('settings.confirmDeleteBlender')}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
        message={confirmError || undefined}
      >
        {confirm && (
          <>
            <p><span className="dialog-label">{t('dialog.name')}</span>{confirm.name}</p>
            <p><span className="dialog-label">{t('dialog.version')}</span>{confirm.version || '—'}</p>
            <p><span className="dialog-label">{t('dialog.path')}</span>{confirm.path}</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}

export default BlenderSettings
