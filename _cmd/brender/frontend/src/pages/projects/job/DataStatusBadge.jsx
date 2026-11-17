import { useTranslation } from 'react-i18next'
import { isJobLocked } from './jobFiles'

function dataStatusClass(s) {
  if (s % 2 === 1) return 'data-status-locked'
  if (s === 0)     return 'data-status-none'
  if (s === 2)     return 'data-status-available'
  if (s === 4)     return 'data-status-deleted'
  if (s === 6)     return 'data-status-corrupted'
  if (s === 8)     return 'data-status-modified'
  return ''
}

// ジョブの出力データの状態のバッジ（ロック付きなら「ロック」のバッジも並べる）
export default function DataStatusBadge({ status }) {
  const { t } = useTranslation()
  const isLocked = isJobLocked(status)
  const base = isLocked ? status - 1 : status
  const labels = {
    0: t('dataStatus.none'),
    2: t('dataStatus.available'),
    4: t('dataStatus.deleted'),
    6: t('dataStatus.corrupted'),
    8: t('dataStatus.modified'),
  }
  return (
    <>
      <span className={`data-status-badge ${dataStatusClass(base)}`}>{labels[base] ?? String(status)}</span>
      {isLocked && <span className="data-status-badge data-status-locked">{t('common.locked')}</span>}
    </>
  )
}
