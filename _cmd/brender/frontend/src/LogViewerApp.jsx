import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, EnvironmentApi } from './lib/api'
import LogTitleBar from './components/LogTitleBar'

const TAIL_INTERVAL = 1000
const LEVEL_RE = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} \[([A-Z]+)\s*\]/

function detectLevel(line) {
  const m = line.match(LEVEL_RE)
  return m ? m[1] : null
}

function highlightLine(line, query) {
  const q = query.toLowerCase()
  const result = []
  let remaining = line
  let key = 0
  while (remaining) {
    const idx = remaining.toLowerCase().indexOf(q)
    if (idx === -1) { result.push(remaining); break }
    if (idx > 0) result.push(remaining.slice(0, idx))
    result.push(<mark key={key++}>{remaining.slice(idx, idx + q.length)}</mark>)
    remaining = remaining.slice(idx + q.length)
  }
  return result
}

function LogViewerApp() {
  const { t } = useTranslation()
  const params   = new URLSearchParams(window.location.search)
  const jobID    = params.get('log') || ''
  const isSysLog = params.has('syslog')
  const title    = isSysLog ? 'system.log' : 'render.log'

  const [log, setLog]         = useState(null)
  const [error, setError]     = useState('')
  const [tail, setTail]       = useState(false)
  const [wrap, setWrap]       = useState(false)
  const [logLevel, setLogLevel]   = useState(null)
  const [logLevels, setLogLevels] = useState(null)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIndex, setMatchIndex]   = useState(0)
  const [filterLevel, setFilterLevel] = useState(null)

  const preRef         = useRef(null)
  const searchInputRef = useRef(null)
  const lineRefs       = useRef([])

  const fetchLog = useCallback(() => {
    const req = isSysLog
      ? EnvironmentApi.getSystemLog()
      : (jobID ? QueueApi.getJobLog({ id: jobID }) : Promise.resolve(''))
    req
      .then(text => setLog(text ?? ''))
      .catch(err => setError(String(err)))
  }, [isSysLog, jobID])

  useEffect(() => { fetchLog() }, [fetchLog])

  useEffect(() => {
    if (!isSysLog) return
    Promise.all([
      EnvironmentApi.getLogLevel(),
      EnvironmentApi.getLogLevels(),
    ]).then(([lv, lvs]) => {
      setLogLevel(lv)
      setLogLevels(lvs)
    }).catch(() => {})
  }, [isSysLog])

  const handleLogLevelChange = (level) => {
    EnvironmentApi.setLogLevel({ level })
      .then(() => setLogLevel(level))
      .catch(() => {})
  }

  const logLines = useMemo(() => (log ? log.split('\n') : []), [log])

  // フィルタ用レベルリスト: タイトルバーのレベル設定とは独立（EMERGENCY を末尾に追加）
  const filterLevels = useMemo(
    () => logLevels ? [...logLevels, 'EMERGENCY'] : null,
    [logLevels]
  )

  // フィルタ: filterLevel 以上のレベルを持つ行のインデックス集合 (null = 全表示)
  const filteredSet = useMemo(() => {
    if (!filterLevel || !filterLevels) return null
    const minIdx = filterLevels.indexOf(filterLevel)
    if (minIdx === -1) return null
    const set = new Set()
    logLines.forEach((line, i) => {
      const level = detectLevel(line)
      if (!level) return
      const idx = filterLevels.indexOf(level)
      if (idx >= minIdx) set.add(i)
    })
    return set
  }, [logLines, filterLevel, filterLevels])

  const handleDownload = () => {
    if (!log) return
    const now = new Date()
    const ts = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0') + '-'
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0')
    const filename = isSysLog ? `brender-${ts}.log` : `brender-rendering-${ts}.log`
    const content = filteredSet
      ? logLines.filter((_, i) => filteredSet.has(i)).join('\n')
      : log
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!tail) return
    const id = setInterval(fetchLog, TAIL_INTERVAL)
    return () => clearInterval(id)
  }, [tail, fetchLog])

  useEffect(() => {
    if (tail && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [log, tail])

  // Ctrl+F でサーチを開閉する
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(v => {
          if (v) { setSearchQuery(''); setFilterLevel(null) }
          return !v
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // サーチを開いたらインプットにフォーカス
  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [searchOpen])

  // Escape でサーチを閉じる
  useEffect(() => {
    if (!searchOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
        setFilterLevel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  const matchLines = useMemo(() => {
    if (!searchQuery) return []
    const q = searchQuery.toLowerCase()
    return logLines.reduce((acc, line, i) => {
      if (filteredSet && !filteredSet.has(i)) return acc
      if (line.toLowerCase().includes(q)) acc.push(i)
      return acc
    }, [])
  }, [logLines, searchQuery, filteredSet])

  const matchSet = useMemo(() => new Set(matchLines), [matchLines])

  useEffect(() => { setMatchIndex(0) }, [searchQuery, filterLevel])

  useEffect(() => {
    if (!matchLines.length) return
    const el = lineRefs.current[matchLines[matchIndex]]
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [matchIndex, matchLines])

  const goNext = () => {
    if (!matchLines.length) return
    setMatchIndex(i => (i + 1) % matchLines.length)
  }
  const goPrev = () => {
    if (!matchLines.length) return
    setMatchIndex(i => (i - 1 + matchLines.length) % matchLines.length)
  }

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) goPrev(); else goNext()
    }
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    setFilterLevel(null)
  }

  return (
    <div className="log-viewer-root">
      <LogTitleBar
        title={title}
        logLevel={logLevel}
        logLevels={logLevels}
        onLogLevelChange={handleLogLevelChange}
        onDownload={log ? handleDownload : null}
      />
      {error && <div className="error-msg" style={{ margin: 12 }}>{error}</div>}
      {log === null && !error && (
        <p className="log-viewer-status">{t('common.loading')}</p>
      )}
      {log !== null && log === '' && !error && (
        <p className="log-viewer-status">{t('job.noLog')}</p>
      )}
      {log && (
        <pre ref={preRef} className={`log-viewer-pre${wrap ? '' : ' no-wrap'}`}>
          {logLines.map((line, i) => {
            if (filteredSet && !filteredSet.has(i)) return null
            const isMatch = searchQuery !== '' && matchSet.has(i)
            const isCurrent = isMatch && matchLines[matchIndex] === i
            return (
              <span
                key={i}
                ref={el => { lineRefs.current[i] = el }}
                className={isCurrent ? 'log-line-current' : isMatch ? 'log-line-match' : undefined}
              >
                {isMatch ? highlightLine(line, searchQuery) : line}
                {'\n'}
              </span>
            )
          })}
        </pre>
      )}
      {searchOpen && (
        <div className="log-search-box">
          {filterLevels && (
            <select
              className="log-search-level"
              value={filterLevel ?? ''}
              onChange={e => setFilterLevel(e.target.value || null)}
            >
              <option value="">{t('job.allLevels')}</option>
              {filterLevels.map(lv => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          )}
          <input
            ref={searchInputRef}
            className={`log-search-input${searchQuery && !matchLines.length ? ' no-match' : ''}`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder={t('job.searchPlaceholder')}
          />
          {searchQuery && (
            <span className="log-search-counter">
              {matchLines.length > 0 ? `${matchIndex + 1}/${matchLines.length}` : '0/0'}
            </span>
          )}
          <button className="log-search-nav" onClick={goPrev} disabled={!matchLines.length} title={t('job.searchPrev')}>&#8593;</button>
          <button className="log-search-nav" onClick={goNext} disabled={!matchLines.length} title={t('job.searchNext')}>&#8595;</button>
          <button className="log-search-close" onClick={closeSearch}>&#10005;</button>
        </div>
      )}
      <button
        className={`log-wrap-btn${wrap ? ' active' : ''}`}
        onClick={() => setWrap(v => !v)}
        title={t('job.wrap')}
      >
        ⇌
      </button>
      <button
        className={`log-tail-btn${tail ? ' active' : ''}`}
        onClick={() => setTail(v => !v)}
        title={t('job.tail')}
      >
        ↓
      </button>
    </div>
  )
}

export default LogViewerApp
