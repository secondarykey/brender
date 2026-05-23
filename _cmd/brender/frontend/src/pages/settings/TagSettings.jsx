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
      await TagApi.mergeCategories({ sourceID: mergeSource.id, targetID: Number(mergeTargetID) })
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
                    {tag.name}
                    <button onClick={() => { setDeleteTarget(tag); setDeleteType('tag') }}>×</button>
                  </span>
                ))}
              </div>
            )}
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
                {tag.name}
                <select
                  className="form-select"
                  value=""
                  onChange={e => handleSetTagCategory(tag.id, Number(e.target.value))}
                  style={{ height: 22, fontSize: '0.7rem', padding: '0 4px', marginLeft: 4, width: 'auto', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'rgba(255,255,255,0.7)' }}
                >
                  <option value="">{t('tag.assignCategory')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
        title={t('tag.merge')}
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
        {mergeSource && (
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
      </Dialog>
    </div>
  )
}

export default TagSettings
