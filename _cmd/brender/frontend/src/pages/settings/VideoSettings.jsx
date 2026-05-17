import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { EnvironmentApi, CodesApi } from '../../lib/api'
import { useToast, useMessage } from '../../lib/toast'

function VideoSettings() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [cmd,    setCmd]    = useState('')
  const [fps,    setFps]    = useState('')
  const [outExt, setOutExt] = useState('')
  const [args,   setArgs]   = useState('')
  const [saving, setSaving] = useState(false)
  const [videoFormats, setVideoFormats] = useState([])

  useEffect(() => {
    EnvironmentApi.get()
      .then(env => {
        if (!env) return
        setCmd(env.ffmpeg_cmd        || '')
        setFps(env.ffmpeg_fps        ? String(env.ffmpeg_fps) : '')
        setOutExt(env.ffmpeg_out_ext || 'mp4')
        setArgs(env.ffmpeg_args      || '')
      })
      .catch(err => showError(String(err)))
    CodesApi.getVideoFormats().then(list => setVideoFormats(list || [])).catch(() => {})
  }, [])

  const handleSave = async () => {
    showError('')
    setSaving(true)
    try {
      await EnvironmentApi.setFfmpeg({
        cmd,
        fps: fps ? parseInt(fps, 10) : 0,
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="form-input"
            type="text"
            value={cmd}
            readOnly
            placeholder="ffmpeg"
            style={{ flex: 1, cursor: 'default' }}
          />
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              try {
                const path = await Dialogs.OpenFile({})
                if (path) setCmd(path)
              } catch (_) {}
            }}
          >
            {t('settings.selectFolder')}
          </button>
          {cmd && (
            <button className="btn btn-ghost btn-sm" onClick={() => setCmd('')}>
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegFPS')}</label>
        <p className="setting-desc">{t('settings.ffmpegFPSHint')}</p>
        <input
          className="form-input"
          type="number"
          min="1"
          style={{ width: 120, textAlign: 'right' }}
          value={fps}
          onChange={e => { setFps(e.target.value) }}
          placeholder="30"
        />
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegOutExt')}</label>
        <p className="setting-desc">{t('settings.ffmpegOutExtHint')}</p>
        {videoFormats.length > 0 ? (
          <select
            className="form-select"
            style={{ width: 160 }}
            value={outExt}
            onChange={e => setOutExt(e.target.value)}
          >
            {videoFormats.map(f => (
              <option key={f.code} value={f.ext}>{f.label}</option>
            ))}
          </select>
        ) : (
          <input
            className="form-input"
            type="text"
            style={{ width: 160 }}
            value={outExt}
            onChange={e => setOutExt(e.target.value)}
            placeholder="mp4"
          />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">{t('settings.ffmpegArgs')}</label>
        <p className="setting-desc">{t('settings.ffmpegArgsHint')}</p>
        <input
          className="form-input"
          type="text"
          style={{ width: '100%' }}
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
