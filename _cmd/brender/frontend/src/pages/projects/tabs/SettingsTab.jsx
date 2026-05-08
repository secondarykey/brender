import { useState, useEffect } from 'react'
import { ProjectService } from '../../../../bindings/changeme'

function SettingsTab({ detail, onUpdated, onDeleted }) {
  const [form, setForm]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [saved, setSaved]       = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setForm({ name: detail.project.name })
    setSaved(false)
    setError('')
  }, [detail])

  const set = (key, val) => {
    setSaved(false)
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setError('')
    setSaved(false)
    if (!form.name.trim()) { setError('プロジェクト名を入力してください'); return }
    setSaving(true)
    try {
      await ProjectService.Update(detail.project.id, form.name.trim())
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
      await ProjectService.Delete(detail.project.id)
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
    <div className="form" style={{ maxWidth: 480 }}>
      <div className="form-field">
        <label className="form-label">プロジェクト名 <span className="required">*</span></label>
        <input
          className="form-input"
          value={form.name}
          onChange={e => set('name', e.target.value)}
        />
      </div>

      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">保存しました</div>}

      <div className="form-actions">
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>
          削除
        </button>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">プロジェクトを削除しますか？</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">プロジェクト</span>{detail.project.name}</p>
              <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                関連するワークスペースおよびジョブも削除されます。この操作は取り消せません。
              </p>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsTab
