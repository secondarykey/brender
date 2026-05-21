import { Window } from '@wailsio/runtime'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import appIcon from './appicon.png'
import { QueueApi } from '../lib/api'
import ConfirmDialog from './ConfirmDialog'

function TitleBar() {
  const { t } = useTranslation()
  const [isMac, setIsMac] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      if (window._wails?.environment?.OS === 'darwin') setIsMac(true)
    }, 100)
    return () => clearTimeout(id)
  }, [])

  const handleClose = async () => {
    try {
      const queues = await QueueApi.list()
      if (queues && queues.length > 0) {
        setConfirmClose(true)
        return
      }
    } catch (_) {}
    Window.Close()
  }

  return (
    <>
      <div className={`titlebar${isMac ? ' mac' : ''}`}>
        <img src={appIcon} className="titlebar-icon" alt="Brender" />
        {!isMac && (
          <div className="titlebar-controls">
            <button className="titlebar-btn titlebar-btn-min"   onClick={() => Window.Minimise()}       title={t('title.minimum')}>&#8211;</button>
            <button className="titlebar-btn titlebar-btn-max"   onClick={() => Window.ToggleMaximise()} title={t('title.maximum')}>&#9744;</button>
            <button className="titlebar-btn titlebar-btn-close" onClick={handleClose}                   title={t('title.close')}>&#10005;</button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmClose}
        title={t('title.confirmClose')}
        onConfirm={async () => {
          try { await QueueApi.killRunning() } catch (_) {}
          Window.Close()
        }}
        onCancel={() => setConfirmClose(false)}
        confirmLabel={t('title.closeAnyway')}
        confirmClassName="btn btn-danger"
        hold
      >
        <p>{t('title.queueRunningWarning')}</p>
      </ConfirmDialog>
    </>
  )
}

export default TitleBar
