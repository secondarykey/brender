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
