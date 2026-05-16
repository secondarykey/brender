import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EnvironmentApi } from '../../lib/api'
import { useToast, useMessage } from '../../lib/toast'

function VideoSettings() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [cmd,    setCmd]    = useState('')
  const [fps,    setFps]    = useState('')
  const [ext,    setExt]    = useState('')
  const [outExt, setOutExt] = useState('')
  const [args,   setArgs]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    EnvironmentApi.get()
      .then(env => {
        if (!env) return
        setCmd(env.ffmpeg_cmd     || '')
        setFps(env.ffmpeg_fps     ? String(env.ffmpeg_fps) : '')
        setExt(env.ffmpeg_ext     || '')
        setOutExt(env.ffmpeg_out_ext || '')
        setArgs(env.ffmpeg_args   || '')
      })
      .catch(err => showError(String(err)))
  }, [])

  const handleSave = async () => {
    showError('')
    setSaving(true)
    try {
      await EnvironmentApi.setFfmpeg({
        cmd,
        fps: fps ? parseInt(fps, 10) : 0,
        ext,
        outExt,
        args,
      })
      showToast(t('common.saved'))
    } catch (err) {
      showError(String(err))
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
          onChange={e => { setCmd(e.target.value) }}
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
          onChange={e => { setFps(e.target.value) }}
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
          onChange={e => { setExt(e.target.value) }}
          placeholder="png"
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegOutExt')}</label>
        <p className="setting-desc">{t('settings.ffmpegOutExtHint')}</p>
        <input
          className="form-input"
          type="text"
          style={{ width: 160 }}
          value={outExt}
          onChange={e => { setOutExt(e.target.value) }}
          placeholder="mp4"
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegArgs')}</label>
        <p className="setting-desc">{t('settings.ffmpegArgsHint')}</p>
        <input
          className="form-input"
          type="text"
          value={args}
          onChange={e => { setArgs(e.target.value) }}
          placeholder=""
        />
      </div>

      <div className="form-actions" style={{ marginTop: 24 }}>
        <div />
        <button className="btn btn-green" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  )
}

export default VideoSettings
