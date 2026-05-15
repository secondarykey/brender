import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, ProjectApi, BlenderApi } from '../../../lib/api'
import { onAppEvent } from '../../../lib/appEvents'
import { useMessage } from '../../../lib/toast'
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
      title={fileName}
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
  const { showError } = useMessage()
  const [groups, setGroups]   = useState([])
  const [openingFileID, setOpeningFileID] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode:files') || 'card')
  const [thumbnailMode, setThumbnailMode] = useState(false)
  const [thumbMsg, setThumbMsg] = useState('')
  const [sort, setSort] = useState(() => localStorage.getItem('sort:files') || 'display_order')
  const [dir, setDir]   = useState(() => localStorage.getItem('dir:files') || '')

  const load = (s, d) => {
    WorkspaceApi.listByProject({ projectID, sort: s, dir: d })
      .then(list => setGroups(list || []))
      .catch(err => showError(String(err)))
  }

  const handleSortChange = (s) => {
    setSort(s)
    localStorage.setItem('sort:files', s)
    load(s, dir)
  }

  const handleDirChange = (d) => {
    setDir(d)
    localStorage.setItem('dir:files', d)
    load(sort, d)
  }

  useEffect(() => { load(sort, dir) }, [projectID])

  const handleOpenFile = async (e, file) => {
    e.stopPropagation()
    setOpeningFileID(file.id)
    try {
      await BlenderApi.openFile({ installID: file.blender_install_id || 0, filePath: file.path })
    } catch (err) {
      showError(String(err))
    } finally {
      setOpeningFileID(null)
    }
  }

  const handleAddFile = async () => {
    showError('')
    try {
      const path = await Dialogs.OpenFile({
        Filters: [{ DisplayName: 'Blender File', Pattern: '*.blend' }],
      })
      if (!path) return
      await ProjectApi.addFile({ projectID, path })
      load()
    } catch (err) {
      showError(String(err))
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

      <div className="file-view-toggle">
        {groups.length > 0 && (
          <>
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
            <button
              className={`file-view-btn${viewMode === 'card-sm' ? ' active' : ''}`}
              onClick={() => { setViewMode('card-sm'); localStorage.setItem('viewMode:files', 'card-sm') }}
              title={t('workspace.smallCardView')}
            >▦</button>
            <SortSelect value={sort} onChange={handleSortChange} dir={dir} onDirChange={handleDirChange} />
          </>
        )}
        {groups.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            <button
              className={`btn btn-sm${thumbnailMode ? ' btn-outline-active' : ' btn-outline'}`}
              onClick={() => { setThumbnailMode(v => !v); setThumbMsg('') }}
            >
              {t('file.setAsProjectThumbnail')}
            </button>
          </div>
        )}
      </div>

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
        <div className={`file-tile-grid${viewMode === 'card-sm' ? ' file-tile-grid--sm' : ''}`}>
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


      <div className="list-spacer" />
      <div className="list-fab">
        <button className="btn btn-green" onClick={handleAddFile}>{t('workspace.addFile')}</button>
      </div>
    </div>
  )
}

export default WorkspaceTab
