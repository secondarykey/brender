import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { EnvironmentApi } from '../../lib/api'

function EnvironmentSettings() {
  const { t } = useTranslation()
  const [root, setRoot]       = useState('')
  const [workDir, setWorkDir] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    EnvironmentApi.get()
      .then(env => { if (env) setRoot(env.root || '') })
      .catch(err => setError(String(err)))
    EnvironmentApi.getWorkDir()
      .then(d => setWorkDir(d || ''))
      .catch(() => {})
  }, [])

  const handleSelectDir = async () => {
    setError('')
    setSaved(false)
    try {
      const defaultDir = root || workDir || undefined
      const dir = await Dialogs.OpenFile({
        CanChooseDirectories: true,
        CanChooseFiles: false,
        DefaultDirectory: defaultDir,
      })
      if (!dir) return
      setSaving(true)
      await EnvironmentApi.setRoot({ root: dir })
      setRoot(dir)
      setSaved(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="section-title">{t('settings.workingDir')}</h2>
      <p className="setting-desc">{t('settings.workingDirHint')}</p>

      <div className="setting-row">
        <span className="setting-path">{root || t('common.notSetPlaceholder')}</span>
        <button className="btn" onClick={handleSelectDir} disabled={saving}>
          {saving ? t('common.saving') : t('settings.selectFolder')}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">{t('common.saved')}</div>}
    </div>
  )
}

export default EnvironmentSettings
