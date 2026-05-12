import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, ProjectApi, BlenderApi } from '../../../lib/api'

// ── サムネイルタイル ──────────────────────────────────────
function FileCard({ projectID, g, navigate, projectName }) {
  const { t } = useTranslation()
  const [thumb, setThumb] = useState(null)
  const [settingThumb, setSettingThumb] = useState(false)
  const [thumbMsg, setThumbMsg] = useState('')

  useEffect(() => {
    ProjectApi.getFileThumbnail({ projectID, fileID: g.file.id })
      .then(src => setThumb(src || null))
      .catch(() => {})
  }, [projectID, g.file.id])

  const fileName = g.file.name || g.file.path.split(/[/\\]/).pop()

  const handleSetProjectThumbnail = async (e) => {
    e.stopPropagation()
    setSettingThumb(true)
    setThumbMsg('')
    try {
      await ProjectApi.setProjectThumbnailFromFile({ projectID, fileID: g.file.id })
      setThumbMsg(t('viewer.thumbnailSet'))
      setTimeout(() => setThumbMsg(''), 2000)
    } catch (err) {
      setThumbMsg(t('common.error') + String(err))
    } finally {
      setSettingThumb(false)
    }
  }

  return (
    <div
      className="file-tile"
      onClick={() => navigate('file', { projectID, projectName, fileID: g.file.id, fileName })}
    >
      <div className="file-tile-thumb">
        {thumb
          ? <img src={thumb} alt={fileName} />
          : <span className="file-tile-thumb-placeholder">{t('workspace.noImage')}</span>
        }
      </div>
      <div className="file-tile-info">
        <div className="file-tile-name" title={fileName}>{fileName}</div>
      </div>
      <div className="ws-tile-actions" onClick={e => e.stopPropagation()}>
        {thumbMsg && <span className="ws-thumb-msg">{thumbMsg}</span>}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleSetProjectThumbnail}
          disabled={settingThumb}
        >
          {settingThumb ? t('common.processing') : t('file.setAsProjectThumbnail')}
        </button>
      </div>
    </div>
  )
}

function WorkspaceTab({ projectID, navigate, projectName }) {
  const { t } = useTranslation()
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
        <button className="btn btn-secondary ws-add-file-fab" onClick={handleAddFile}>{t('workspace.addFile')}</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {groups.length > 0 && (
        <div className="file-view-toggle">
          <button
            className={`file-view-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')}
            title={t('workspace.listView')}
          >☰</button>
          <button
            className={`file-view-btn${viewMode === 'card' ? ' active' : ''}`}
            onClick={() => setViewMode('card')}
            title={t('workspace.cardView')}
          >⊞</button>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="ws-empty">{t('workspace.noFilesRegistered')}</p>
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
                title={t('workspace.openInBlender')}
              >
                {openingFileID === g.file.id ? '...' : t('common.open')}
              </button>
              <div className="file-item-info">
                <span className="ws-file-name">{g.file.name || g.file.path.split(/[/\\]/).pop()}</span>
                <span className="ws-file-path">{g.file.path}</span>
              </div>
              <div className="file-item-meta">
                <span className="file-item-count">{g.workspaces.length} {t('tabs.fileList')}</span>
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
