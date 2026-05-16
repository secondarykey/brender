import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function NoteSection({ value, onChange }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(!!value)

  return (
    <div className="note-section">
      <button className="note-toggle" onClick={() => setOpen(v => !v)} type="button">
        <span className={`note-toggle-arrow${open ? ' open' : ''}`}>▶</span>
        {t('common.note')}
        {!open && value && <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: 6 }}>…</span>}
      </button>
      {open && (
        <div className="note-body">
          <textarea
            className="form-input"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={t('common.notePlaceholder')}
          />
        </div>
      )}
    </div>
  )
}

export default NoteSection
