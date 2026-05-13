import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EnvironmentApi } from '../../lib/api'

function VideoSettings() {
  const { t } = useTranslation()
  const [cmd,    setCmd]    = useState('')
  const [fps,    setFps]    = useState('')
  const [ext,    setExt]    = useState('')
  const [args,   setArgs]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    EnvironmentApi.get()
      .then(env => {
        if (!env) return
        setCmd(env.ffmpeg_cmd  || '')
        setFps(env.ffmpeg_fps  ? String(env.ffmpeg_fps) : '')
        setExt(env.ffmpeg_ext  || '')
        setArgs(env.ffmpeg_args || '')
      })
      .catch(err => setError(String(err)))
  }, [])

  const handleSave = async () => {
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      await EnvironmentApi.setFfmpeg({
        cmd,
        fps: fps ? parseInt(fps, 10) : 0,
        ext,
        args,
      })
      setSaved(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegCmd')}</label>
        <p className="setting-desc">{t('settings.ffmpegCmdHint')}</p>
        <input
          className="form-input"
          type="text"
          value={cmd}
          onChange={e => { setCmd(e.target.value); setSaved(false) }}
          placeholder="ffmpeg"
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegFPS')}</label>
        <p className="setting-desc">{t('settings.ffmpegFPSHint')}</p>
        <input
          className="form-input"
          type="number"
          min="1"
          style={{ width: 120 }}
          value={fps}
          onChange={e => { setFps(e.target.value); setSaved(false) }}
          placeholder="30"
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegExt')}</label>
        <p className="setting-desc">{t('settings.ffmpegExtHint')}</p>
        <input
          className="form-input"
          type="text"
          style={{ width: 160 }}
          value={ext}
          onChange={e => { setExt(e.target.value); setSaved(false) }}
          placeholder="png"
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegArgs')}</label>
        <p className="setting-desc">{t('settings.ffmpegArgsHint')}</p>
        <input
          className="form-input"
          type="text"
          value={args}
          onChange={e => { setArgs(e.target.value); setSaved(false) }}
          placeholder=""
        />
      </div>

      <div className="form-actions" style={{ marginTop: 24 }}>
        <div />
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">{t('common.saved')}</div>}
    </div>
  )
}

export default VideoSettings
