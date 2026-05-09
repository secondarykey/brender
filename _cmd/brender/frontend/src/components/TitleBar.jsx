import { Window } from '@wailsio/runtime'
import { useState, useEffect } from 'react'
import appIcon from './appicon.png'

function TitleBar() {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      if (window._wails?.environment?.OS === 'darwin') setIsMac(true)
    }, 100)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className={`titlebar${isMac ? ' mac' : ''}`}>
      <img src={appIcon} className="titlebar-icon" alt="Brender" />
      {!isMac && (
        <div className="titlebar-controls">
          <button className="titlebar-btn titlebar-btn-min"   onClick={() => Window.Minimise()}       title="最小化">&#8211;</button>
          <button className="titlebar-btn titlebar-btn-max"   onClick={() => Window.ToggleMaximise()} title="最大化">&#9744;</button>
          <button className="titlebar-btn titlebar-btn-close" onClick={() => Window.Close()}          title="閉じる">&#10005;</button>
        </div>
      )}
    </div>
  )
}

export default TitleBar
