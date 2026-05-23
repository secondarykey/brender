import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { TagApi, ProjectApi } from '../../lib/api'
import { useMessage } from '../../lib/toast'
import Pagination from '../../components/Pagination'

function SearchPage({ navigate }) {
  const { t } = useTranslation()
  const { showError } = useMessage()

  const [allTags, setAllTags] = useState([])
  const [categories, setCategories] = useState([])
  const [tagCounts, setTagCounts] = useState({})
  const [selectedTagIDs, setSelectedTagIDs] = useState([])

  const [files, setFiles] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [thumbnails, setThumbnails] = useState({})

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
    TagApi.searchFiles({ tagIDs: selectedTagIDs, page, pageSize })
      .then(res => {
        setFiles(res?.files || [])
        setTotal(res?.total || 0)
      })
      .catch(e => showError(String(e)))
  }, [selectedTagIDs, page, pageSize])

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

  const toggleTag = (tagID) => {
    setPage(1)
    setSelectedTagIDs(prev =>
      prev.includes(tagID) ? prev.filter(id => id !== tagID) : [...prev, tagID]
    )
  }

  const clearFilters = () => {
    setSelectedTagIDs([])
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
            {selectedTagIDs.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: '0.75rem' }}>
                {t('common.reload')}
              </button>
            )}
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
                      style={selectedTagIDs.includes(tag.id) ? { backgroundColor: tagColor(tag), color: '#fff' } : {}}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span className="search-filter-tag-dot" style={{ backgroundColor: tagColor(tag) }} />
                      {tag.name}
                      {tagCounts[tag.id] > 0 && <span style={{ opacity: 0.6, marginLeft: 2, fontSize: '0.7rem' }}>{tagCounts[tag.id]}</span>}
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
                    style={selectedTagIDs.includes(tag.id) ? { backgroundColor: tagColor(tag), color: '#fff' } : {}}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <span className="search-filter-tag-dot" style={{ backgroundColor: tagColor(tag) }} />
                    {tag.name}
                    {tagCounts[tag.id] > 0 && <span style={{ opacity: 0.6, marginLeft: 2, fontSize: '0.7rem' }}>{tagCounts[tag.id]}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allTags.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>{t('tag.noTags')}</div>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                {selectedTagIDs.length > 0 ? t('tag.noResults') : t('tag.allFiles')}
              </div>
            ) : (
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
            )}
          </div>

          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
              total={total}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchPage
