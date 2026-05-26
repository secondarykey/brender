import i18n from '../languages'

const LOCALE_MAP = {
  ja: 'ja-JP',
  en: 'en-US',
}

function getLocale() {
  return LOCALE_MAP[i18n.language] || i18n.language
}

export function formatDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(getLocale(), {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(getLocale(), {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

export function formatDateFull(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(getLocale(), {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

export function formatDuration(startedAt, completedAt, t) {
  if (!startedAt || !completedAt) return '—'
  const sec = Math.floor((new Date(completedAt) - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}${t('time.seconds')}`
  if (sec < 3600) return `${Math.floor(sec / 60)}${t('time.minutes')}${sec % 60}${t('time.seconds')}`
  return `${Math.floor(sec / 3600)}${t('time.hours')}${Math.floor((sec % 3600) / 60)}${t('time.minutes')}`
}
