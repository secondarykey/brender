import { useState, useEffect } from 'react'
import { ProjectService, BlenderService } from '../../../../bindings/changeme'

function SettingsTab({ detail, onUpdated, onDeleted }) {
  const [blenders, setBlenders] = useState([])
  const [form, setForm]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [saved, setSaved]       = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setForm({
      name:             detail.project.name,
      blenderInstallID: detail.project.blender_install_id,
      scene:            detail.project.scene || '',
    })
    setSaved(false)
    setError('')
  }, [detail])

  useEffect(() => {
    BlenderService.List()
      .then(list => setBlenders(list || []))
      .catch(() => {})
  }, [])

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
      await ProjectService.Update(
        detail.project.id,
        form.name.trim(),
        form.blenderInstallID,
        form.scene,
      )
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

      <div className="form-field">
        <label className="form-label">デフォルト Blender</label>
        {blenders.length === 0 ? (
          <p className="setting-desc">Blenderが登録されていません（システム設定で追加してください）</p>
        ) : (
          <select
            className="form-select"
            value={form.blenderInstallID}
            onChange={e => set('blenderInstallID', Number(e.target.value))}
          >
            <option value={0}>— 未選択（一番上のBlenderを使用）—</option>
            {blenders.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.version || 'バージョン不明'})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="form-field">
        <label className="form-label">デフォルトシーン</label>
        <input
          className="form-input"
          value={form.scene}
          onChange={e => set('scene', e.target.value)}
          placeholder="空白の場合はBlenderのデフォルト"
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
