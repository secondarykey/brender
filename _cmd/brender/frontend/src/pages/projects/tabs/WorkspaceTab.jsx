import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, ProjectApi, BlenderApi } from '../../../lib/api'
import { onAppEvent } from '../../../lib/appEvents'
import SortSelect from '../../../components/SortSelect'

// ── サムネイルタイル ──────────────────────────────────────
function FileCard({ projectID, g, navigate, projectName, thumbnailMode, onSetThumbnail }) {
  const { t } = useTranslation()
  const [thumb, setThumb] = useState(null)
  const thumbRef = useRef(null)

  const fetchThumb = () => {
    ProjectApi.getFileThumbnail({ projectID, fileID: g.file.id })
      .then(src => {
        const val = src || null
        thumbRef.current = val
        setThumb(val)
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchThumb()
  }, [projectID, g.file.id])

  // サムネイルがまだない場合、キュー変化イベントで再取得する
  useEffect(() => {
    const off = onAppEvent('queue:changed', () => {
      if (!thumbRef.current) fetchThumb()
    })
    return off
  }, [projectID, g.file.id])

  const fileName = g.file.name || g.file.path.split(/[/\\]/).pop()

  const handleClick = () => {
    if (thumbnailMode) {
      onSetThumbnail(g.file.id)
    } else {
      navigate('file', { projectID, projectName, fileID: g.file.id, fileName })
    }
  }

  return (
    <div
      className={`file-tile${thumbnailMode ? ' file-tile-thumb-select' : ''}`}
      onClick={handleClick}
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
    </div>
  )
}

function WorkspaceTab({ projectID, navigate, projectName }) {
  const { t } = useTranslation()
  const [groups, setGroups]   = useState([])
  const [error, setError]     = useState('')
  const [fileError, setFileError] = useState('')
  const [fileMsg, setFileMsg] = useState('')
  const [openingFileID, setOpeningFileID] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode:files') || 'card')
  const [thumbnailMode, setThumbnailMode] = useState(false)
  const [thumbMsg, setThumbMsg] = useState('')
  const [sort, setSort] = useState(() => localStorage.getItem('sort:files') || 'display_order')

  const load = (s) => {
    WorkspaceApi.listByProject({ projectID, sort: s })
      .then(list => setGroups(list || []))
      .catch(err => setError(String(err)))
  }

  const handleSortChange = (s) => {
    setSort(s)
    localStorage.setItem('sort:files', s)
    load(s)
  }

  useEffect(() => { load(sort) }, [projectID])

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

  const handleAddFilesFromDir = async () => {
    setFileError('')
    setFileMsg('')
    try {
      const dir = await Dialogs.OpenDirectory({ Title: t('settings.selectDirectory') })
      if (!dir) return
      const result = await ProjectApi.addFilesFromDir({ projectID, dir })
      load()
      if (result.errors?.length) {
        setFileError(result.errors.join('\n'))
      } else {
        setFileMsg(t('workspace.addFilesFromDirResult', { added: result.added, skipped: result.skipped }))
        setTimeout(() => setFileMsg(''), 4000)
      }
    } catch (err) {
      setFileError(String(err))
    }
  }

  const handleSetThumbnail = async (fileID) => {
    setThumbMsg('')
    try {
      await ProjectApi.setProjectThumbnailFromFile({ projectID, fileID })
      setThumbMsg(t('viewer.thumbnailSet'))
      setThumbnailMode(false)
      setTimeout(() => setThumbMsg(''), 2500)
    } catch (err) {
      setThumbMsg(t('common.error') + String(err))
    }
  }

  return (
    <div className="workspace-tab-root">
      {error && <div className="error-msg">{error}</div>}

      {groups.length > 0 && (
        <div className="file-view-toggle">
          <button
            className={`file-view-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => { setViewMode('list'); localStorage.setItem('viewMode:files', 'list') }}
            title={t('workspace.listView')}
          >☰</button>
          <button
            className={`file-view-btn${viewMode === 'card' ? ' active' : ''}`}
            onClick={() => { setViewMode('card'); localStorage.setItem('viewMode:files', 'card') }}
            title={t('workspace.cardView')}
          >⊞</button>
          <SortSelect value={sort} onChange={handleSortChange} />
          <button
            className={`btn btn-sm${thumbnailMode ? ' btn-outline-active' : ' btn-outline'}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => { setThumbnailMode(v => !v); setThumbMsg('') }}
          >
            {t('file.setAsProjectThumbnail')}
          </button>
        </div>
      )}

      {thumbnailMode && (
        <div className="thumbnail-mode-hint">{t('file.selectThumbnailHint')}</div>
      )}
      {thumbMsg && <div className="thumbnail-mode-hint thumbnail-mode-ok">{thumbMsg}</div>}

      {groups.length === 0 ? (
        <p className="ws-empty">{t('workspace.noFilesRegistered')}</p>
      ) : viewMode === 'list' ? (
        <div className="file-list">
          {groups.map(g => (
            <div
              key={g.file.id}
              className={`file-item${thumbnailMode ? ' file-item-thumb-select' : ''}`}
              onClick={() => {
                if (thumbnailMode) {
                  handleSetThumbnail(g.file.id)
                } else {
                  navigate('file', {
                    projectID,
                    projectName,
                    fileID:   g.file.id,
                    fileName: g.file.name || g.file.path.split(/[/\\]/).pop(),
                  })
                }
              }}
            >
              {!thumbnailMode && (
                <button
                  className="btn btn-run btn-sm file-item-open-btn"
                  onClick={e => handleOpenFile(e, g.file)}
                  disabled={openingFileID === g.file.id}
                  title={t('workspace.openInBlender')}
                >
                  {openingFileID === g.file.id ? '...' : t('common.open')}
                </button>
              )}
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
              thumbnailMode={thumbnailMode}
              onSetThumbnail={handleSetThumbnail}
            />
          ))}
        </div>
      )}

      {fileError && <div className="error-msg" style={{ marginTop: 8 }}>{fileError}</div>}
      {fileMsg && <div className="success-msg" style={{ marginTop: 8 }}>{fileMsg}</div>}

      <div className="list-fab">
        <button className="btn btn-outline btn-sm" style={{ pointerEvents: 'all' }} onClick={handleAddFilesFromDir}>{t('workspace.addFilesFromDir')}</button>
        <button className="btn btn-green" onClick={handleAddFile}>{t('workspace.addFile')}</button>
      </div>
    </div>
  )
}

export default WorkspaceTab
