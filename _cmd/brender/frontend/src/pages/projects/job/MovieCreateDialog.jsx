import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dialog from '../../../components/Dialog'

// 連番画像から動画を作るときの設定（FPS・出力形式・ffmpeg に足す引数）。
// 開くたびに作り直し、初期値は呼ぶ側が決めて defaults に渡す。
//   defaults    … { fps, outext, extraArgs, videoFormats }
//   onCreate    … ({ fps, outext, extraArgs }) 「作成」を押したとき
export default function MovieCreateDialog({ defaults, onClose, onCreate }) {
  const { t } = useTranslation()
  const [fps, setFps]             = useState(defaults.fps)
  const [outext, setOutext]       = useState(defaults.outext)
  const [extraArgs, setExtraArgs] = useState(defaults.extraArgs)
  const videoFormats = defaults.videoFormats || []

  return (
    <Dialog
      open
      title={t('viewer.movieDialogTitle')}
      onClose={onClose}
      closeOnBackdrop={true}
      actions={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-green btn-sm" onClick={() => onCreate({ fps, outext, extraArgs })}>{t('viewer.createMovie')}</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 12, columnGap: 16, alignItems: 'center' }}>

        <span className="form-label" style={{ textAlign: 'right' }}>{t('viewer.movieDialogFps')}</span>
        <div>
          <input
            type="number" min={1} className="form-input"
            style={{ width: 80 }}
            value={fps}
            onChange={e => setFps(e.target.value)}
          />
        </div>

        <span className="form-label" style={{ textAlign: 'right' }}>{t('viewer.movieDialogOutputExt')}</span>
        <div>
          {videoFormats.length > 0 ? (
            <select
              className="form-select"
              style={{ width: 120 }}
              value={outext}
              onChange={e => setOutext(e.target.value)}
            >
              {videoFormats.map(f => (
                <option key={f.code} value={f.ext}>{f.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text" className="form-input"
              style={{ width: 100 }}
              value={outext}
              onChange={e => setOutext(e.target.value)}
              placeholder="mp4"
            />
          )}
        </div>

        <span className="form-label" style={{ textAlign: 'right' }}>{t('viewer.movieDialogExtraArgs')}</span>
        <input
          type="text" className="form-input"
          style={{ width: '100%', boxSizing: 'border-box' }}
          value={extraArgs}
          onChange={e => setExtraArgs(e.target.value)}
        />

      </div>
    </Dialog>
  )
}
