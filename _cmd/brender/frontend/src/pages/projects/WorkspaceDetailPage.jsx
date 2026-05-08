import { useState, useEffect, useCallback } from 'react'
import { WorkspaceService, BlenderService } from '../../../bindings/changeme'


// ── 設定タブ ──────────────────────────────────────────────
function SettingsTab({ projectID, workspaceID, detail, onUpdated, onDeleted }) {
  const [blenders, setBlenders]             = useState([])
  const [engines, setEngines]               = useState([])
  const [enginesLoading, setEnginesLoading] = useState(false)
  const [scenes, setScenes]                 = useState([])
  const [scenesLoading, setScenesLoading]   = useState(false)
  const [form, setForm]                     = useState(null)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')
  const [saved, setSaved]                   = useState(false)
  const [confirm, setConfirm]               = useState(false)
  const [deleting, setDeleting]             = useState(false)

  useEffect(() => {
    setForm({
      name:             detail.workspace.name,
      blenderInstallID: detail.workspace.blender_install_id,
      scene:            detail.workspace.scene || '',
      engine:           detail.workspace.engine || '',
      startFrame:       detail.workspace.start ?? 1,
      endFrame:         detail.workspace.end   ?? 250,
      frameStep:        detail.workspace.frame_step || 1,
      thread:           detail.workspace.thread || 0,
    })
    setSaved(false)
    setError('')
  }, [detail])

  useEffect(() => {
    BlenderService.List()
      .then(list => setBlenders(list || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!form) return
    setEnginesLoading(true)
    BlenderService.GetEngines(form.blenderInstallID)
      .then(list => setEngines(list || []))
      .catch(() => setEngines([]))
      .finally(() => setEnginesLoading(false))
  }, [form?.blenderInstallID])

  useEffect(() => {
    if (!form) return
    const fid = detail?.workspace?.project_file_id
    if (!fid || fid === 0) { setScenes([]); return }
    setScenesLoading(true)
    BlenderService.GetScenes(form.blenderInstallID, fid)
      .then(list => setScenes(list || []))
      .catch(() => setScenes([]))
      .finally(() => setScenesLoading(false))
  }, [form?.blenderInstallID, detail?.workspace?.project_file_id])

  const set = (key, val) => {
    setSaved(false)
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setError('')
    setSaved(false)
    if (!form.name.trim()) { setError('ワークスペース名を入力してください'); return }
    setSaving(true)
    try {
      await WorkspaceService.Update(
        projectID, workspaceID, form.name.trim(),
        form.blenderInstallID,
        form.scene, form.engine,
        form.startFrame, form.endFrame, form.frameStep, form.thread,
      )
      setSaved(true)
      onUpdated()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!form) return null

  return (
    <div className="form" style={{ maxWidth: 520 }}>
      <div className="form-field">
        <label className="form-label">ワークスペース名 <span className="required">*</span></label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
      </div>

      <div className="form-field">
        <label className="form-label">Blender</label>
        <select className="form-select" value={form.blenderInstallID} onChange={e => set('blenderInstallID', Number(e.target.value))}>
          <option value={0}>ファイルのデフォルト</option>
          {blenders.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({b.version || 'バージョン不明'})</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label className="form-label">シーン</label>
        {scenes.length > 0 ? (
          <select className="form-select" value={form.scene} onChange={e => set('scene', e.target.value)} disabled={scenesLoading}>
            <option value="">ファイルのデフォルト</option>
            {scenes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input className="form-input" value={form.scene} onChange={e => set('scene', e.target.value)} placeholder="空白の場合はファイルのデフォルト" />
        )}
      </div>

      <div className="form-field">
        <label className="form-label">レンダーエンジン</label>
        {engines.length > 0 ? (
          <select className="form-select" value={form.engine} onChange={e => set('engine', e.target.value)} disabled={enginesLoading}>
            <option value="">ファイルのデフォルト</option>
            {engines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
          </select>
        ) : (
          <input className="form-input" value={form.engine} onChange={e => set('engine', e.target.value)} placeholder="空白の場合はBlenderデフォルト (例: CYCLES)" />
        )}
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label">開始フレーム</label>
          <input className="form-input" style={{ width: 120 }} type="number" min={0} value={form.startFrame} onChange={e => set('startFrame', Number(e.target.value))} />
        </div>
        <div className="form-field">
          <label className="form-label">終了フレーム</label>
          <input className="form-input" style={{ width: 120 }} type="number" min={0} value={form.endFrame} onChange={e => set('endFrame', Number(e.target.value))} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label">フレームステップ</label>
          <input className="form-input" style={{ width: 120 }} type="number" min={1} value={form.frameStep} onChange={e => set('frameStep', Number(e.target.value))} />
          <span className="form-hint">1 = 毎フレーム</span>
        </div>
        <div className="form-field">
          <label className="form-label">スレッド数</label>
          <input className="form-input" style={{ width: 120 }} type="number" min={0} value={form.thread} onChange={e => set('thread', Number(e.target.value))} />
          <span className="form-hint">0 = 自動</span>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">保存しました</div>}

      <div className="form-actions">
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>削除</button>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">ワークスペースを削除しますか？</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">ワークスペース</span>{detail.workspace.name}</p>
              <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                関連するジョブ履歴も削除されます。この操作は取り消せません。
              </p>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>キャンセル</button>
              <button className="btn btn-danger" onClick={async () => {
                setDeleting(true)
                try {
                  await WorkspaceService.Delete(projectID, workspaceID)
                  onDeleted()
                } catch (err) {
                  setError(String(err))
                  setConfirm(false)
                } finally {
                  setDeleting(false)
                }
              }} disabled={deleting}>
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



// ── ページ本体 ────────────────────────────────────────────
function WorkspaceDetailPage({ projectID, projectName, fileID, fileName, workspaceID, navigate }) {
  const [detail, setDetail] = useState(null)
  const [error, setError]   = useState('')

  const load = useCallback(() => {
    WorkspaceService.Get(projectID, workspaceID)
      .then(d => setDetail(d))
      .catch(err => setError(String(err)))
  }, [projectID, workspaceID])

  useEffect(() => { load() }, [load])

  if (error && !detail) {
    return <div className="page"><div className="error-msg">{error}</div></div>
  }
  if (!detail) {
    return <div className="page"><p className="setting-desc">読み込み中...</p></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => navigate('projects')}>プロジェクト</button>
          <span className="breadcrumb-sep">›</span>
          <button className="breadcrumb-link" onClick={() => navigate('project', { id: projectID })}>{projectName}</button>
          <span className="breadcrumb-sep">›</span>
          <button className="breadcrumb-link" onClick={() => navigate('file', { projectID, projectName, fileID, fileName })}>{fileName}</button>
          <span className="breadcrumb-sep">›</span>
          <span>{detail.workspace.name}</span>
        </div>
      </div>

      <div className="tab-nav">
        <button className="tab-btn active">設定</button>
      </div>

      <div className="tab-content">
        <SettingsTab
          projectID={projectID}
          workspaceID={workspaceID}
          detail={detail}
          onUpdated={() => navigate('file', { projectID, projectName, fileID, fileName })}
          onDeleted={() => navigate('file', { projectID, projectName, fileID, fileName })}
        />
      </div>
    </div>
  )
}

export default WorkspaceDetailPage
