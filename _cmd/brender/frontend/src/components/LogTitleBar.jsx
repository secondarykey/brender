import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isWails } from '../lib/api/_client'

function LogTitleBar({ title, logLevel, logLevels, onLogLevelChange, onDownload }) {
  const { t } = useTranslation()
  const [isMac, setIsMac] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const wails = isWails()

  useEffect(() => {
    if (!wails) return
    const id = setTimeout(() => {
      if (window._wails?.environment?.OS === 'darwin') setIsMac(true)
    }, 100)
    return () => clearTimeout(id)
  }, [])

  const toggleAlwaysOnTop = async () => {
    if (!wails) return
    const { Window } = await import('@wailsio/runtime')
    const next = !alwaysOnTop
    Window.SetAlwaysOnTop(next).then(() => setAlwaysOnTop(next)).catch(() => {})
  }

  const handleMinimise = async () => {
    const { Window } = await import('@wailsio/runtime')
    Window.Minimise()
  }
  const handleMaximise = async () => {
    const { Window } = await import('@wailsio/runtime')
    Window.ToggleMaximise()
  }
  const handleClose = async () => {
    if (wails) {
      const { Window } = await import('@wailsio/runtime')
      Window.Close()
    } else {
      window.close()
    }
  }

  return (
    <div className={`titlebar log-titlebar${isMac ? ' mac' : ''}`}>
      <span className="log-titlebar-title">{title}</span>
      {onDownload && (
        <button
          className="log-download-btn"
          onClick={onDownload}
          title={t('title.download')}
        >
          &#8681;
        </button>
      )}
      {logLevels && logLevel && (
        <select
          className="log-level-select"
          value={logLevel}
          onChange={e => onLogLevelChange?.(e.target.value)}
          title={t('settings.logLevel')}
        >
          {logLevels.map(lv => (
            <option key={lv} value={lv}>{lv}</option>
          ))}
        </select>
      )}
      {wails && (
        <button
          className={`log-alwaysontop-btn${alwaysOnTop ? ' active' : ''}`}
          onClick={toggleAlwaysOnTop}
          title={t('title.alwaysOnTop')}
        >
          &#8679;
        </button>
      )}
      {!isMac && (
        <div className="titlebar-controls">
          {wails && (
            <>
              <button className="titlebar-btn titlebar-btn-min"   onClick={handleMinimise}  title={t('title.minimum')}>&#8211;</button>
              <button className="titlebar-btn titlebar-btn-max"   onClick={handleMaximise}  title={t('title.maximum')}>&#9744;</button>
            </>
          )}
          <button className="titlebar-btn titlebar-btn-close" onClick={handleClose} title={t('title.close')}>&#10005;</button>
        </div>
      )}
    </div>
  )
}

export default LogTitleBar
