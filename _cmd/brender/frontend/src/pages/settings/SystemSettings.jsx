import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EnvironmentApi } from '../../lib/api'

function SystemSettings() {
  const { t } = useTranslation()
  const [version, setVersion] = useState('')
  const [licenses, setLicenses] = useState(null)

  useEffect(() => {
    EnvironmentApi.getVersion().then(v => {
      const label = v.dev ? `${v.version}+DEV` : v.version
      setVersion(label)
    }).catch(() => {})
    EnvironmentApi.getLicenses().then(setLicenses).catch(() => {})
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Brender {version}</h2>
        <button className="btn btn-sm" onClick={() => EnvironmentApi.openSystemLogWindow()}>
          {t('settings.openSystemLog')}
        </button>
      </div>

      {licenses && (
        <>
          <h3 className="section-title" style={{ marginTop: 24, fontSize: '0.9rem' }}>
            {t('system.license')}
          </h3>
          <pre className="license-text">{licenses.app}</pre>

          <h3 className="section-title" style={{ marginTop: 24, fontSize: '0.9rem' }}>
            {t('system.thirdPartyLicenses')}
          </h3>
          <pre className="license-text">{licenses.thirdParty}</pre>
        </>
      )}
    </div>
  )
}

export default SystemSettings
