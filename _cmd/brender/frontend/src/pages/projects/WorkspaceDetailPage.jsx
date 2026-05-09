import { useState, useEffect, useCallback } from 'react'
import { WorkspaceService, BlenderService, QueueService } from '../../../bindings/changeme'
import JobDetailDialog from '../../components/JobDetailDialog'
import Pagination from '../../components/Pagination'


const isFrameDefault = (start, end) => start === 0 && end === -1

const STATUS_LABELS = {
  completed: '完了',
  error:     'エラー',
  cancelled: 'キャンセル',
}

const HISTORY_PAGE_SIZE = 5

// ── 履歴タブ ──────────────────────────────────────────────
function HistoryTab({ projectID, workspaceID }) {
  const [jobs, setJobs]         = useState([])
  const [selected, setSelected] = useState(null)
  const [page, setPage]         = useState(1)

  const load = useCallback(() => {
    QueueService.ListJobsByWorkspace(projectID, workspaceID)
      .then(list => setJobs(list || []))
      .catch(() => {})
  }, [projectID, workspaceID])

  useEffect(() => { load() }, [load])

  const totalPages  = Math.max(1, Math.ceil(jobs.length / HISTORY_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs.slice((currentPage - 1) * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE)

  if (jobs.length === 0) {
    return <p className="empty-msg">まだ実行履歴がありません</p>
  }

  return (
    <>
      <div className="queue-history-list">
        {pageJobs.map(j => (
          <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => setSelected(j)}>
            <div className="queue-history-top">
              <span className={`status-badge status-${j.status}`}>{STATUS_LABELS[j.status] ?? j.status}</span>
              {j.enqueued_at && (
                <span className="queue-history-date">
                  {new Date(j.enqueued_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="queue-history-detail">
              <span>{j.start_frame}–{j.end_frame}f</span>
              {j.engine && <span>{j.engine}</span>}
              {j.scene  && <span>{j.scene}</span>}
            </div>
            {j.status === 'error' && j.error_msg && (
              <div className="queue-history-error">
                {j.error_msg.slice(0, 80)}{j.error_msg.length > 80 ? '...' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onChange={p => { setPage(p); setSelected(null) }} />
      <JobDetailDialog job={selected} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); load() }} />
    </>
  )
}

// ── 設定タブ ──────────────────────────────────────────────
function SettingsTab({ projectID, workspaceID, detail, onUpdated, onDeleted }) {
  const [blenders, setBlenders]             = useState([])
  const [engines, setEngines]               = useState([])
  const [enginesLoading, setEnginesLoading] = useState(false)
  const [scenes, setScenes]                 = useState([])
  const [scenesLoading, setScenesLoading]   = useState(false)
  const [form, setForm]                     = useState(null)
  const [specifyFrames, setSpecifyFrames]   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')
  const [saved, setSaved]                   = useState(false)
  const [confirm, setConfirm]               = useState(false)
  const [deleting, setDeleting]             = useState(false)

  useEffect(() => {
    const start = detail.workspace.start ?? 0
    const end   = detail.workspace.end   ?? -1
    setForm({
      name:             detail.workspace.name,
      blenderInstallID: detail.workspace.blender_install_id,
      scene:            detail.workspace.scene || '',
      engine:           detail.workspace.engine || '',
      startFrame:       start,
      endFrame:         end,
      frameStep:        detail.workspace.frame_step || 1,
      thread:           detail.workspace.thread || 0,
    })
    setSpecifyFrames(!isFrameDefault(start, end))
    setSaved(false)
    setError('')
  }, [detail])

  const handleSpecifyFrames = (checked) => {
    setSpecifyFrames(checked)
    if (!checked) {
      setForm(prev => ({ ...prev, startFrame: 0, endFrame: -1 }))
    } else if (isFrameDefault(form.startFrame, form.endFrame)) {
      setForm(prev => ({ ...prev, startFrame: 1, endFrame: 1, frameStep: 1 }))
    }
  }

  useEffect(() => {
    BlenderService.List()
      .then(list => setBlenders(list || []))
      .catch(() => {})
  }, [])

  // GetEngines と GetScenes を1つの effect にまとめて同時並行で呼び出す
  // （blenderInstallID 変化時に2つの effect が別々に発火するのを防ぐ）
  useEffect(() => {
    if (!form) return
    const fid = detail?.workspace?.project_file_id

    setEnginesLoading(true)
    BlenderService.GetEngines(form.blenderInstallID)
      .then(list => setEngines(list || []))
      .catch(() => setEngines([]))
      .finally(() => setEnginesLoading(false))

    if (!fid || fid === 0) {
      setScenes([])
      return
    }
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
          <option value={0}>— 未設定 —</option>
          {blenders.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({b.version || 'バージョン不明'})</option>
          ))}
        </select>
        <span className="form-hint">未設定の場合: ファイルのデフォルト → Blender一覧の先頭 の順で使用されます</span>
      </div>

      <div className="form-field">
        <label className="form-label">シーン</label>
        {scenes.length > 0 ? (
          <select className="form-select" value={form.scene} onChange={e => set('scene', e.target.value)} disabled={scenesLoading}>
            <option value="">— 未設定 —</option>
            {scenes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input className="form-input" value={form.scene} onChange={e => set('scene', e.target.value)} placeholder="未設定" />
        )}
        <span className="form-hint">未設定の場合: ファイルのデフォルト → .blend ファイルのデフォルト の順で使用されます</span>
      </div>

      <div className="form-field">
        <label className="form-label">レンダーエンジン</label>
        {engines.length > 0 ? (
          <select className="form-select" value={form.engine} onChange={e => set('engine', e.target.value)} disabled={enginesLoading}>
            <option value="">— 未設定 —</option>
            {engines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
          </select>
        ) : (
          <input className="form-input" value={form.engine} onChange={e => set('engine', e.target.value)} placeholder="未設定（例: CYCLES）" />
        )}
        <span className="form-hint">未設定の場合: .blend ファイルのデフォルトエンジンが使用されます</span>
      </div>

      <div className="form-field">
        <label className="form-label">フレーム範囲</label>
        <label className="form-checkbox-label">
          <input type="checkbox" checked={specifyFrames} onChange={e => handleSpecifyFrames(e.target.checked)} />
          フレームを指定する
        </label>
        {specifyFrames && (
          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-field">
              <label className="form-label">開始</label>
              <input className="form-input" style={{ width: 100 }} type="number" min={0} value={form.startFrame} onChange={e => set('startFrame', Number(e.target.value))} />
            </div>
            <div className="form-field">
              <label className="form-label">終了</label>
              <input className="form-input" style={{ width: 100 }} type="number" min={0} value={form.endFrame} onChange={e => set('endFrame', Number(e.target.value))} />
            </div>
            <div className="form-field">
              <label className="form-label">ステップ</label>
              <input className="form-input" style={{ width: 80 }} type="number" min={1} value={form.frameStep} onChange={e => set('frameStep', Number(e.target.value))} />
              <span className="form-hint">1 = 毎フレーム</span>
            </div>
          </div>
        )}
        <span className="form-hint">未指定の場合: .blend ファイルのフレーム設定が使用されます</span>
      </div>

      <div className="form-field">
        <label className="form-label">スレッド数</label>
        <input className="form-input" style={{ width: 120 }} type="number" min={0} value={form.thread} onChange={e => set('thread', Number(e.target.value))} />
        <span className="form-hint">0 = 自動</span>
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
  const [tab, setTab]       = useState('settings')

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
        <button className={`tab-btn${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>設定</button>
        <button className={`tab-btn${tab === 'history'  ? ' active' : ''}`} onClick={() => setTab('history')}>履歴</button>
      </div>

      <div className="tab-content">
        {tab === 'settings' && (
          <SettingsTab
            projectID={projectID}
            workspaceID={workspaceID}
            detail={detail}
            onUpdated={() => navigate('file', { projectID, projectName, fileID, fileName })}
            onDeleted={() => navigate('file', { projectID, projectName, fileID, fileName })}
          />
        )}
        {tab === 'history' && (
          <HistoryTab projectID={projectID} workspaceID={workspaceID} />
        )}
      </div>
    </div>
  )
}

export default WorkspaceDetailPage
