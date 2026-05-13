import { Window } from '@wailsio/runtime'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

function LogTitleBar({ title, logLevel, logLevels, onLogLevelChange }) {
  const { t } = useTranslation()
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      if (window._wails?.environment?.OS === 'darwin') setIsMac(true)
    }, 100)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className={`titlebar log-titlebar${isMac ? ' mac' : ''}`}>
      <span className="log-titlebar-title">{title}</span>
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
      {!isMac && (
        <div className="titlebar-controls">
          <button className="titlebar-btn titlebar-btn-min"   onClick={() => Window.Minimise()}       title={t('title.minimum')}>&#8211;</button>
          <button className="titlebar-btn titlebar-btn-max"   onClick={() => Window.ToggleMaximise()} title={t('title.maximum')}>&#9744;</button>
          <button className="titlebar-btn titlebar-btn-close" onClick={() => Window.Close()}          title={t('title.close')}>&#10005;</button>
        </div>
      )}
    </div>
  )
}

export default LogTitleBar
