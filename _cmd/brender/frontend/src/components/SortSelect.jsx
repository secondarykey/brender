import { useTranslation } from 'react-i18next'

const SORT_OPTIONS = ['display_order', 'name', 'created_at', 'processed_at']

export default function SortSelect({ value, onChange, dir = 'asc', onDirChange }) {
  const { t } = useTranslation()
  return (
    <>
      <select
        className="sort-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        title={t('sort.label')}
      >
        {SORT_OPTIONS.map(key => (
          <option key={key} value={key}>{t(`sort.${key}`)}</option>
        ))}
      </select>
      {onDirChange && (
        <button
          className="file-view-btn"
          onClick={() => onDirChange(dir === 'asc' ? 'desc' : 'asc')}
          title={t(dir === 'asc' ? 'sort.asc' : 'sort.desc')}
        >
          {dir === 'asc' ? '↑' : '↓'}
        </button>
      )}
    </>
  )
}
