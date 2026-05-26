import { Window } from '@wailsio/runtime'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import appIcon from './appicon.png'
import { QueueApi, EnvironmentApi } from '../lib/api'
import ConfirmDialog from './ConfirmDialog'

function TitleBar() {
  const { t } = useTranslation()
  const [isMac, setIsMac] = useState(false)
  const [closeReason, setCloseReason] = useState(null)
  const [devVersion, setDevVersion] = useState('')

  useEffect(() => {
    const id = setTimeout(() => {
      if (window._wails?.environment?.OS === 'darwin') setIsMac(true)
    }, 100)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    EnvironmentApi.getVersion().then(v => {
      if (v.dev) setDevVersion(`${v.version}+DEV`)
    }).catch(() => {})
  }, [])

  const handleClose = async () => {
    const reasons = []
    try {
      const queues = await QueueApi.list()
      if (queues && queues.length > 0) reasons.push('queue')
    } catch (_) {}
    try {
      const env = await EnvironmentApi.get()
      if (env && env.server) reasons.push('server')
    } catch (_) {}
    if (reasons.length > 0) {
      setCloseReason(reasons)
      return
    }
    Window.Close()
  }

  const closeWarning = () => {
    if (!closeReason) return ''
    const msgs = []
    if (closeReason.includes('queue')) msgs.push(t('title.queueRunningWarning'))
    if (closeReason.includes('server')) msgs.push(t('title.serverRunningWarning'))
    return msgs.join('\n')
  }

  return (
    <>
      <div className={`titlebar${isMac ? ' mac' : ''}`}>
        <img src={appIcon} className="titlebar-icon" alt="Brender" />
        {devVersion && <span className="titlebar-dev-version">{devVersion}</span>}
        {!isMac && (
          <div className="titlebar-controls">
            <button className="titlebar-btn titlebar-btn-min"   onClick={() => Window.Minimise()}       title={t('title.minimum')}>&#8211;</button>
            <button className="titlebar-btn titlebar-btn-max"   onClick={() => Window.ToggleMaximise()} title={t('title.maximum')}>&#9744;</button>
            <button className="titlebar-btn titlebar-btn-close" onClick={handleClose}                   title={t('title.close')}>&#10005;</button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!closeReason}
        title={t('title.confirmClose')}
        onConfirm={async () => {
          try { await QueueApi.killRunning() } catch (_) {}
          Window.Close()
        }}
        onCancel={() => setCloseReason(null)}
        confirmLabel={t('title.closeAnyway')}
        confirmClassName="btn btn-danger"
        hold
      >
        <p style={{ whiteSpace: 'pre-line' }}>{closeWarning()}</p>
      </ConfirmDialog>
    </>
  )
}

export default TitleBar
