import { useState, useEffect, useCallback } from 'react'
import { WorkspaceApi, QueueApi, ProjectApi, BlenderApi } from '../../lib/api'
import JobDetailDialog from '../../components/JobDetailDialog'
import ImageViewerDialog from '../../components/ImageViewerDialog'
import Pagination from '../../components/Pagination'

const STATUS_LABELS = {
  completed: '完了',
  error:     'エラー',
  cancelled: 'キャンセル',
}

const TABS = [
  { id: 'workspace', label: 'ワークスペース' },
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
      const ws = await WorkspaceApi.create({ projectID, projectFileID: fileID, name: name.trim() })
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
  const [confirm, setConfirm]       = useState(null) // { ws, preview }
  const [resolvingWsId, setResolvingWsId] = useState(null)
  const [enqueuing, setEnqueuing]   = useState(false)
  const [enqueueMsg, setEnqueueMsg] = useState('')

  const load = () => {
    WorkspaceApi.listByProject({ projectID })
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

  const handleRunClick = async (ws) => {
    setEnqueueMsg('')
    setResolvingWsId(ws.id)
    try {
      const preview = await QueueApi.previewRender({ projectID, workspaceID: ws.id })
      setConfirm({ ws, preview })
    } catch (err) {
      setEnqueueMsg(`エラー: ${String(err)}`)
    } finally {
      setResolvingWsId(null)
    }
  }

  const handleEnqueue = async () => {
    if (!confirm) return
    setEnqueuing(true)
    setEnqueueMsg('')
    try {
      await QueueApi.enqueueWithPreview({ projectID, workspaceID: confirm.ws.id, preview: confirm.preview })
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
      <div style={{ position: 'relative' }}>
        <div className="ws-list">
          {workspaces.length === 0 && !creating && (
            <p className="ws-empty">ワークスペースがありません</p>
          )}
          {workspaces.map(ws => (
            <div key={ws.id} className="ws-item ws-item-run">
              <button
                className="btn btn-run btn-sm ws-item-run-btn"
                onClick={() => handleRunClick(ws)}
                disabled={resolvingWsId !== null}
              >
                ▶ 実行
              </button>
              <div
                className="ws-item-info ws-item-link"
                onClick={() => navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })}
              >
                <span className="ws-item-name">{ws.name}</span>
                <div className="ws-item-meta">
                  {ws.engine && <span className="ws-meta-chip">{ws.engine}</span>}
                  {(ws.start === 0 && ws.end === -1)
                    ? <span className="ws-meta-chip">.blend フレーム</span>
                    : <span className="ws-meta-chip">{ws.start} – {ws.end} f</span>
                  }
                </div>
              </div>
              <span className="ws-item-arrow" onClick={() => navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: ws.id })}>›</span>
            </div>
          ))}
        </div>
        {resolvingWsId !== null && (
          <div className="ws-list-overlay">
            <span className="ws-list-overlay-label">処理中...</span>
          </div>
        )}
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
              <p><span className="dialog-label">ワークスペース</span>{confirm.ws.name}</p>
              <p><span className="dialog-label">シーン</span>{confirm.preview.scene}</p>
              {confirm.preview.engine
                ? <p><span className="dialog-label">エンジン</span>{confirm.preview.engine}</p>
                : <p><span className="dialog-label">エンジン</span><span style={{ opacity: 0.5 }}>.blend のデフォルト</span></p>
              }
              <p><span className="dialog-label">フレーム</span>{confirm.preview.start_frame} – {confirm.preview.end_frame}</p>
              {confirm.preview.frame_step > 1 && <p><span className="dialog-label">ステップ</span>{confirm.preview.frame_step}</p>}
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

const HISTORY_PAGE_SIZE = 5

// ── 履歴タブ ──────────────────────────────────────────────
function HistoryTab({ projectID, fileID }) {
  const [jobs, setJobs]         = useState([])
  const [selected, setSelected] = useState(null)
  const [viewing, setViewing]   = useState(null)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE)

  const load = useCallback(() => {
    QueueApi.listJobsByProjectFile({ projectID, fileID })
      .then(list => setJobs(list || []))
      .catch(() => {})
  }, [projectID, fileID])

  useEffect(() => { load() }, [load])

  const totalPages  = Math.max(1, Math.ceil(jobs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageJobs    = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (jobs.length === 0) {
    return <p className="empty-msg">まだ実行履歴がありません</p>
  }

  return (
    <>
      <div className="queue-history-list">
        {pageJobs.map(j => (
          <div key={j.id} className="queue-history-item queue-history-item-clickable" onClick={() => setSelected(j)}>
            <div className="queue-history-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setViewing(j) }} disabled={!(j.data_status === 2 || j.data_status === 3)}>表示</button>
                <div>
                  <span className="queue-history-name">{j.workspace_name}</span>
                  <div className="queue-history-detail" style={{ marginTop: 4 }}>
                    <span>{j.start_frame}–{j.end_frame}f</span>
                    {j.engine && <span>{j.engine}</span>}
                    {j.enqueued_at && (
                      <span>{new Date(j.enqueued_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`status-badge status-${j.status}`}>{STATUS_LABELS[j.status] ?? j.status}</span>
            </div>
            {j.status === 'error' && j.error_msg && (
              <div className="queue-history-error">
                {j.error_msg.slice(0, 80)}{j.error_msg.length > 80 ? '...' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onChange={p => { setPage(p); setSelected(null) }} pageSize={pageSize} onPageSizeChange={p => { setPageSize(p); setPage(1) }} total={jobs.length} />
      <JobDetailDialog job={selected} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); load() }}
        onStatusChanged={(id, status) => {
          setJobs(prev => prev.map(j => j.id === id ? { ...j, data_status: status } : j))
          setSelected(prev => prev && prev.id === id ? { ...prev, data_status: status } : prev)
        }} />
      <ImageViewerDialog job={viewing} onClose={() => setViewing(null)} />
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

  const fetchScenes = (installID) => {
    setScenesLoading(true)
    BlenderApi.getScenes({ installID, fileID })
      .then(list => setScenes(list || []))
      .catch(() => setScenes([]))
      .finally(() => setScenesLoading(false))
  }

  useEffect(() => {
    Promise.all([
      ProjectApi.getFile({ fileID }).catch(() => null),
      BlenderApi.list().catch(() => []),
    ]).then(([f, list]) => {
      setBlenders(list || [])
      const installID = f?.blender_install_id || 0
      setName(f?.name || fileName)
      setBlenderID(installID)
      setScene(f?.scene || '')
      fetchScenes(installID)
    })
  }, [fileID])

  const handleBlenderChange = (installID) => {
    setBlenderID(installID)
    fetchScenes(installID)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await ProjectApi.updateFile({ fileID, name: name.trim(), blenderInstallID, scene })
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
      await ProjectApi.deleteFile({ fileID })
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
            onChange={e => handleBlenderChange(Number(e.target.value))}
          >
            <option value={0}>— 未設定 —</option>
            {blenders.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.version || 'バージョン不明'})</option>
            ))}
          </select>
        )}
        <span className="form-hint">未設定の場合: Blender一覧の先頭が使用されます</span>
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
            <option value="">— 未設定 —</option>
            {scenes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input
            className="form-input"
            value={scene}
            onChange={e => setScene(e.target.value)}
            placeholder="未設定"
          />
        )}
        <span className="form-hint">未設定の場合: .blend ファイルのデフォルトシーンが使用されます</span>
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
          <div className="ws-detail-split">
            <div className="ws-detail-left">
              <WorkspaceTab
                projectID={projectID}
                projectName={projectName}
                fileID={fileID}
                fileName={currentFileName}
                navigate={navigate}
                onEnqueued={() => navigate('queue')}
              />
            </div>
            <div className="ws-detail-right">
              <h3 className="ws-detail-section-title">実行履歴</h3>
              <HistoryTab projectID={projectID} fileID={fileID} />
            </div>
          </div>
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
