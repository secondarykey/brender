import { useTranslation } from 'react-i18next'

const SORT_OPTIONS = ['display_order', 'created_at', 'processed_at']

export default function SortSelect({ value, onChange }) {
  const { t } = useTranslation()
  return (
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
  )
}
