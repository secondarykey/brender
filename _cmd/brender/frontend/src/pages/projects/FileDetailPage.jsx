import { useState, useEffect } from 'react'
import { WorkspaceService, QueueService, ProjectService, BlenderService } from '../../../bindings/changeme'
import JobDetailDialog from '../../components/JobDetailDialog'

const STATUS_LABELS = {
  completed: '完了',
  error:     'エラー',
  cancelled: 'キャンセル',
}

const TABS = [
  { id: 'workspace', label: 'ワークスペース' },
  { id: 'history',   label: '履歴' },
  { id: 'settings',  label: '設定' },
]

// ── ワークスペース作成フォーム ────────────────────────────
function CreateForm({ projectID, fileID, onSaved, onCancel }) {
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSave = async () => {
    setError('')
    if (!name.trim()) { setError('名前を入力してください'); return }
    setSaving(true)
    try {
      const ws = await WorkspaceService.Create(projectID, fileID, name.trim())
      onSaved(ws)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="ws-create-form">
      <input
        className="form-input ws-create-input"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKey}
        placeholder="ワークスペース名"
        autoFocus
      />
      {error && <span className="ws-create-error">{error}</span>}
      <button className="btn" onClick={handleSave} disabled={saving}>
        {saving ? '...' : '作成'}
      </button>
      <button className="btn btn-ghost" onClick={onCancel}>キャンセル</button>
    </div>
  )
}

// ── ワークスペースタブ ─────────────────────────────────────
function WorkspaceTab({ projectID, projectName, fileID, fileName, navigate, onEnqueued }) {
  const [workspaces, setWorkspaces] = useState([])
  const [creating, setCreating]     = useState(false)
  const [confirm, setConfirm]       = useState(null) // workspace object
  const [enqueuing, setEnqueuing]   = useState(false)
  const [enqueueMsg, setEnqueueMsg] = useState('')

  const load = () => {
    WorkspaceService.ListByProject(projectID)
      .then(list => {
        const group = (list || []).find(g => g.file.id === fileID)
        setWorkspaces(group ? group.workspaces : [])
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, [projectID, fileID])

  const handleSaved = (ws) => {
    setCreating(false)
    navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })
  }

  const handleEnqueue = async () => {
    if (!confirm) return
    setEnqueuing(true)
    setEnqueueMsg('')
    try {
      await QueueService.Enqueue(projectID, confirm.id)
      onEnqueued()
    } catch (err) {
      setEnqueueMsg(`エラー: ${String(err)}`)
      setConfirm(null)
    } finally {
      setEnqueuing(false)
    }
  }

  return (
    <div>
      <div className="ws-list">
        {workspaces.length === 0 && !creating && (
          <p className="ws-empty">ワークスペースがありません</p>
        )}
        {workspaces.map(ws => (
          <div key={ws.id} className="ws-item ws-item-run">
            <div
              className="ws-item-info ws-item-link"
              onClick={() => navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })}
            >
              <span className="ws-item-name">{ws.name}</span>
              <div className="ws-item-meta">
                {ws.engine && <span className="ws-meta-chip">{ws.engine}</span>}
                <span className="ws-meta-chip">{ws.start ?? 1} – {ws.end ?? 250} f</span>
              </div>
            </div>
            <div className="ws-item-actions">
              <button
                className="btn btn-run btn-sm"
                onClick={() => setConfirm(ws)}
              >
                ▶ 実行
              </button>
              <span className="ws-item-arrow" onClick={() => navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })}>›</span>
            </div>
          </div>
        ))}
      </div>

      {creating ? (
        <CreateForm projectID={projectID} fileID={fileID} onSaved={handleSaved} onCancel={() => setCreating(false)} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={() => setCreating(true)}>+ ワークスペースを作成</button>
        </div>
      )}

      {enqueueMsg && (
        <div className={`enqueue-msg${enqueueMsg.startsWith('エラー') ? ' enqueue-error' : ''}`} style={{ marginTop: 12 }}>
          {enqueueMsg}
        </div>
      )}

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">レンダリングを実行しますか？</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">ワークスペース</span>{confirm.name}</p>
              {confirm.scene && <p><span className="dialog-label">シーン</span>{confirm.scene}</p>}
              {confirm.engine && <p><span className="dialog-label">エンジン</span>{confirm.engine}</p>}
              <p><span className="dialog-label">フレーム</span>{confirm.start ?? 1} – {confirm.end ?? 250}</p>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>キャンセル</button>
              <button className="btn btn-run" onClick={handleEnqueue} disabled={enqueuing}>
                {enqueuing ? '追加中...' : '実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 履歴タブ ──────────────────────────────────────────────
function HistoryTab({ projectID, fileID }) {
  const [jobs, setJobs]       = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    QueueService.ListJobsByProjectFile(projectID, fileID)
      .then(list => setJobs(list || []))
      .catch(() => {})
  }, [projectID, fileID])

  if (jobs.length === 0) {
    return <p className="empty-msg">まだ実行履歴がありません</p>
  }

  return (
    <>
      <div className="queue-history-list">
        {jobs.map(j => (
          <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => setSelected(j)}>
            <div className="queue-history-top">
              <span className="queue-history-name">{j.workspace_name}</span>
              <span className={`status-badge status-${j.status}`}>{STATUS_LABELS[j.status] ?? j.status}</span>
            </div>
            <div className="queue-history-detail">
              <span>{j.start_frame}–{j.end_frame}f</span>
              {j.engine && <span>{j.engine}</span>}
              {j.enqueued_at && (
                <span>{new Date(j.enqueued_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            {j.status === 'error' && j.error_msg && (
              <div className="queue-history-error">
                {j.error_msg.slice(0, 80)}{j.error_msg.length > 80 ? '...' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
      <JobDetailDialog job={selected} onClose={() => setSelected(null)} />
    </>
  )
}

// ── 設定タブ ─────────────────────────────────────────────
function SettingsTab({ fileID, fileName, onUpdated, onDeleted }) {
  const [name, setName]                   = useState(fileName)
  const [blenderInstallID, setBlenderID]  = useState(0)
  const [scene, setScene]                 = useState('')
  const [blenders, setBlenders]           = useState([])
  const [scenes, setScenes]               = useState([])
  const [scenesLoading, setScenesLoading] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [confirm, setConfirm]             = useState(false)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    ProjectService.GetFile(fileID)
      .then(f => {
        if (!f) return
        setName(f.name || fileName)
        setBlenderID(f.blender_install_id || 0)
        setScene(f.scene || '')
      })
      .catch(() => {})
    BlenderService.List()
      .then(list => setBlenders(list || []))
      .catch(() => {})
  }, [fileID])

  useEffect(() => {
    setScenesLoading(true)
    BlenderService.GetScenes(blenderInstallID, fileID)
      .then(list => setScenes(list || []))
      .catch(() => setScenes([]))
      .finally(() => setScenesLoading(false))
  }, [blenderInstallID, fileID])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await ProjectService.UpdateFile(fileID, name.trim(), blenderInstallID, scene)
      if (onUpdated) onUpdated(updated)
    } catch (e) {
      setError(e?.message ?? '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await ProjectService.DeleteFile(fileID)
      if (onDeleted) onDeleted()
    } catch (e) {
      setError(e?.message ?? '削除に失敗しました')
      setConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="form" style={{ maxWidth: 480 }}>
      <div className="form-field">
        <label className="form-label">ファイル名称</label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <span className="form-hint">レンダリング設定グループの表示名</span>
      </div>

      <div className="form-field">
        <label className="form-label">デフォルト Blender</label>
        {blenders.length === 0 ? (
          <p className="setting-desc">Blenderが登録されていません（システム設定で追加してください）</p>
        ) : (
          <select
            className="form-select"
            value={blenderInstallID}
            onChange={e => setBlenderID(Number(e.target.value))}
          >
            <option value={0}>— 未選択（一番上のBlenderを使用）—</option>
            {blenders.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.version || 'バージョン不明'})</option>
            ))}
          </select>
        )}
      </div>

      <div className="form-field">
        <label className="form-label">デフォルトシーン</label>
        {scenes.length > 0 ? (
          <select
            className="form-select"
            value={scene}
            onChange={e => setScene(e.target.value)}
            disabled={scenesLoading}
          >
            <option value="">— Blenderのデフォルト —</option>
            {scenes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input
            className="form-input"
            value={scene}
            onChange={e => setScene(e.target.value)}
            placeholder="空白の場合はBlenderのデフォルト"
          />
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>削除</button>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {confirm && (
        <div className="dialog-overlay" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">ファイルを削除しますか？</h3>
            <div className="dialog-body">
              <p><span className="dialog-label">ファイル</span>{fileName}</p>
              <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                関連するワークスペースおよびジョブ履歴も削除されます。物理ファイルは削除されません。この操作は取り消せません。
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

// ── ページ本体 ────────────────────────────────────────────
function FileDetailPage({ projectID, projectName, fileID, fileName, navigate }) {
  const [tab, setTab] = useState('workspace')
  const [currentFileName, setCurrentFileName] = useState(fileName)

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => navigate('projects')}>プロジェクト</button>
          <span className="breadcrumb-sep">›</span>
          <button className="breadcrumb-link" onClick={() => navigate('project', { id: projectID })}>{projectName}</button>
          <span className="breadcrumb-sep">›</span>
          <span>{currentFileName}</span>
        </div>
      </div>

      <div className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'workspace' && (
          <WorkspaceTab
            projectID={projectID}
            projectName={projectName}
            fileID={fileID}
            fileName={currentFileName}
            navigate={navigate}
            onEnqueued={() => navigate('queue')}
          />
        )}
        {tab === 'history' && (
          <HistoryTab projectID={projectID} fileID={fileID} />
        )}
        {tab === 'settings' && (
          <SettingsTab
            fileID={fileID}
            fileName={currentFileName}
            onUpdated={f => setCurrentFileName(f.name)}
            onDeleted={() => navigate('project', { id: projectID })}
          />
        )}
      </div>
    </div>
  )
}

export default FileDetailPage
