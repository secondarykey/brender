import { useState, useEffect } from 'react'
import { ProjectService, EnvironmentService } from '../../../bindings/changeme'

function ProjectListPage({ navigate }) {
  const [projects, setProjects]   = useState([])
  const [error, setError]         = useState('')
  const [creating, setCreating]   = useState(false)
  const [name, setName]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [createError, setCreateError] = useState('')
  const [hasRoot, setHasRoot]     = useState(true)

  const load = () => {
    ProjectService.List()
      .then(list => setProjects(list || []))
      .catch(err => setError(String(err)))
  }

  useEffect(() => {
    EnvironmentService.Get()
      .then(env => setHasRoot(!!(env && env.root)))
      .catch(() => setHasRoot(false))
    load()
  }, [])

  const handleStartCreate = () => {
    if (!hasRoot) return
    setName('')
    setCreateError('')
    setCreating(true)
  }

  const handleSave = async () => {
    setCreateError('')
    if (!name.trim()) { setCreateError('プロジェクト名を入力してください'); return }
    setSaving(true)
    try {
      const d = await ProjectService.Create(name.trim())
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
          <button className="btn" onClick={handleStartCreate} disabled={!hasRoot}>+ 新規作成</button>
        )}
      </div>

      {!hasRoot && (
        <div className="notice-banner">
          作業ディレクトリが設定されていません。
          <button className="btn-link" onClick={() => navigate('settings')}>設定画面で設定してください</button>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {creating && (
        <div className="ws-create-form" style={{ marginBottom: 16 }}>
          <input
            className="form-input ws-create-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder="プロジェクト名"
            autoFocus
          />
          {createError && <span className="ws-create-error">{createError}</span>}
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '...' : '作成'}
          </button>
          <button className="btn btn-ghost" onClick={() => setCreating(false)}>キャンセル</button>
        </div>
      )}

      {projects.length === 0 && !creating ? (
        <div className="empty-state">
          <p>プロジェクトがありません</p>
          <button className="btn" onClick={handleStartCreate} disabled={!hasRoot}>最初のプロジェクトを作成</button>
        </div>
      ) : (
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
      )}
    </div>
  )
}

export default ProjectListPage
