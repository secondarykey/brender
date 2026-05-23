import { useState, useEffect, useRef } from 'react'
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
  const [showNewCatDialog, setShowNewCatDialog] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteType, setDeleteType] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Category edit dialog
  const [editCat, setEditCat] = useState(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatColor, setEditCatColor] = useState('')
  const [editCatMergeID, setEditCatMergeID] = useState('')
  const [mergingCat, setMergingCat] = useState(false)

  // Tag merge dialog
  const [mergeSource, setMergeSource] = useState(null)
  const [mergeTargetID, setMergeTargetID] = useState('')
  const [merging, setMerging] = useState(false)

  const [editingTagID, setEditingTagID] = useState(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [newTagInputs, setNewTagInputs] = useState({})
  const [addingTagCatID, setAddingTagCatID] = useState(null)

  // Category reorder drag
  const dragIndex = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  // Tag drag between categories
  const dragTagID = useRef(null)
  const [tagDragOver, setTagDragOver] = useState(null) // category id or 'uncategorized'

  // Auto-scroll during drag
  const scrollRAF = useRef(null)
  const containerRef = useRef(null)

  const startAutoScroll = (clientY) => {
    cancelAnimationFrame(scrollRAF.current)
    const el = containerRef.current?.closest('.tab-content') || containerRef.current?.parentElement
    if (!el) return
    const rect = el.getBoundingClientRect()
    const edgeZone = 60
    let speed = 0
    if (clientY < rect.top + edgeZone) {
      speed = -Math.max(4, (edgeZone - (clientY - rect.top)) * 0.4)
    } else if (clientY > rect.bottom - edgeZone) {
      speed = Math.max(4, (edgeZone - (rect.bottom - clientY)) * 0.4)
    }
    if (speed !== 0) {
      const tick = () => {
        el.scrollTop += speed
        scrollRAF.current = requestAnimationFrame(tick)
      }
      scrollRAF.current = requestAnimationFrame(tick)
    }
  }
  const stopAutoScroll = () => {
    cancelAnimationFrame(scrollRAF.current)
    scrollRAF.current = null
  }

  const handleDragStart = (e, index) => {
    dragIndex.current = index
    dragTagID.current = null
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index)
  }
  const handleTagDragStart = (e, tagID) => {
    dragTagID.current = tagID
    dragIndex.current = null
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tagID)
    e.stopPropagation()
  }
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragTagID.current) {
      setTagDragOver(index)
    } else {
      setDragOver(index)
    }
  }
  const handleCatDragOver = (e, catID) => {
    if (!dragTagID.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setTagDragOver(catID)
    e.stopPropagation()
  }
  const handleDragLeave = () => { setDragOver(null); setTagDragOver(null) }
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    setDragOver(null)
    setTagDragOver(null)
    // Tag drop on category (by index)
    if (dragTagID.current) {
      const catID = categories[dropIndex]?.id || 0
      const tagID = dragTagID.current
      dragTagID.current = null
      await handleSetTagCategory(tagID, catID)
      return
    }
    // Category reorder
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === dropIndex) return
    const newList = [...categories]
    const [moved] = newList.splice(from, 1)
    newList.splice(dropIndex, 0, moved)
    setCategories(newList)
    try {
      await TagApi.reorderCategories({ ids: newList.map(c => c.id) })
    } catch (e) {
      showError(String(e))
      load()
    }
  }
  const handleDropOnUncategorized = async (e) => {
    e.preventDefault()
    setTagDragOver(null)
    stopAutoScroll()
    if (!dragTagID.current) return
    const tagID = dragTagID.current
    dragTagID.current = null
    await handleSetTagCategory(tagID, 0)
  }
  const handleDragEnd = () => {
    dragIndex.current = null
    dragTagID.current = null
    setDragOver(null)
    setTagDragOver(null)
    stopAutoScroll()
  }

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
      setShowNewCatDialog(false)
      showToast(t('common.saved'))
      load()
    } catch (e) {
      showError(String(e))
    }
  }

  const openEditCat = (cat) => {
    setEditCat(cat)
    setEditCatName(cat.name)
    setEditCatColor(cat.color || '#555555')
    setEditCatMergeID('')
  }

  const handleSaveCategory = async () => {
    if (!editCat) return
    const name = editCatName.trim()
    if (!name) return
    try {
      await TagApi.updateCategory({ id: editCat.id, name, color: editCatColor })
      showToast(t('common.saved'))
      setEditCat(null)
      load()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleMergeCatInDialog = async () => {
    if (!editCat || !editCatMergeID) return
    setMergingCat(true)
    try {
      await TagApi.mergeCategories({ sourceID: editCat.id, targetID: Number(editCatMergeID) })
      showToast(t('common.saved'))
      setEditCat(null)
      load()
    } catch (e) {
      showError(String(e))
    } finally {
      setMergingCat(false)
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

  const handleMergeTagConfirm = async () => {
    if (!mergeTargetID) return
    setMerging(true)
    try {
      await TagApi.mergeTags({ sourceID: mergeSource.id, targetID: Number(mergeTargetID) })
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
    <div
      ref={containerRef}
      style={{ padding: 16, maxWidth: 700 }}
      onDragOver={e => { if (dragTagID.current || dragIndex.current !== null) startAutoScroll(e.clientY) }}
    >
      {/* Uncategorized (top in settings) — also drop target for tags */}
      <div
        className={`tag-settings-category${tagDragOver === 'uncategorized' ? ' drag-over' : ''}`}
        style={{ borderLeft: '3px solid rgba(255,255,255,0.15)', display: uncategorized.length > 0 || dragTagID.current ? undefined : 'none' }}
        onDragOver={e => { if (dragTagID.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setTagDragOver('uncategorized') } }}
        onDragLeave={handleDragLeave}
        onDrop={handleDropOnUncategorized}
      >
        <div className="tag-settings-category-header">
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{t('tag.uncategorized')}</span>
        </div>
        <div className="tag-settings-tag-list">
          {uncategorized.map(tag => (
            <span
              key={tag.id}
              className="tag-settings-tag-item"
              style={{ backgroundColor: tagColor(tag) }}
              draggable
              onDragStart={e => handleTagDragStart(e, tag.id)}
              onDragEnd={handleDragEnd}
            >
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
      </div>

      {/* Categories */}
      {categories.map((cat, index) => {
        const catTags = grouped[cat.id] || []
        return (
          <div
            key={cat.id}
            className={`tag-settings-category${dragOver === index ? ' drag-over' : ''}${tagDragOver === cat.id ? ' tag-drag-over' : ''}`}
            draggable={!dragTagID.current}
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={e => { handleDragOver(e, index); handleCatDragOver(e, cat.id) }}
            onDragLeave={handleDragLeave}
            onDrop={e => {
              stopAutoScroll()
              if (dragTagID.current) {
                e.preventDefault()
                e.stopPropagation()
                setTagDragOver(null)
                const tagID = dragTagID.current
                dragTagID.current = null
                handleSetTagCategory(tagID, cat.id)
              } else {
                handleDrop(e, index)
              }
            }}
            onDragEnd={handleDragEnd}
          >
            <div className="tag-settings-category-header">
              <span className="drag-handle" title={t('common.dragToReorder')}>≡</span>
              <span className="tag-settings-cat-color-dot" style={{ backgroundColor: cat.color || '#555' }} />
              <span
                className="tag-settings-cat-name"
                onClick={() => openEditCat(cat)}
                title={t('common.edit')}
              >{cat.name}</span>
            </div>
            <div className="tag-settings-tag-list">
              {catTags.map(tag => (
                <span
                  key={tag.id}
                  className="tag-settings-tag-item"
                  style={{ backgroundColor: tagColor(tag) }}
                  draggable
                  onDragStart={e => handleTagDragStart(e, tag.id)}
                  onDragEnd={handleDragEnd}
                >
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
              {addingTagCatID === cat.id ? (
                <span className="tag-settings-tag-item tag-settings-tag-add-input" style={{ backgroundColor: cat.color || '#555' }}>
                  <input
                    className="tag-settings-tag-name-input"
                    placeholder={t('tag.newTag')}
                    value={newTagInputs[cat.id] || ''}
                    onChange={e => setNewTagInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { handleCreateTag(cat.id); }
                      if (e.key === 'Escape') { setAddingTagCatID(null); setNewTagInputs(prev => ({ ...prev, [cat.id]: '' })) }
                    }}
                    onBlur={() => { if (!(newTagInputs[cat.id] || '').trim()) { setAddingTagCatID(null) } }}
                    autoFocus
                  />
                </span>
              ) : (
                <span
                  className="tag-settings-tag-item tag-settings-tag-add"
                  onClick={() => setAddingTagCatID(cat.id)}
                >
                  + {t('tag.newTag')}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {tags.length === 0 && categories.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 40 }}>
          {t('tag.noTags')}
        </div>
      )}

      {/* Delete dialog (tag only now) */}
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

      {/* Tag merge dialog */}
      <Dialog
        open={mergeSource !== null}
        title={t('tag.mergeTag')}
        onClose={() => setMergeSource(null)}
        closeOnBackdrop={!merging}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setMergeSource(null)} disabled={merging}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-outline" onClick={handleMergeTagConfirm} disabled={merging || !mergeTargetID}>
              {merging ? t('common.processing') : t('tag.merge')}
            </button>
          </>
        }
      >
        {mergeSource && (
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

      {/* Category edit dialog */}
      <Dialog
        open={editCat !== null}
        title={t('tag.editCategory')}
        onClose={() => setEditCat(null)}
        closeOnBackdrop={!mergingCat}
        actions={
          <>
            <button
              className="btn btn-danger"
              onClick={() => { setDeleteTarget(editCat); setDeleteType('category'); setEditCat(null) }}
              disabled={mergingCat}
            >
              {t('common.delete')}
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => setEditCat(null)} disabled={mergingCat}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-green" onClick={handleSaveCategory} disabled={!editCatName.trim() || mergingCat}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {editCat && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name & Color */}
            <div className="form-field">
              <label className="form-label">{t('tag.categoryName')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="color"
                  className="tag-settings-color-input"
                  value={editCatColor}
                  onChange={e => setEditCatColor(e.target.value)}
                  style={{ width: 36, height: 36 }}
                />
                <input
                  className="form-input"
                  value={editCatName}
                  onChange={e => setEditCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && editCatName.trim()) handleSaveCategory() }}
                  style={{ flex: 1, width: '100%' }}
                  autoFocus
                />
              </div>
            </div>

            {/* Merge */}
            {categories.length >= 2 && (
              <div className="form-field">
                <label className="form-label">{t('tag.merge')}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-select"
                    value={editCatMergeID}
                    onChange={e => setEditCatMergeID(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">{t('tag.mergeInto')}</option>
                    {categories.filter(c => c.id !== editCat.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleMergeCatInDialog}
                    disabled={!editCatMergeID || mergingCat}
                  >
                    {mergingCat ? t('common.processing') : t('tag.merge')}
                  </button>
                </div>
                {editCatMergeID && (
                  <p className="form-hint" style={{ marginTop: 4 }}>
                    {t('tag.mergeConfirm', {
                      source: editCat.name,
                      target: categories.find(c => String(c.id) === editCatMergeID)?.name || ''
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* New category fab */}
      <div className="list-fab">
        <button className="btn btn-green" onClick={() => { setNewCatName(''); setShowNewCatDialog(true) }}>
          + {t('tag.newCategory')}
        </button>
      </div>

      {/* New category dialog */}
      <Dialog
        open={showNewCatDialog}
        title={t('tag.newCategory')}
        onClose={() => setShowNewCatDialog(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setShowNewCatDialog(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-green" onClick={handleCreateCategory} disabled={!newCatName.trim()}>
              {t('common.create')}
            </button>
          </>
        }
      >
        <input
          className="form-input"
          placeholder={t('tag.categoryName')}
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) handleCreateCategory() }}
          style={{ width: '100%' }}
          autoFocus
        />
      </Dialog>
    </div>
  )
}

export default TagSettings
