import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { ProjectApi } from '../../../lib/api'

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

function SettingsTab({ detail, focusName, onUpdated, onDeleted }) {
  const { t } = useTranslation()
  const [form, setForm]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [saved, setSaved]       = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    setForm({ name: detail.project.name })
    setSaved(false)
    setError('')
  }, [detail])

  useEffect(() => {
    if (focusName && nameRef.current) {
      nameRef.current.focus()
      nameRef.current.select()
    }
  }, [focusName, form])

  const set = (key, val) => {
    setSaved(false)
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setError('')
    setSaved(false)
    if (!form.name.trim()) { setError(t('project.nameRequired')); return }
    setSaving(true)
    try {
      await ProjectApi.update({ id: detail.project.id, name: form.name.trim() })
      setSaved(true)
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
      <div className="ws-detail-left">
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
          {saved && <div className="success-msg">{t('common.saved')}</div>}

          <div className="form-actions">
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>
              {t('common.delete')}
            </button>
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
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
