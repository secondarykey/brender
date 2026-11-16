import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WorkspaceApi, QueueApi, ProjectApi } from '../../../lib/api'
import { useToast, useMessage } from '../../../lib/toast'
import { onAppEvent } from '../../../lib/appEvents'
import { useThumbnail } from '../../../lib/useThumbnail'
import { roleAtLeast } from '../../../lib/roles'
import SortSelect from '../../../components/SortSelect'
import EntityIcon from '../../../components/EntityIcon'
import WorkspaceCreateDialog from '../../../components/WorkspaceCreateDialog'
import RenderConfirmDialog from '../../../components/RenderConfirmDialog'
import { MdPlayArrow } from 'react-icons/md'

// ── ワークスペース一覧の1行 ────────────────────────────────
function WorkspaceRailItem({ projectID, fileID, ws, selected, stale, thumbnailMode, canRun, runDisabled, onSelect, onRun }) {
  const { t } = useTranslation()
  // まだ無い間はキューの変化で取り直す（登録直後の Test 出力が終わると出る）
  const [thumb] = useThumbnail(
    () => WorkspaceApi.getThumbnail({ projectID, fileID, workspaceID: ws.id }),
    [projectID, fileID, ws.id],
  )

  return (
    <div
      className={`ws-rail-item entity-workspace entity-bar${selected ? ' selected' : ''}${thumbnailMode ? ' file-item-thumb-select' : ''}`}
      title={ws.name}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
    >
      <div className="ws-rail-thumb">
        {thumb && <img src={thumb} alt="" />}
      </div>
      <div className="ws-rail-info">
        <div className="entity-name-row">
          <EntityIcon type="workspace" />
          <span className="ws-item-name">{ws.name}</span>
          {stale && <span className="stale-mark-inline" title={t('file.fileChangedTooltip')}>!</span>}
        </div>
        <div className="ws-item-meta">
          {ws.engine && <span className="ws-meta-chip">{ws.engine}</span>}
          {(ws.start === 0 && ws.end === -1)
            ? <span className="ws-meta-chip">{t('workspace.blendDefault')}</span>
            : <span className="ws-meta-chip">{ws.start} – {ws.end} f</span>
          }
        </div>
      </div>
      {!thumbnailMode && canRun && (
        <button
          className="btn btn-run btn-sm ws-rail-run"
          title={t('common.run')}
          aria-label={t('common.run')}
          onClick={e => { e.stopPropagation(); onRun() }}
          disabled={runDisabled}
        >
          <MdPlayArrow />
        </button>
      )}
    </div>
  )
}

// ── ワークスペース一覧（ファイル画面の左側） ─────────────────
// 選んだ1件を右側の WorkspacePanel が表示する。一覧はここにしか無く、ページ遷移はしない。
// workspace_creator 以上は新規作成、editor 以上は行を選んでファイルのサムネイルに、runner 以上は「▶」で実行できる。
//   selectedID    … 選択中のワークスペース（強調表示）
//   onSelect      … (id, extra) 行を選んだとき。extra は新規作成直後の { focusName: true } など
//   onLoaded      … 一覧を読み込むたびに呼ぶ（件数と既定の選択を親が決める）
//   reloadTrigger … 値が変わったら読み直す（右側で名称変更・複製・削除があったとき）
export default function WorkspaceRail({ projectID, fileID, fileName, selectedID, onSelect, onEnqueued, workDirLocked, role, onLoaded, reloadTrigger }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [workspaces, setWorkspaces] = useState([])
  const [fileModifiedAt, setFileModifiedAt] = useState(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [confirm, setConfirm]       = useState(null) // { ws, preview }
  const [resolvingWsId, setResolvingWsId] = useState(null)
  const [enqueuing, setEnqueuing]   = useState(false)
  const [thumbnailMode, setThumbnailMode] = useState(false)
  const [sort, setSort]             = useState(() => localStorage.getItem('sort:workspaces') || 'display_order')
  const [dir, setDir]               = useState(() => localStorage.getItem('dir:workspaces') || '')

  const canCreateWorkspace = roleAtLeast(role, 'workspace_creator')
  const canSetThumbnail    = roleAtLeast(role, 'editor')
  const canRun             = roleAtLeast(role, 'runner')

  const load = (s, d) => {
    WorkspaceApi.listByProject({ projectID, sort: s, dir: d })
      .then(list => {
        const group = (list || []).find(g => g.file.id === fileID)
        const next = group ? group.workspaces : []
        setWorkspaces(next)
        if (onLoaded) onLoaded(next)
        if (group?.file?.file_modified_at) setFileModifiedAt(group.file.file_modified_at)
      })
      .catch(() => {})
  }

  // 最後にレンダリングしたあとで .blend が変わったワークスペースに「!」を付ける
  const isStale = (ws) => {
    if (!fileModifiedAt || !ws.processed_at) return false
    return new Date(fileModifiedAt) > new Date(ws.processed_at)
  }

  const handleSortChange = (s) => {
    setSort(s)
    localStorage.setItem('sort:workspaces', s)
    load(s, dir)
  }

  const handleDirChange = (d) => {
    setDir(d)
    localStorage.setItem('dir:workspaces', d)
    load(sort, d)
  }

  useEffect(() => { load(sort, dir) }, [projectID, fileID, reloadTrigger])

  // ファイル登録直後はサムネイル用のワークスペースがあとから作られる（作られるとキューが変わる）
  useEffect(() => onAppEvent('queue:changed', () => load(sort, dir)), [projectID, fileID, sort, dir])

  const handleCreated = (newWorkspaces) => {
    load(sort, dir)
    if (newWorkspaces.length === 1) {
      onSelect(newWorkspaces[0].id, { focusName: true })
    }
  }

  const handleRunClick = async (ws) => {
    showError('')
    setResolvingWsId(ws.id)
    try {
      const preview = await QueueApi.previewRender({ projectID, workspaceID: ws.id })
      setConfirm({ ws, preview })
    } catch (err) {
      showError(String(err))
    } finally {
      setResolvingWsId(null)
    }
  }

  const handleEnqueue = async () => {
    if (!confirm) return
    setEnqueuing(true)
    showError('')
    try {
      await QueueApi.enqueueWithPreview({ projectID, workspaceID: confirm.ws.id, preview: confirm.preview })
      onEnqueued()
    } catch (err) {
      showError(String(err))
      setConfirm(null)
    } finally {
      setEnqueuing(false)
    }
  }

  const handleSetThumbnail = async (workspaceID) => {
    try {
      await ProjectApi.setFileThumbnailFromWorkspace({ projectID, fileID, workspaceID })
      showToast(t('viewer.thumbnailSet'))
      setThumbnailMode(false)
    } catch (err) {
      showError(String(err))
    }
  }

  return (
    <div className="ws-rail">
      {workspaces.length > 0 && (
        <div className="ws-rail-tools">
          <SortSelect value={sort} onChange={handleSortChange} dir={dir} onDirChange={handleDirChange} />
          {canSetThumbnail && (
            <button
              className={`btn btn-sm${thumbnailMode ? ' btn-outline-active' : ' btn-outline'}`}
              onClick={() => setThumbnailMode(v => !v)}
            >
              {t('workspace.setAsFileThumbnail')}
            </button>
          )}
        </div>
      )}

      {thumbnailMode && (
        <div className="thumbnail-mode-hint">{t('file.selectThumbnailHint')}</div>
      )}

      <div className="ws-rail-list">
        {workspaces.length === 0 && (
          <p className="ws-empty">{t('workspace.empty')}</p>
        )}
        {workspaces.map(ws => (
          <WorkspaceRailItem
            key={ws.id}
            projectID={projectID}
            fileID={fileID}
            ws={ws}
            selected={ws.id === selectedID}
            stale={isStale(ws)}
            thumbnailMode={thumbnailMode}
            canRun={canRun}
            runDisabled={resolvingWsId !== null || workDirLocked}
            onSelect={() => (thumbnailMode ? handleSetThumbnail(ws.id) : onSelect(ws.id))}
            onRun={() => handleRunClick(ws)}
          />
        ))}
        {resolvingWsId !== null && (
          <div className="ws-list-overlay">
            <span className="ws-list-overlay-label">{t('common.processing')}</span>
          </div>
        )}
      </div>

      {canCreateWorkspace && (
        <div className="ws-rail-foot">
          <button className="btn btn-green" onClick={() => setCreateDialogOpen(true)}>
            {t('workspace.createNew')}
          </button>
        </div>
      )}

      <WorkspaceCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        projectID={projectID}
        fileID={fileID}
        fileName={fileName}
        onCreated={handleCreated}
      />

      <RenderConfirmDialog
        preview={confirm?.preview || null}
        workspaceName={confirm?.ws.name}
        busy={enqueuing}
        onCancel={() => setConfirm(null)}
        onConfirm={handleEnqueue}
      />
    </div>
  )
}
