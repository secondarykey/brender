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
  const [newCatColor, setNewCatColor] = useState('#4a7cdc')
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


  // Tag edit dialog
  const [editTag, setEditTag] = useState(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagMergeID, setEditTagMergeID] = useState('')
  const [savingTag, setSavingTag] = useState(false)

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
      await TagApi.createCategory({ name, color: newCatColor })
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
    setMergingCat(true)
    try {
      if (editCatMergeID) {
        await TagApi.mergeCategories({ sourceID: editCat.id, targetID: Number(editCatMergeID) })
      } else {
        await TagApi.updateCategory({ id: editCat.id, name, color: editCatColor })
      }
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

  const openEditTag = (tag) => {
    setEditTag(tag)
    setEditTagName(tag.name)
    setEditTagMergeID('')
  }

  const handleSaveTag = async () => {
    if (!editTag) return
    const name = editTagName.trim()
    if (!name) return
    setSavingTag(true)
    try {
      if (editTagMergeID) {
        await TagApi.mergeTags({ sourceID: editTag.id, targetID: Number(editTagMergeID) })
      } else if (name !== editTag.name) {
        await TagApi.updateTag({ id: editTag.id, name, categoryID: editTag.category_id || 0, color: editTag.color || '' })
      }
      showToast(t('common.saved'))
      setEditTag(null)
      load()
    } catch (e) {
      showError(String(e))
    } finally {
      setSavingTag(false)
    }
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
              className="tag-settings-tag-item tag-settings-tag-clickable"
              style={{ backgroundColor: tagColor(tag) }}
              draggable
              onDragStart={e => handleTagDragStart(e, tag.id)}
              onDragEnd={handleDragEnd}
              onClick={() => openEditTag(tag)}
            >
              <span className="tag-settings-tag-name">{tag.name}</span>
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
                  className="tag-settings-tag-item tag-settings-tag-clickable"
                  style={{ backgroundColor: tagColor(tag) }}
                  draggable
                  onDragStart={e => handleTagDragStart(e, tag.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => openEditTag(tag)}
                >
                  <span className="tag-settings-tag-name">{tag.name}</span>
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

      {/* Tag edit dialog */}
      <Dialog
        open={editTag !== null}
        title={t('tag.editTag')}
        onClose={() => setEditTag(null)}
        closeOnBackdrop={!savingTag}
        actions={
          <>
            <button
              className="btn btn-danger"
              onClick={() => { setDeleteTarget(editTag); setDeleteType('tag'); setEditTag(null) }}
              disabled={savingTag}
            >
              {t('common.delete')}
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => setEditTag(null)} disabled={savingTag}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-green" onClick={handleSaveTag} disabled={!editTagName.trim() || savingTag}>
              {savingTag ? t('common.processing') : t('common.save')}
            </button>
          </>
        }
      >
        {editTag && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-field">
              <label className="form-label">{t('tag.tagName')}</label>
              <input
                className="form-input"
                value={editTagName}
                onChange={e => setEditTagName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && editTagName.trim()) handleSaveTag() }}
                style={{ width: '100%' }}
                autoFocus
              />
            </div>

            {tags.length >= 2 && (
              <div className="form-field">
                <label className="form-label">{t('tag.merge')}</label>
                <select
                  className="form-select"
                  value={editTagMergeID}
                  onChange={e => setEditTagMergeID(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">{t('tag.mergeInto')}</option>
                  {tags.filter(tg => tg.id !== editTag.id).map(tg => (
                    <option key={tg.id} value={tg.id}>{tg.category_name ? `${tg.category_name}:${tg.name}` : tg.name}</option>
                  ))}
                </select>
                {editTagMergeID && (
                  <p style={{ marginTop: 8, padding: '8px 10px', borderRadius: 4, backgroundColor: 'rgba(241, 196, 15, 0.12)', border: '1px solid rgba(241, 196, 15, 0.3)', color: '#f1c40f', fontSize: '0.85rem' }}>
                    {t('tag.mergeTagWarning', { source: editTag.name, target: tags.find(tg => String(tg.id) === editTagMergeID)?.name || '' })}
                  </p>
                )}
              </div>
            )}
          </div>
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
                <select
                  className="form-select"
                  value={editCatMergeID}
                  onChange={e => setEditCatMergeID(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">{t('tag.mergeInto')}</option>
                  {categories.filter(c => c.id !== editCat.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {editCatMergeID && (
                  <p style={{ marginTop: 8, padding: '8px 10px', borderRadius: 4, backgroundColor: 'rgba(241, 196, 15, 0.12)', border: '1px solid rgba(241, 196, 15, 0.3)', color: '#f1c40f', fontSize: '0.85rem' }}>
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
        <button className="btn btn-green" onClick={() => { setNewCatName(''); setNewCatColor('#4a7cdc'); setShowNewCatDialog(true) }}>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="color"
            className="tag-settings-color-input"
            value={newCatColor}
            onChange={e => setNewCatColor(e.target.value)}
            style={{ width: 36, height: 36 }}
          />
          <input
            className="form-input"
            placeholder={t('tag.categoryName')}
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) handleCreateCategory() }}
            style={{ flex: 1, width: '100%' }}
            autoFocus
          />
        </div>
      </Dialog>
    </div>
  )
}

export default TagSettings
