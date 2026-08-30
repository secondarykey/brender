import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { WorkspaceApi, ProjectApi, BlenderApi, FavoriteApi } from '../../../lib/api'
import { onAppEvent } from '../../../lib/appEvents'
import { useToast, useMessage } from '../../../lib/toast'
import SortSelect from '../../../components/SortSelect'
import EntityIcon from '../../../components/EntityIcon'
import FavoriteButton from '../../../components/FavoriteButton'
import { isWails } from '../../../lib/api/_client'
import { MdViewList, MdViewModule, MdViewComfy } from 'react-icons/md'

// サーバモード時にファイルパスが {projectID}/{fileID}/{fileID}.blend でなければ非対応
function isServerIncompatible(file) {
  if (isWails()) return false
  const norm = (file.path || '').replace(/\\/g, '/')
  const expected = `${file.project_id}/${file.id}/${file.id}.blend`
  return !norm.endsWith(expected)
}

// ── サムネイルタイル ──────────────────────────────────────
function FileCard({ projectID, g, navigate, projectName, thumbnailMode, onSetThumbnail, favorite, onFavoriteChange }) {
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
      className={`file-tile entity-file entity-bar${thumbnailMode ? ' file-tile-thumb-select' : ''}${isServerIncompatible(g.file) ? ' file-tile-not-packed' : ''}`}
      title={fileName}
      onClick={handleClick}
    >
      <div className="file-tile-thumb">
        {thumb
          ? <img src={thumb} alt={fileName} />
          : <span className="file-tile-thumb-placeholder">{t('workspace.noImage')}</span>
        }
        <FavoriteButton
          fileID={g.file.id}
          favorite={favorite}
          onChange={onFavoriteChange}
          variant="overlay"
        />
      </div>
      <div className="file-tile-info">
        <div className="entity-name-row">
          <EntityIcon type="file" />
          <div className={`file-tile-name${g.file.file_exists === false ? ' file-missing' : ''}`} title={fileName}>{fileName}</div>
          <span className="file-tile-ws-count">{t('workspace.countLabel', { count: g.workspaces.length })}</span>
        </div>
        {isServerIncompatible(g.file) && (
          <div className="file-tile-pack-warning" title={t('file.serverIncompatible')}>{t('file.serverIncompatible')}</div>
        )}
      </div>
    </div>
  )
}

function WorkspaceTab({ projectID, navigate, projectName, role, onCountChange }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [groups, setGroups]   = useState([])
  const [openingFileID, setOpeningFileID] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode:files') || 'card')
  const [thumbnailMode, setThumbnailMode] = useState(false)
  const [sort, setSort] = useState(() => localStorage.getItem('sort:files') || 'display_order')
  const [dir, setDir]   = useState(() => localStorage.getItem('dir:files') || '')
  const [favoriteIDs, setFavoriteIDs] = useState(() => new Set())

  useEffect(() => {
    FavoriteApi.listIDs()
      .then(ids => setFavoriteIDs(new Set(ids || [])))
      .catch(() => {})
  }, [projectID])

  const handleFavoriteChange = (fileID, favorite) => {
    setFavoriteIDs(prev => {
      const next = new Set(prev)
      if (favorite) next.add(fileID)
      else next.delete(fileID)
      return next
    })
  }

  const isOwner     = role === 'owner'
  const isEditor    = role === 'editor'
  const canEdit     = isOwner || isEditor
  const canAddFiles = isOwner || isEditor || role === 'file_register'

  const load = (s, d) => {
    WorkspaceApi.listByProject({ projectID, sort: s, dir: d })
      .then(list => {
        setGroups(list || [])
        if (onCountChange) onCountChange((list || []).length)
      })
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

  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)

  const handleAddFile = async () => {
    showError('')
    if (isWails()) {
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
    } else {
      // サーバモード: ファイルアップロード
      fileInputRef.current?.click()
    }
  }

  const fmtSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
    return (bytes / 1024 ** 3).toFixed(1) + ' GB'
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadPct(0)
    showError('')
    try {
      await ProjectApi.uploadFile({
        projectID,
        file,
        onProgress: (pct) => setUploadPct(pct),
      })
      load()
      showToast(t('workspace.fileUploaded'))
    } catch (err) {
      showError(String(err))
    } finally {
      setUploading(false)
      setUploadPct(0)
    }
  }

  const handleSetThumbnail = async (fileID) => {
    try {
      await ProjectApi.setProjectThumbnailFromFile({ projectID, fileID })
      showToast(t('viewer.thumbnailSet'))
      setThumbnailMode(false)
    } catch (err) {
      showError(String(err))
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
            ><MdViewList /></button>
            <button
              className={`file-view-btn${viewMode === 'card' ? ' active' : ''}`}
              onClick={() => { setViewMode('card'); localStorage.setItem('viewMode:files', 'card') }}
              title={t('workspace.cardView')}
            ><MdViewModule /></button>
            <button
              className={`file-view-btn${viewMode === 'card-sm' ? ' active' : ''}`}
              onClick={() => { setViewMode('card-sm'); localStorage.setItem('viewMode:files', 'card-sm') }}
              title={t('workspace.smallCardView')}
            ><MdViewComfy /></button>
            <SortSelect value={sort} onChange={handleSortChange} dir={dir} onDirChange={handleDirChange} options={['display_order', 'name', 'created_at', 'processed_at', 'file_modified_at']} />
          </>
        )}
        {groups.length > 0 && canEdit && (
          <div style={{ marginLeft: 'auto' }}>
            <button
              className={`btn btn-sm${thumbnailMode ? ' btn-outline-active' : ' btn-outline'}`}
              onClick={() => setThumbnailMode(v => !v)}
            >
              {t('file.setAsProjectThumbnail')}
            </button>
          </div>
        )}
      </div>

      {thumbnailMode && (
        <div className="thumbnail-mode-hint">{t('file.selectThumbnailHint')}</div>
      )}

      {groups.length === 0 ? (
        <p className="ws-empty">{t('workspace.noFilesRegistered')}</p>
      ) : viewMode === 'list' ? (
        <div className="file-list">
          {groups.map(g => (
            <div
              key={g.file.id}
              className={`file-item entity-file entity-bar${thumbnailMode ? ' file-item-thumb-select' : ''}`}
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
              {!thumbnailMode && isWails() && (
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
                <div className="entity-name-row">
                  <EntityIcon type="file" />
                  <span className={`ws-file-name${g.file.file_exists === false ? ' file-missing' : ''}`}>{g.file.name || g.file.path.split(/[/\\]/).pop()}</span>
                </div>
                {isServerIncompatible(g.file) && (
                  <span className="file-item-pack-warning">{t('file.serverIncompatible')}</span>
                )}
                <span className="ws-file-path">{g.file.path}</span>
              </div>
              <div className="file-item-meta">
                <FavoriteButton
                  fileID={g.file.id}
                  favorite={favoriteIDs.has(g.file.id)}
                  onChange={handleFavoriteChange}
                />
                <span className="file-item-count">{t('workspace.countLabel', { count: g.workspaces.length })}</span>
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
              favorite={favoriteIDs.has(g.file.id)}
              onFavoriteChange={handleFavoriteChange}
            />
          ))}
        </div>
      )}


      <div className="list-spacer" />
      {canAddFiles && (
      <div className="list-fab">
        {uploading && (
          <div className="upload-progress">
            <div style={{ fontSize: '0.82rem', color: 'rgba(var(--fg), 0.6)', marginBottom: 4 }}>
              {t('workspace.uploading')} {Math.round(uploadPct * 100)}%
            </div>
            <div style={{ background: 'rgba(var(--fg), 0.1)', borderRadius: 4, height: 6, width: 200 }}>
              <div style={{
                background: '#27ae60',
                borderRadius: 4,
                height: 6,
                width: `${Math.round(uploadPct * 100)}%`,
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}
        <button className="btn btn-green" onClick={handleAddFile} disabled={uploading}>
          {uploading ? t('workspace.uploading') : t('workspace.addFile')}
        </button>
        {!isWails() && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".blend"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        )}
      </div>
      )}
    </div>
  )
}

export default WorkspaceTab
