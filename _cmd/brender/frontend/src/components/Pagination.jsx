const PAGE_SIZE_OPTIONS = [5, 10, 20, 100]

function Pagination({ page, totalPages, onChange, pageSize, onPageSizeChange }) {
  const showSizer = pageSize != null && onPageSizeChange != null

  if (totalPages <= 1 && !showSizer) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      pages.push(i)
    }
  }
  const buttons = []
  let prev = null
  for (const p of pages) {
    if (prev !== null && p - prev > 1) {
      buttons.push(<span key={`el-${p}`} className="pagination-info">…</span>)
    }
    buttons.push(
      <button
        key={p}
        className={`pagination-btn${p === page ? ' active' : ''}`}
        onClick={() => onChange(p)}
        disabled={p === page}
      >{p}</button>
    )
    prev = p
  }

  return (
    <div className="pagination">
      {showSizer ? (
        <div className="pagination-sizer">
          <span className="pagination-info">表示件数</span>
          <select
            className="pagination-size-select"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      ) : <div />}

      {totalPages > 1 && (
        <div className="pagination-pages">
          <button className="pagination-btn" onClick={() => onChange(page - 1)} disabled={page <= 1}>‹</button>
          {buttons}
          <button className="pagination-btn" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>›</button>
          <span className="pagination-info">{page} / {totalPages} ページ</span>
        </div>
      )}
    </div>
  )
}

export default Pagination
