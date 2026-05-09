function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

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
      <button className="pagination-btn" onClick={() => onChange(page - 1)} disabled={page <= 1}>‹</button>
      {buttons}
      <button className="pagination-btn" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>›</button>
      <span className="pagination-info">{page} / {totalPages} ページ</span>
    </div>
  )
}

export default Pagination
