import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { ProjectApi, WorkDirApi } from '../../../lib/api'
import { onAppEvent } from '../../../lib/appEvents'
import { useToast } from '../../../lib/toast'

const IMAGE_FILTER = [{ DisplayName: 'Image', Pattern: '*.jpg;*.jpeg;*.png;*.bmp;*.webp' }]

function ProjectThumbnailPanel({ projectID }) {
  const { t } = useTranslation()
  const [src, setSrc]         = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    ProjectApi.getProjectThumbnail({ projectID })
      .then(data => setSrc(data || null))
      .catch(() => setSrc(null))
  }, [projectID])

  const handleClick = async () => {
    if (uploading) return
    try {
      const path = await Dialogs.OpenFile({ Filters: IMAGE_FILTER })
      if (!path) return
      setUploading(true)
      const data = await ProjectApi.setProjectThumbnail({ projectID, imagePath: path })
      setSrc(data || null)
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="thumbnail-panel">
      <h3 className="ws-detail-section-title">{t('workspace.thumbnail')}</h3>
      <div className="thumbnail-clickable" onClick={handleClick} title={t('workspace.clickToChangeThumbnail')}>
        {src
          ? <img className="thumbnail-img" src={src} alt="thumbnail" />
          : <div className="thumbnail-placeholder">No Image</div>
        }
      </div>
    </div>
  )
}

function fmtBytes(b) {
  if (b == null) return '…'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function WorkDirSection({ projectID, workDir, workDirs, onMigrated }) {
  const { t } = useTranslation()
  const [open, setOpen]                     = useState(false)
  const [diskSize, setDiskSize]             = useState(null)
  const [showMigrate, setShowMigrate]       = useState(false)
  const [targetID, setTargetID]             = useState('')
  const [migrating, setMigrating]           = useState(false)
  const [migrateProgress, setMigrateProgress] = useState(null)
  const [migrateError, setMigrateError]     = useState('')

  const activeTargets = workDirs.filter(w => w.status === 'active' && (!workDir || w.id !== workDir.id))

  useEffect(() => {
    if (!open) return
    WorkDirApi.getProjectDiskSize({ projectID })
      .then(size => setDiskSize(size))
      .catch(() => setDiskSize(null))
  }, [open, projectID])

  useEffect(() => {
    if (activeTargets.length > 0 && !targetID) {
      setTargetID(String(activeTargets[0].id))
    }
  }, [workDirs])

  useEffect(() => {
    const off = onAppEvent('workdir:migrate', data => {
      if (data.project_id !== projectID) return
      setMigrateProgress(data)
      if (data.status === 'done') {
        setMigrating(false)
        setShowMigrate(false)
        setMigrateProgress(null)
        onMigrated()
      } else if (data.status === 'error') {
        setMigrateError(t('project.migrateError'))
        setMigrating(false)
      }
    })
    return off
  }, [projectID])

  const handleMigrate = async () => {
    if (!targetID) return
    setMigrateError('')
    setMigrating(true)
    setMigrateProgress(null)
    try {
      await WorkDirApi.startMigration({ projectID, newWorkDirID: Number(targetID) })
    } catch (err) {
      setMigrateError(String(err))
      setMigrating(false)
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3
        className="ws-detail-section-title"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        {open ? '▾' : '▸'} {t('project.workDir')}
      </h3>
      {open && (
        <>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {workDir ? workDir.path : '—'}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
        {t('project.diskUsage')}: {fmtBytes(diskSize)}
      </div>
      {workDir && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-sm" onClick={() => setShowMigrate(true)}>
            {t('project.migrate')}
          </button>
        </div>
      )}
        </>
      )}

      {showMigrate && (
        <div className="dialog-overlay" onClick={() => !migrating && setShowMigrate(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">{t('project.migrateTitle')}</h3>
            <div className="dialog-body">
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 12 }}>
                {t('project.migrateWarning')}
              </p>
              {activeTargets.length === 0 ? (
                <p style={{ color: '#f17e72', fontSize: 13 }}>No active work directories available.</p>
              ) : (
                <select
                  className="form-select"
                  value={targetID}
                  onChange={e => setTargetID(e.target.value)}
                  disabled={migrating}
                  style={{ width: '100%' }}
                >
                  {activeTargets.map(w => (
                    <option key={w.id} value={String(w.id)}>{w.path}</option>
                  ))}
                </select>
              )}
              {migrateProgress && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  {t('project.migrateRunning')} {Math.round((migrateProgress.pct || 0) * 100)}%
                </div>
              )}
              {migrateError && <div className="error-msg" style={{ marginTop: 8 }}>{migrateError}</div>}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setShowMigrate(false)} disabled={migrating}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                onClick={handleMigrate}
                disabled={migrating || !targetID || activeTargets.length === 0}
              >
                {migrating ? t('project.migrateRunning') : t('project.migrateConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsTab({ detail, focusName, workDir, workDirs, onUpdated, onDeleted }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [form, setForm]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [confirm, setConfirm]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dirMsg, setDirMsg]       = useState('')
  const [dirError, setDirError]   = useState('')
  const [dirLoading, setDirLoading] = useState(false)
  const nameRef = useRef(null)
  const hasFocused = useRef(false)

  useEffect(() => {
    setForm({ name: detail.project.name })
    setError('')
  }, [detail])

  useEffect(() => {
    if (focusName && !hasFocused.current && nameRef.current) {
      nameRef.current.focus()
      nameRef.current.select()
      hasFocused.current = true
    }
  }, [focusName, form])

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError(t('project.nameRequired')); return }
    setSaving(true)
    try {
      await ProjectApi.update({ id: detail.project.id, name: form.name.trim() })
      showToast(t('common.saved'))
      onUpdated()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await ProjectApi.delete({ id: detail.project.id })
      onDeleted()
    } catch (err) {
      setError(String(err))
      setConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  if (!form) return null

  return (
    <div className="ws-detail-split">
      <div className="ws-detail-left" style={{ position: 'relative' }}>
        {dirLoading && (
          <div className="ws-list-overlay">
            <span className="ws-list-overlay-label">{t('common.processing')}</span>
          </div>
        )}
        <div className="form" style={{ maxWidth: 480 }}>
          <div className="form-field">
            <label className="form-label">{t('project.name')} <span className="required">*</span></label>
            <input
              ref={nameRef}
              className="form-input"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="form-actions">
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>
              {t('common.delete')}
            </button>
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>

        <WorkDirSection
          projectID={detail.project.id}
          workDir={workDir}
          workDirs={workDirs || []}
          onMigrated={onUpdated}
        />

        <div style={{ marginTop: 16 }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={async () => {
              setDirError('')
              setDirMsg('')
              try {
                const dir = await Dialogs.OpenFile({ CanChooseDirectories: true, CanChooseFiles: false })
                if (!dir) return
                setDirLoading(true)
                const result = await ProjectApi.addFilesFromDir({ projectID: detail.project.id, dir })
                onUpdated()
                if (result.errors?.length) {
                  setDirError(result.errors.join('\n'))
                } else {
                  setDirMsg(t('workspace.addFilesFromDirResult', { added: result.added, skipped: result.skipped }))
                  setTimeout(() => setDirMsg(''), 4000)
                }
              } catch (err) {
                setDirError(String(err))
              } finally {
                setDirLoading(false)
              }
            }}
          >
            {t('workspace.addFilesFromDir')}
          </button>
          {dirMsg && <div className="success-msg" style={{ marginTop: 6 }}>{dirMsg}</div>}
          {dirError && <div className="error-msg" style={{ marginTop: 6 }}>{dirError}</div>}
        </div>

        {confirm && (
          <div className="dialog-overlay" onClick={() => setConfirm(false)}>
            <div className="dialog" onClick={e => e.stopPropagation()}>
              <h3 className="dialog-title">{t('project.confirmDelete')}</h3>
              <div className="dialog-body">
                <p><span className="dialog-label">{t('dialog.project')}</span>{detail.project.name}</p>
                <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                  {t('project.deleteWarning')}
                </p>
              </div>
              <div className="dialog-actions">
                <button className="btn btn-ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ws-detail-right">
        <ProjectThumbnailPanel projectID={detail.project.id} />
      </div>
    </div>
  )
}

export default SettingsTab
