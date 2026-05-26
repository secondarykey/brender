import { useState, useCallback, useEffect } from 'react'

const THEME_KEY = 'brender-theme'

export function getThemePreference() {
  return localStorage.getItem(THEME_KEY) || 'system'
}

function resolveTheme(preference) {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(preference) {
  const resolved = resolveTheme(preference)
  if (resolved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function initTheme() {
  applyTheme(getThemePreference())
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system')
  })
}

export function useTheme() {
  const [preference, setPreference] = useState(() => getThemePreference())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => {
      if (getThemePreference() === 'system') setPreference('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const changeTheme = useCallback((value) => {
    localStorage.setItem(THEME_KEY, value)
    setPreference(value)
    applyTheme(value)
  }, [])

  return { preference, changeTheme }
}
