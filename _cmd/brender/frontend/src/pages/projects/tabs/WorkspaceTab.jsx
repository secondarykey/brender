import { useState, useEffect } from 'react'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, ProjectApi, BlenderApi } from '../../../lib/api'

// ── サムネイルタイル ──────────────────────────────────────
function FileCard({ projectID, g, navigate, projectName }) {
  const [thumb, setThumb] = useState(null)

  useEffect(() => {
    ProjectApi.getFileThumbnail({ projectID, fileID: g.file.id })
      .then(src => setThumb(src || null))
      .catch(() => {})
  }, [projectID, g.file.id])

  const fileName = g.file.name || g.file.path.split(/[/\\]/).pop()

  return (
    <div
      className="file-tile"
      onClick={() => navigate('file', { projectID, projectName, fileID: g.file.id, fileName })}
    >
      <div className="file-tile-thumb">
        {thumb
          ? <img src={thumb} alt={fileName} />
          : <span className="file-tile-thumb-placeholder">No Image</span>
        }
      </div>
      <div className="file-tile-info">
        <div className="file-tile-name" title={fileName}>{fileName}</div>
      </div>
    </div>
  )
}

function WorkspaceTab({ projectID, navigate, projectName }) {
  const [groups, setGroups]   = useState([])
  const [error, setError]     = useState('')
  const [fileError, setFileError] = useState('')
  const [openingFileID, setOpeningFileID] = useState(null)
  const [viewMode, setViewMode] = useState('card') // 'list' | 'card'

  const load = () => {
    WorkspaceApi.listByProject({ projectID })
      .then(list => setGroups(list || []))
      .catch(err => setError(String(err)))
  }

  useEffect(() => { load() }, [projectID])

  const handleOpenFile = async (e, file) => {
    e.stopPropagation()
    setOpeningFileID(file.id)
    try {
      await BlenderApi.openFile({ installID: file.blender_install_id || 0, filePath: file.path })
    } catch (err) {
      setFileError(String(err))
    } finally {
      setOpeningFileID(null)
    }
  }

  const handleAddFile = async () => {
    setFileError('')
    try {
      const path = await Dialogs.OpenFile({
        Filters: [{ DisplayName: 'Blender File', Pattern: '*.blend' }],
      })
      if (!path) return
      await ProjectApi.addFile({ projectID, path })
      load()
    } catch (err) {
      setFileError(String(err))
    }
  }

  return (
    <div className="workspace-tab-root">
      <div className="ws-add-file-fab-wrap">
        <button className="btn btn-secondary ws-add-file-fab" onClick={handleAddFile}>+ .blend ファイルを追加</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {groups.length > 0 && (
        <div className="file-view-toggle">
          <button
            className={`file-view-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')}
            title="リスト表示"
          >☰</button>
          <button
            className={`file-view-btn${viewMode === 'card' ? ' active' : ''}`}
            onClick={() => setViewMode('card')}
            title="カード表示"
          >⊞</button>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="ws-empty">.blend ファイルが登録されていません</p>
      ) : viewMode === 'list' ? (
        <div className="file-list">
          {groups.map(g => (
            <div
              key={g.file.id}
              className="file-item"
              onClick={() => navigate('file', {
                projectID,
                projectName,
                fileID:   g.file.id,
                fileName: g.file.name || g.file.path.split(/[/\\]/).pop(),
              })}
            >
              <button
                className="btn btn-run btn-sm file-item-open-btn"
                onClick={e => handleOpenFile(e, g.file)}
                disabled={openingFileID === g.file.id}
                title="Blender で開く"
              >
                {openingFileID === g.file.id ? '...' : '開く'}
              </button>
              <div className="file-item-info">
                <span className="ws-file-name">{g.file.name || g.file.path.split(/[/\\]/).pop()}</span>
                <span className="ws-file-path">{g.file.path}</span>
              </div>
              <div className="file-item-meta">
                <span className="file-item-count">{g.workspaces.length} ワークスペース</span>
                <span className="ws-item-arrow">›</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="file-tile-grid">
          {groups.map(g => (
            <FileCard
              key={g.file.id}
              projectID={projectID}
              g={g}
              navigate={navigate}
              projectName={projectName}
            />
          ))}
        </div>
      )}

      {fileError && <div className="error-msg" style={{ marginTop: 8 }}>{fileError}</div>}
    </div>
  )
}

export default WorkspaceTab
