import { useTranslation } from 'react-i18next'
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md'

const DEFAULT_OPTIONS = ['display_order', 'name', 'created_at', 'processed_at']

export default function SortSelect({ value, onChange, dir = 'asc', onDirChange, options }) {
  const { t } = useTranslation()
  const opts = options || DEFAULT_OPTIONS
  return (
    <>
      <select
        className="sort-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        title={t('sort.label')}
      >
        {opts.map(key => (
          <option key={key} value={key}>{t(`sort.${key}`)}</option>
        ))}
      </select>
      {onDirChange && (
        <button
          className="file-view-btn"
          onClick={() => onDirChange(dir === 'asc' ? 'desc' : 'asc')}
          title={t(dir === 'asc' ? 'sort.asc' : 'sort.desc')}
        >
          {dir === 'asc' ? <MdArrowUpward /> : <MdArrowDownward />}
        </button>
      )}
    </>
  )
}
