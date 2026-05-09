import { useState, useEffect } from 'react'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, ProjectApi, BlenderApi } from '../../../lib/api'

function WorkspaceTab({ projectID, navigate, projectName }) {
  const [groups, setGroups]   = useState([])
  const [error, setError]     = useState('')
  const [fileError, setFileError] = useState('')
  const [openingFileID, setOpeningFileID] = useState(null)

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
    <div>
      {error && <div className="error-msg">{error}</div>}

      {groups.length === 0 ? (
        <p className="ws-empty">.blend ファイルが登録されていません</p>
      ) : (
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
      )}

      {fileError && <div className="error-msg" style={{ marginTop: 8 }}>{fileError}</div>}
      <div className="ws-add-file-row">
        <button className="btn btn-secondary" onClick={handleAddFile}>+ .blend ファイルを追加</button>
      </div>
    </div>
  )
}

export default WorkspaceTab
