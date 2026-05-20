import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectApi, WorkDirApi, BlenderApi } from '../../lib/api'
import { useMessage } from '../../lib/toast'
import SortSelect from '../../components/SortSelect'

function WorkDirBadge({ status, t }) {
  if (status === 'lock') {
    return <span className="badge-red" style={{ marginLeft: 6, fontSize: 11 }}>{t('settings.workDirs.statusLock')}</span>
  }
  if (status === 'inactive') {
    return <span className="badge-yellow" style={{ marginLeft: 6, fontSize: 11 }}>{t('settings.workDirs.statusInactive')}</span>
  }
  return null
}

// ── プロジェクトタイル（サムネイル表示） ──────────────────
function ProjectTile({ d, workDirMap, navigate }) {
  const { t } = useTranslation()
  const [thumb, setThumb] = useState(null)
  const wd = workDirMap[d.project.work_dir_id]

  useEffect(() => {
    ProjectApi.getProjectThumbnail({ projectID: d.project.id })
      .then(src => setThumb(src || null))
      .catch(() => {})
  }, [d.project.id])

  return (
    <div className="file-tile" title={d.project.name} onClick={() => navigate('project', { id: d.project.id })}>
      <div className="file-tile-thumb">
        {thumb
          ? <img src={thumb} alt={d.project.name} />
          : <div className="thumbnail-placeholder">No Image</div>
        }
      </div>
      <div className="file-tile-info">
        <div className="file-tile-name" title={d.project.name}>
          {d.project.name}
          {wd && <WorkDirBadge status={wd.status} t={t} />}
        </div>
        {d.files.length > 0 && (
          <div className="project-files" style={{ marginTop: 4 }}>
            {d.files.slice(0, 3).map(f => (
              <span key={f.id} className="project-file-chip">{f.name}</span>
            ))}
            {d.files.length > 3 && <span className="project-file-chip">+{d.files.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectListPage({ navigate }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [projects, setProjects] = useState([])
  const [workDirMap, setWorkDirMap] = useState({})
  const [hasWorkDir, setHasWorkDir] = useState(true)
  const [hasBlender, setHasBlender] = useState(true)
  const [creating, setCreating] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode:projects') || 'list')
  const [sort, setSort]         = useState(() => localStorage.getItem('sort:projects') || 'display_order')
  const [dir, setDir]           = useState(() => localStorage.getItem('dir:projects') || '')

  const load = (s, d) => {
    ProjectApi.list({ sort: s, dir: d })
      .then(list => setProjects(list || []))
      .catch(err => showError(String(err)))
  }

  const handleSortChange = (s) => {
    setSort(s)
    localStorage.setItem('sort:projects', s)
    load(s, dir)
  }

  const handleDirChange = (d) => {
    setDir(d)
    localStorage.setItem('dir:projects', d)
    load(sort, d)
  }

  useEffect(() => {
    load(sort, dir)
    WorkDirApi.list()
      .then(list => {
        const dirs = list || []
        const map = {}
        for (const w of dirs) map[w.id] = w
        setWorkDirMap(map)
        setHasWorkDir(dirs.some(w => w.status === 'active'))
      })
      .catch(() => setHasWorkDir(false))
    BlenderApi.list()
      .then(list => setHasBlender((list || []).length > 0))
      .catch(() => setHasBlender(false))
  }, [])

  const canCreate = hasWorkDir && hasBlender

  const handleCreate = async () => {
    if (!canCreate || creating) return
    setCreating(true)
    try {
      const d = await ProjectApi.create({ name: 'New Project Name' })
      navigate('project', { id: d.project.id, initialTab: 'settings', focusName: true })
    } catch (err) {
      showError(String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      {!hasWorkDir && (
        <div className="notice-banner">
          {t('project.rootNotSet')}
          <button className="btn-link" onClick={() => navigate('settings', { tab: 'envSettings' })}>{t('project.configureInSettings')}</button>
        </div>
      )}
      {hasWorkDir && !hasBlender && (
        <div className="notice-banner">
          {t('settings.noBlenderRegistered')}
          <button className="btn-link" onClick={() => navigate('settings', { tab: 'envSettings' })}>{t('project.configureInSettings')}</button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <p>{t('project.empty')}</p>
          <button className="btn btn-green" onClick={handleCreate} disabled={!canCreate || creating}>{t('project.createFirst')}</button>
        </div>
      ) : (
        <>
          {projects.length > 0 && (
            <div className="file-view-toggle" style={{ marginBottom: 8 }}>
              <button
                className={`file-view-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => { setViewMode('list'); localStorage.setItem('viewMode:projects', 'list') }}
                title={t('workspace.listView')}
              >☰</button>
              <button
                className={`file-view-btn${viewMode === 'card' ? ' active' : ''}`}
                onClick={() => { setViewMode('card'); localStorage.setItem('viewMode:projects', 'card') }}
                title={t('workspace.cardView')}
              >⊞</button>
              <button
                className={`file-view-btn${viewMode === 'card-sm' ? ' active' : ''}`}
                onClick={() => { setViewMode('card-sm'); localStorage.setItem('viewMode:projects', 'card-sm') }}
                title={t('workspace.smallCardView')}
              >▦</button>
              <SortSelect value={sort} onChange={handleSortChange} dir={dir} onDirChange={handleDirChange} />
            </div>
          )}

          {viewMode === 'list' ? (
            <div className="project-list">
              {projects.map(d => {
                const wd = workDirMap[d.project.work_dir_id]
                return (
                  <div
                    key={d.project.id}
                    className="project-card"
                    onClick={() => navigate('project', { id: d.project.id })}
                  >
                    <div className="project-card-header">
                      <span className="project-name">
                        {d.project.name}
                        {wd && <WorkDirBadge status={wd.status} t={t} />}
                      </span>
                      {d.blender && (
                        <span className="project-blender-badge">
                          {d.blender.name} {d.blender.version}
                        </span>
                      )}
                    </div>
                    <div className="project-files">
                      {d.files.map(f => (
                        <span key={f.id} className="project-file-chip">{f.name}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={`file-tile-grid${viewMode === 'card-sm' ? ' file-tile-grid--sm' : ''}`}>
              {projects.map(d => (
                <ProjectTile key={d.project.id} d={d} workDirMap={workDirMap} navigate={navigate} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="list-spacer" />
      <div className="list-fab">
        <button className="btn btn-green" onClick={handleCreate} disabled={!canCreate || creating}>
          {creating ? t('common.registering') : t('project.register.transition')}
        </button>
      </div>
    </div>
  )
}

export default ProjectListPage
