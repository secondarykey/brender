import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isWails } from '../lib/api/_client'

function MovieTitleBar({ title, showInfo, onToggleInfo }) {
  const { t } = useTranslation()
  const [isMac, setIsMac] = useState(false)
  const wails = isWails()

  useEffect(() => {
    if (!wails) return
    const id = setTimeout(() => {
      if (window._wails?.environment?.OS === 'darwin') setIsMac(true)
    }, 100)
    return () => clearTimeout(id)
  }, [])

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
      <button
        className={`titlebar-btn movie-info-toggle${showInfo ? ' active' : ''}`}
        onClick={onToggleInfo}
        title="情報を表示/非表示"
      >ⓘ</button>
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

export default MovieTitleBar
