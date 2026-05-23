import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TagApi } from '../lib/api'

function tagColor(tag) {
  return tag.color || tag.category_color || '#555'
}

function tagLabel(tag) {
  if (tag.category_name) return `${tag.category_name}:${tag.name}`
  return tag.name
}

function TagInput({ projectFileID, tags, onTagsChanged }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [allTags, setAllTags] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    console.log('[TagInput] mount/tags changed, fetching allTags. projectFileID=', projectFileID)
    TagApi.listTags()
      .then(list => { console.log('[TagInput] listTags result:', list); setAllTags(list || []) })
      .catch(e => console.error('[TagInput] listTags error:', e))
  }, [tags])

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const q = input.toLowerCase()
    const currentIDs = new Set((tags || []).map(t => t.id))
    const filtered = allTags
      .filter(t => !currentIDs.has(t.id))
      .filter(t => {
        const label = tagLabel(t).toLowerCase()
        return label.includes(q)
      })
      .slice(0, 10)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setActiveIdx(-1)
  }, [input, allTags, tags])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const assignTag = async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    console.log('[TagInput] assignTag called:', trimmed, 'fileID=', projectFileID)
    try {
      const result = await TagApi.assignTagByInput({ projectFileID, input: trimmed })
      console.log('[TagInput] assignTagByInput result:', result)
      setInput('')
      setShowSuggestions(false)
      if (onTagsChanged) {
        const current = tags || []
        if (!current.some(t => t.id === result.id)) {
          onTagsChanged([...current, result])
        }
      }
    } catch (e) {
      console.error('[TagInput] assignTag error:', e)
    }
  }

  const removeTag = async (tagID) => {
    try {
      await TagApi.removeTagFromFile({ projectFileID, tagID })
      if (onTagsChanged) {
        onTagsChanged((tags || []).filter(t => t.id !== tagID))
      }
    } catch (e) {
      console.error('TagInput remove error:', e)
    }
  }

  const handleKeyDown = (e) => {
    console.log('[TagInput] keyDown:', e.key, 'input=', input, 'activeIdx=', activeIdx)
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        assignTag(tagLabel(suggestions[activeIdx]))
      } else if (input.trim()) {
        assignTag(input)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === 'Backspace' && !input && tags && tags.length > 0) {
      removeTag(tags[tags.length - 1].id)
    }
  }

  return (
    <div className="tag-input-container" ref={containerRef}>
      {(tags || []).map(tag => (
        <span key={tag.id} className="tag-chip" style={{ backgroundColor: tagColor(tag) }}>
          <span className="tag-chip-label">{tagLabel(tag)}</span>
          <button className="tag-chip-remove" onClick={() => removeTag(tag.id)}>×</button>
        </span>
      ))}
      <div className="tag-input-wrapper">
        <input
          ref={inputRef}
          className="tag-input-field"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
          placeholder={(!tags || tags.length === 0) ? t('tag.addTag') : ''}
        />
        {showSuggestions && (
          <div className="tag-autocomplete">
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                className={`tag-autocomplete-item${i === activeIdx ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); assignTag(tagLabel(s)) }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="tag-autocomplete-chip" style={{ backgroundColor: tagColor(s) }} />
                <span>{tagLabel(s)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TagInput
