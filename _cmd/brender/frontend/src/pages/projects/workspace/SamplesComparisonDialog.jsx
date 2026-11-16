import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdPlayArrow } from 'react-icons/md'
import { QueueApi } from '../../../lib/api'
import { useMessage } from '../../../lib/toast'
import Dialog from '../../../components/Dialog'

const DEFAULT_SAMPLES = '2,4,8,16,32,64,128,256,512'

// サンプル数の比較の投入ダイアログ。1フレームを、指定したサンプル数ごとにレンダリングする。
// 入力は閉じても残す（続けて試すときに打ち直さないように）。
//   initialFrame … 開いたときのフレームの初期値（ワークスペースのフレーム範囲の中ほど）
//   onEnqueued   … 投入できたとき
export default function SamplesComparisonDialog({ open, onClose, projectID, workspaceID, initialFrame, onEnqueued }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [listText, setListText]   = useState(DEFAULT_SAMPLES)
  const [frame, setFrame]         = useState(initialFrame)
  const [enqueuing, setEnqueuing] = useState(false)

  const handleEnqueue = async () => {
    showError('')
    setEnqueuing(true)
    try {
      const counts = listText.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0)
      if (counts.length === 0) {
        showError(t('workspace.samplesListEmpty'))
        return
      }
      await QueueApi.samplesComparisonEnqueue({ projectID, workspaceID, sampleCounts: counts, frame })
      onClose()
      onEnqueued()
    } catch (err) {
      showError(String(err))
    } finally {
      setEnqueuing(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={t('workspace.samplesComparison')}
      onClose={onClose}
      closeOnBackdrop={!enqueuing}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-run" onClick={handleEnqueue} disabled={enqueuing}>
            {enqueuing ? t('common.enqueueing') : <><MdPlayArrow /> {t('common.run')}</>}
          </button>
        </>
      }
    >
      <div className="form-field">
        <label className="form-label">{t('workspace.samplesListLabel')}</label>
        <input
          className="form-input"
          style={{ width: '100%' }}
          value={listText}
          onChange={e => setListText(e.target.value)}
          placeholder={DEFAULT_SAMPLES}
        />
        <span className="form-hint">{t('workspace.samplesListHint')}</span>
      </div>
      <div className="form-field">
        <label className="form-label">{t('workspace.samplesFrame')}</label>
        <input
          className="form-input"
          style={{ width: 120 }}
          type="number"
          min={0}
          value={frame}
          onChange={e => setFrame(Number(e.target.value))}
        />
        <span className="form-hint">{t('workspace.samplesFrameHint')}</span>
      </div>
    </Dialog>
  )
}
