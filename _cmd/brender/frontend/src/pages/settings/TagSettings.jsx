import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TagApi } from '../../lib/api'
import { useToast, useMessage } from '../../lib/toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import Dialog from '../../components/Dialog'

function TagSettings() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()

  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  const [newCatName, setNewCatName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteType, setDeleteType] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [mergeSource, setMergeSource] = useState(null)
  const [mergeTargetID, setMergeTargetID] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergeType, setMergeType] = useState('category')

  const [editingTagID, setEditingTagID] = useState(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [newTagInputs, setNewTagInputs] = useState({})

  const load = () => {
    setLoading(true)
    Promise.all([
      TagApi.listCategories().catch(() => []),
      TagApi.listTags().catch(() => []),
    ]).then(([cats, ts]) => {
      setCategories(cats || [])
      setTags(ts || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreateCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    try {
      await TagApi.createCategory({ name })
      setNewCatName('')
      showToast(t('common.saved'))
      load()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleUpdateCategory = async (cat, name, color) => {
    try {
      await TagApi.updateCategory({ id: cat.id, name: name.trim(), color })
      load()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      if (deleteType === 'category') {
        await TagApi.deleteCategory({ id: deleteTarget.id })
      } else {
        await TagApi.deleteTag({ id: deleteTarget.id })
      }
      showToast(t('common.saved'))
      load()
    } catch (e) {
      showError(String(e))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleMergeConfirm = async () => {
    if (!mergeTargetID) return
    setMerging(true)
    try {
      if (mergeType === 'category') {
        await TagApi.mergeCategories({ sourceID: mergeSource.id, targetID: Number(mergeTargetID) })
      } else {
        await TagApi.mergeTags({ sourceID: mergeSource.id, targetID: Number(mergeTargetID) })
      }
      showToast(t('common.saved'))
      load()
    } catch (e) {
      showError(String(e))
    } finally {
      setMerging(false)
      setMergeSource(null)
      setMergeTargetID('')
    }
  }

  const handleUpdateTag = async (tag) => {
    const name = editingTagName.trim()
    if (!name || name === tag.name) {
      setEditingTagID(null)
      return
    }
    try {
      await TagApi.updateTag({ id: tag.id, name, categoryID: tag.category_id || 0, color: tag.color || '' })
      showToast(t('common.saved'))
      load()
    } catch (e) {
      showError(String(e))
    } finally {
      setEditingTagID(null)
    }
  }

  const openTagMerge = (tag) => {
    setMergeSource(tag)
    setMergeType('tag')
    const others = tags.filter(t => t.id !== tag.id)
    setMergeTargetID(others.length > 0 ? String(others[0].id) : '')
  }

  const handleCreateTag = async (categoryID) => {
    const key = categoryID || 0
    const name = (newTagInputs[key] || '').trim()
    if (!name) return
    try {
      await TagApi.createTag({ name, categoryID: categoryID || 0 })
      setNewTagInputs(prev => ({ ...prev, [key]: '' }))
      showToast(t('common.saved'))
      load()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleSetTagCategory = async (tagID, categoryID) => {
    try {
      await TagApi.setTagCategory({ tagID, categoryID: categoryID || 0 })
      load()
    } catch (e) {
      showError(String(e))
    }
  }

  const grouped = {}
  const uncategorized = []
  tags.forEach(tag => {
    if (tag.category_id) {
      if (!grouped[tag.category_id]) grouped[tag.category_id] = []
      grouped[tag.category_id].push(tag)
    } else {
      uncategorized.push(tag)
    }
  })

  const tagColor = (tag) => tag.color || tag.category_color || '#555'

  if (loading) return <div style={{ padding: 16, color: 'rgba(255,255,255,0.4)' }}>{t('common.loading')}</div>

  return (
    <div style={{ padding: 16, maxWidth: 700 }}>
      {/* Category creation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder={t('tag.newCategory')}
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory() }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-green btn-sm" onClick={handleCreateCategory} disabled={!newCatName.trim()}>
          {t('common.create')}
        </button>
      </div>

      {/* Categories */}
      {categories.map(cat => {
        const catTags = grouped[cat.id] || []
        return (
          <div key={cat.id} className="tag-settings-category">
            <div className="tag-settings-category-header">
              <input
                type="color"
                className="tag-settings-color-input"
                value={cat.color || '#555555'}
                onChange={e => handleUpdateCategory(cat, cat.name, e.target.value)}
              />
              <input
                className="form-input"
                value={cat.name}
                onChange={e => {
                  setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c))
                }}
                onBlur={e => {
                  const val = e.target.value.trim()
                  if (val && val !== cat.name) handleUpdateCategory(cat, val, cat.color)
                }}
                style={{ flex: 1, height: 28, fontSize: '0.85rem' }}
              />
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setMergeSource(cat)
                  setMergeType('category')
                  const others = categories.filter(c => c.id !== cat.id)
                  setMergeTargetID(others.length > 0 ? String(others[0].id) : '')
                }}
                disabled={categories.length < 2}
              >
                {t('tag.merge')}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { setDeleteTarget(cat); setDeleteType('category') }}
              >
                {t('common.delete')}
              </button>
            </div>
            {catTags.length > 0 && (
              <div className="tag-settings-tag-list">
                {catTags.map(tag => (
                  <span key={tag.id} className="tag-settings-tag-item" style={{ backgroundColor: tagColor(tag) }}>
                    {editingTagID === tag.id ? (
                      <input
                        className="tag-settings-tag-name-input"
                        value={editingTagName}
                        onChange={e => setEditingTagName(e.target.value)}
                        onBlur={() => handleUpdateTag(tag)}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateTag(tag); if (e.key === 'Escape') setEditingTagID(null) }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="tag-settings-tag-name"
                        onDoubleClick={() => { setEditingTagID(tag.id); setEditingTagName(tag.name) }}
                        title={t('tag.rename')}
                      >{tag.name}</span>
                    )}
                    <button onClick={() => openTagMerge(tag)} title={t('tag.mergeTag')} disabled={tags.length < 2}>⇄</button>
                    <button onClick={() => { setDeleteTarget(tag); setDeleteType('tag') }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                className="form-input"
                placeholder={t('tag.newTag')}
                value={newTagInputs[cat.id] || ''}
                onChange={e => setNewTagInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateTag(cat.id) }}
                style={{ flex: 1, height: 26, fontSize: '0.8rem' }}
              />
              <button className="btn btn-green btn-sm" onClick={() => handleCreateTag(cat.id)} disabled={!(newTagInputs[cat.id] || '').trim()} style={{ height: 26, fontSize: '0.75rem' }}>
                +
              </button>
            </div>
          </div>
        )
      })}

      {/* Uncategorized */}
      {uncategorized.length > 0 && (
        <div className="tag-settings-category" style={{ borderLeft: '3px solid rgba(255,255,255,0.15)' }}>
          <div className="tag-settings-category-header">
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{t('tag.uncategorized')}</span>
          </div>
          <div className="tag-settings-tag-list">
            {uncategorized.map(tag => (
              <span key={tag.id} className="tag-settings-tag-item" style={{ backgroundColor: tagColor(tag) }}>
                {editingTagID === tag.id ? (
                  <input
                    className="tag-settings-tag-name-input"
                    value={editingTagName}
                    onChange={e => setEditingTagName(e.target.value)}
                    onBlur={() => handleUpdateTag(tag)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateTag(tag); if (e.key === 'Escape') setEditingTagID(null) }}
                    autoFocus
                  />
                ) : (
                  <span
                    className="tag-settings-tag-name"
                    onDoubleClick={() => { setEditingTagID(tag.id); setEditingTagName(tag.name) }}
                    title={t('tag.rename')}
                  >{tag.name}</span>
                )}
                <select
                  className="form-select"
                  value=""
                  onChange={e => handleSetTagCategory(tag.id, Number(e.target.value))}
                  style={{ height: 22, fontSize: '0.7rem', padding: '0 4px', marginLeft: 4, width: 'auto', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'rgba(255,255,255,0.7)' }}
                >
                  <option value="">{t('tag.assignCategory')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => openTagMerge(tag)} title={t('tag.mergeTag')} disabled={tags.length < 2}>⇄</button>
                <button onClick={() => { setDeleteTarget(tag); setDeleteType('tag') }}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {tags.length === 0 && categories.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 40 }}>
          {t('tag.noTags')}
        </div>
      )}

      {/* Delete dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteType === 'category' ? t('tag.confirmDeleteCategory') : t('tag.confirmDeleteTag')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
      >
        <p>{deleteTarget?.name}</p>
        <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
          {deleteType === 'category' ? t('tag.deleteCategoryWarning') : t('tag.deleteTagWarning')}
        </p>
      </ConfirmDialog>

      {/* Merge dialog */}
      <Dialog
        open={mergeSource !== null}
        title={mergeType === 'category' ? t('tag.merge') : t('tag.mergeTag')}
        onClose={() => setMergeSource(null)}
        closeOnBackdrop={!merging}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setMergeSource(null)} disabled={merging}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-outline" onClick={handleMergeConfirm} disabled={merging || !mergeTargetID}>
              {merging ? t('common.processing') : t('tag.merge')}
            </button>
          </>
        }
      >
        {mergeSource && mergeType === 'category' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 12 }}>
              {t('tag.mergeConfirm', { source: mergeSource.name, target: categories.find(c => String(c.id) === mergeTargetID)?.name || '' })}
            </p>
            <select
              className="form-select"
              value={mergeTargetID}
              onChange={e => setMergeTargetID(e.target.value)}
              style={{ width: '100%' }}
            >
              {categories.filter(c => c.id !== mergeSource.id).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
        {mergeSource && mergeType === 'tag' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 12 }}>
              {t('tag.mergeTagConfirm', { source: mergeSource.name, target: tags.find(tg => String(tg.id) === mergeTargetID)?.name || '' })}
            </p>
            <select
              className="form-select"
              value={mergeTargetID}
              onChange={e => setMergeTargetID(e.target.value)}
              style={{ width: '100%' }}
            >
              {tags.filter(tg => tg.id !== mergeSource.id).map(tg => (
                <option key={tg.id} value={tg.id}>{tg.category_name ? `${tg.category_name}:${tg.name}` : tg.name}</option>
              ))}
            </select>
          </>
        )}
      </Dialog>
    </div>
  )
}

export default TagSettings
