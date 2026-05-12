import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectApi, EnvironmentApi } from '../../lib/api'

// ── プロジェクトタイル（サムネイル表示） ──────────────────
function ProjectTile({ d, navigate }) {
  const { t } = useTranslation()
  const [thumb, setThumb] = useState(null)

  useEffect(() => {
    ProjectApi.getProjectThumbnail({ projectID: d.project.id })
      .then(src => setThumb(src || null))
      .catch(() => {})
  }, [d.project.id])

  return (
    <div className="file-tile" onClick={() => navigate('project', { id: d.project.id })}>
      <div className="file-tile-thumb">
        {thumb
          ? <img src={thumb} alt={d.project.name} />
          : <div className="thumbnail-placeholder">No Image</div>
        }
      </div>
      <div className="file-tile-info">
        <div className="file-tile-name" title={d.project.name}>{d.project.name}</div>
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
  const [projects, setProjects]   = useState([])
  const [error, setError]         = useState('')
  const [creating, setCreating]   = useState(false)
  const [name, setName]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [createError, setCreateError] = useState('')
  const [hasRoot, setHasRoot]     = useState(true)
  const [viewMode, setViewMode]   = useState('list') // 'list' | 'card'
  const inputRef = useRef(null)

  const load = () => {
    ProjectApi.list()
      .then(list => setProjects(list || []))
      .catch(err => setError(String(err)))
  }

  useEffect(() => {
    EnvironmentApi.get()
      .then(env => setHasRoot(!!(env && env.root)))
      .catch(() => setHasRoot(false))
    load()
  }, [])

  const handleStartCreate = () => {
    if (!hasRoot) return
    setName('New Project')
    setCreateError('')
    setCreating(true)
  }

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.select()
    }
  }, [creating])

  const handleSave = async () => {
    setCreateError('')
    if (!name.trim()) { setCreateError(t('project.nameRequired')); return }
    setSaving(true)
    try {
      const d = await ProjectApi.create({ name: name.trim() })
      setCreating(false)
      load()
      navigate('project', { id: d.project.id })
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setCreating(false)
  }

  return (
    <div className="page">
      <div className="page-header">
{!creating && (
          <button className="btn" onClick={handleStartCreate} disabled={!hasRoot}>{t('project.register.transition')}</button>
        )}
      </div>

      {!hasRoot && (
        <div className="notice-banner">
          {t('project.rootNotSet')}
          <button className="btn-link" onClick={() => navigate('settings')}>{t('project.configureInSettings')}</button>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {creating && (
        <div className="ws-create-form" style={{ marginBottom: 16 }}>
          <input
            ref={inputRef}
            className="form-input ws-create-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('project.name')}
          />
          {createError && <span className="ws-create-error">{createError}</span>}
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '...' : t('project.register.apply')}
          </button>
          <button className="btn btn-ghost" onClick={() => setCreating(false)}>{t('project.register.cancel')}</button>
        </div>
      )}

      {projects.length === 0 && !creating ? (
        <div className="empty-state">
          <p>{t('project.empty')}</p>
          <button className="btn" onClick={handleStartCreate} disabled={!hasRoot}>{t('project.createFirst')}</button>
        </div>
      ) : (
        <>
          {projects.length > 0 && (
            <div className="file-view-toggle" style={{ marginBottom: 8 }}>
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

          {viewMode === 'list' ? (
            <div className="project-list">
              {projects.map(d => (
                <div
                  key={d.project.id}
                  className="project-card"
                  onClick={() => navigate('project', { id: d.project.id })}
                >
                  <div className="project-card-header">
                    <span className="project-name">{d.project.name}</span>
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
              ))}
            </div>
          ) : (
            <div className="file-tile-grid">
              {projects.map(d => (
                <ProjectTile key={d.project.id} d={d} navigate={navigate} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ProjectListPage
