import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { TagApi, ProjectApi } from '../../lib/api'
import { useMessage } from '../../lib/toast'
import Pagination from '../../components/Pagination'
import { MdViewList, MdViewModule, MdViewComfy } from 'react-icons/md'

function SearchPage({ navigate }) {
  const { t } = useTranslation()
  const { showError } = useMessage()

  const [allTags, setAllTags] = useState([])
  const [categories, setCategories] = useState([])
  const [tagCounts, setTagCounts] = useState({})
  const [selectedTagIDs, setSelectedTagIDs] = useState([])
  const [untagged, setUntagged] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')

  const [files, setFiles] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => Number(localStorage.getItem('pageSize:search')) || 20)
  const [thumbnails, setThumbnails] = useState({})
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode:search') || 'card')

  const loadMeta = useCallback(() => {
    Promise.all([
      TagApi.listTags().catch(() => []),
      TagApi.listCategories().catch(() => []),
      TagApi.listTagUsageCounts().catch(() => []),
    ]).then(([tags, cats, counts]) => {
      setAllTags(tags || [])
      setCategories(cats || [])
      const map = {}
      ;(counts || []).forEach(c => { map[c.tag_id] = c.count })
      setTagCounts(map)
    })
  }, [])

  useEffect(() => { loadMeta() }, [loadMeta])

  const search = useCallback(() => {
    TagApi.searchFiles({ tagIDs: selectedTagIDs, page, pageSize, untagged, keyword })
      .then(res => {
        setFiles(res?.files || [])
        setTotal(res?.total || 0)
      })
      .catch(e => showError(String(e)))
  }, [selectedTagIDs, page, pageSize, untagged, keyword])

  useEffect(() => { search() }, [search])

  useEffect(() => {
    const newThumbs = {}
    files.forEach(f => {
      if (!thumbnails[f.id]) {
        ProjectApi.getFileThumbnail({ projectID: f.project_id, fileID: f.id })
          .then(src => {
            if (src) setThumbnails(prev => ({ ...prev, [f.id]: src }))
          })
          .catch(() => {})
      } else {
        newThumbs[f.id] = thumbnails[f.id]
      }
    })
  }, [files])

  const toggleTag = (tagID, e) => {
    setPage(1)
    setUntagged(false)
    const tag = allTags.find(t => t.id === tagID)
    const isMulti = e?.ctrlKey || e?.metaKey
    setSelectedTagIDs(prev => {
      if (prev.includes(tagID)) {
        return prev.filter(id => id !== tagID)
      }
      if (isMulti || !tag?.category_id) {
        return [...prev, tagID]
      }
      // Single select within category: remove other tags in same category
      const sameCatIDs = new Set((grouped[tag.category_id] || []).map(t => t.id))
      return [...prev.filter(id => !sameCatIDs.has(id)), tagID]
    })
  }

  const toggleUntagged = () => {
    setPage(1)
    setSelectedTagIDs([])
    setUntagged(prev => !prev)
  }

  const clearFilters = () => {
    setSelectedTagIDs([])
    setUntagged(false)
    setKeyword('')
    setKeywordInput('')
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const grouped = {}
  const uncategorized = []
  allTags.forEach(tag => {
    if (tag.category_id) {
      if (!grouped[tag.category_id]) grouped[tag.category_id] = []
      grouped[tag.category_id].push(tag)
    } else {
      uncategorized.push(tag)
    }
  })

  const tagColor = (tag) => tag.color || tag.category_color || '#555'

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Filter panel */}
        <div className="search-filter-panel" style={{ width: 240, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{t('tag.tags')}</span>
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: '0.75rem' }} disabled={selectedTagIDs.length === 0 && !untagged && !keyword}>
              {t('common.reset')}
            </button>
          </div>

          {categories.map(cat => {
            const catTags = grouped[cat.id] || []
            if (catTags.length === 0) return null
            return (
              <div key={cat.id} className="search-filter-group">
                <div className="search-filter-group-title">
                  <span className="search-filter-tag-dot" style={{ backgroundColor: cat.color, display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
                  {cat.name}
                </div>
                <div>
                  {catTags.map(tag => (
                    <button
                      key={tag.id}
                      className={`search-filter-tag${selectedTagIDs.includes(tag.id) ? ' selected' : ''}`}
                      style={{ backgroundColor: tagColor(tag), color: '#fff' }}
                      onClick={e => toggleTag(tag.id, e)}
                    >
                      {tag.name}
                      {tagCounts[tag.id] > 0 && <span style={{ opacity: 0.7, marginLeft: 2, fontSize: '0.7rem' }}>{tagCounts[tag.id]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {uncategorized.length > 0 && (
            <div className="search-filter-group">
              <div className="search-filter-group-title">{t('tag.uncategorized')}</div>
              <div>
                {uncategorized.map(tag => (
                  <button
                    key={tag.id}
                    className={`search-filter-tag${selectedTagIDs.includes(tag.id) ? ' selected' : ''}`}
                    style={{ backgroundColor: tagColor(tag), color: '#fff' }}
                    onClick={e => toggleTag(tag.id, e)}
                  >
                    {tag.name}
                    {tagCounts[tag.id] > 0 && <span style={{ opacity: 0.7, marginLeft: 2, fontSize: '0.7rem' }}>{tagCounts[tag.id]}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="search-filter-group" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              className={`search-filter-tag${untagged ? ' selected' : ''}`}
              style={untagged ? { backgroundColor: '#888', color: '#fff' } : {}}
              onClick={toggleUntagged}
            >
              {t('tag.untagged')}
            </button>
          </div>

          {allTags.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>{t('tag.noTags')}</div>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 8 }}>
            <input
              className="form-input"
              placeholder={t('tag.searchByName')}
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setKeyword(keywordInput.trim()); setPage(1) } }}
              style={{ flex: 1, height: 30, fontSize: '0.85rem' }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`file-view-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => { setViewMode('list'); localStorage.setItem('viewMode:search', 'list') }}
                title={t('workspace.listView')}
              ><MdViewList /></button>
              <button
                className={`file-view-btn${viewMode === 'card' ? ' active' : ''}`}
                onClick={() => { setViewMode('card'); localStorage.setItem('viewMode:search', 'card') }}
                title={t('workspace.cardView')}
              ><MdViewModule /></button>
              <button
                className={`file-view-btn${viewMode === 'card-sm' ? ' active' : ''}`}
                onClick={() => { setViewMode('card-sm'); localStorage.setItem('viewMode:search', 'card-sm') }}
                title={t('workspace.smallCardView')}
              ><MdViewComfy /></button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                {selectedTagIDs.length > 0 ? t('tag.noResults') : t('tag.allFiles')}
              </div>
            ) : viewMode === 'list' ? (
              files.map(f => {
                const thumb = thumbnails[f.id]
                return (
                  <div
                    key={f.id}
                    className="search-result-item"
                    onClick={() => navigate('file', {
                      projectID: f.project_id,
                      projectName: f.project_name,
                      fileID: f.id,
                      fileName: f.name,
                    })}
                  >
                    <div style={{ width: 48, height: 36, borderRadius: 4, overflow: 'hidden', background: '#111', flexShrink: 0 }}>
                      {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div className="search-result-info">
                      <div className="search-result-name">{f.name}</div>
                      <div className="search-result-project">{f.project_name}</div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className={`file-tile-grid${viewMode === 'card-sm' ? ' file-tile-grid--sm' : ''}`}>
                {files.map(f => {
                  const thumb = thumbnails[f.id]
                  return (
                    <div
                      key={f.id}
                      className="file-tile"
                      onClick={() => navigate('file', {
                        projectID: f.project_id,
                        projectName: f.project_name,
                        fileID: f.id,
                        fileName: f.name,
                      })}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="file-tile-thumb">
                        {thumb ? (
                          <img src={thumb} alt="" />
                        ) : (
                          <span className="file-tile-thumb-placeholder">{f.name}</span>
                        )}
                      </div>
                      <div className="file-tile-info">
                        <div className="file-tile-name" title={f.name}>{f.name}</div>
                        <div className="search-result-project">{f.project_name}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); localStorage.setItem('pageSize:search', s) }}
              total={total}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchPage
