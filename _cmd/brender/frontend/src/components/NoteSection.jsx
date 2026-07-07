import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdArrowDropDown, MdArrowRight } from 'react-icons/md'

function NoteSection({ value, onChange, style, disabled }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(!!value)

  return (
    <div className="note-section" style={style}>
      <button className="note-toggle" onClick={() => setOpen(v => !v)} type="button">
        <span className="note-toggle-arrow">{open ? <MdArrowDropDown /> : <MdArrowRight />}</span>
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
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}

export default NoteSection
