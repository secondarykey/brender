import { useTranslation } from 'react-i18next'
import { MdPlayArrow } from 'react-icons/md'
import Dialog from './Dialog'

// 前回のレンダリングと比べる項目（どれも同じなら「同じ設定でもう一度」の警告を出す）
const COMPARED = ['scene', 'engine', 'start_frame', 'end_frame', 'frame_step', 'samples', 'resolution_x', 'resolution_y', 'camera', 'output_format']

// 前回の値。.blend が前回から変わっていないときだけ出す（変わっていれば同じ設定でも結果が違う）
function Prev({ show, cur, prevVal }) {
  const { t } = useTranslation()
  if (!show) return null
  const changed = String(cur) !== String(prevVal)
  return <span className={changed ? 'dialog-prev-changed' : 'dialog-prev'}>({t('render.previousValue')}: {prevVal || '-'})</span>
}

// レンダリングの確認ダイアログ。QueueApi.previewRender の結果を見せ、確認してから投入する。
// ワークスペースの設定（実行ボタン）と、ファイル画面の一覧の「▶」の両方から使う。
//   preview       … previewRender の結果。null なら閉じている
//   workspaceName … 渡すとワークスペース名の行を出す（一覧から実行したとき、どれを実行するか分かるように）
//   busy          … 投入中（ボタンを止め、背景のクリックで閉じない）
export default function RenderConfirmDialog({ preview, workspaceName, busy, onCancel, onConfirm }) {
  const { t } = useTranslation()
  const pv = preview
  const prev = pv?.previous
  // 判定はダイアログを開いた時点のサーバの値で行う（画面を開いたときに読んだ値は古いことがある）
  const fileNotModified = !!pv?.file_not_modified
  const allIdentical = !!prev && COMPARED.every(k => pv[k] === prev[k])
  const showPrev = fileNotModified && !!prev

  return (
    <Dialog
      open={!!pv}
      title={t('render.confirmTitle')}
      onClose={onCancel}
      closeOnBackdrop={!busy}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn btn-run" onClick={onConfirm} disabled={busy}>
            {busy ? t('common.enqueueing') : <><MdPlayArrow /> {t('common.run')}</>}
          </button>
        </>
      }
    >
      {pv && <>
        {fileNotModified && (
          <p className="dialog-message dialog-message-warn">{t('render.fileNotModifiedWarning')}</p>
        )}
        {fileNotModified && allIdentical && (
          <p className="dialog-message dialog-message-danger">{t('render.identicalRenderWarning')}</p>
        )}
        {workspaceName && <p><span className="dialog-label">{t('render.workspace')}</span>{workspaceName}</p>}
        <p>
          <span className="dialog-label">{t('render.engine')}</span>
          {pv.engine || <span style={{ opacity: 0.5 }}>{t('render.blendDefault')}</span>}
          <Prev show={showPrev} cur={pv.engine} prevVal={prev?.engine} />
        </p>
        {pv.samples > 0 && <p><span className="dialog-label">{t('render.samples')}</span>{pv.samples}<Prev show={showPrev} cur={pv.samples} prevVal={prev?.samples} /></p>}
        <p><span className="dialog-label">{t('render.scene')}</span>{pv.scene}<Prev show={showPrev} cur={pv.scene} prevVal={prev?.scene} /></p>
        {pv.camera && <p><span className="dialog-label">{t('render.camera')}</span>{pv.camera}<Prev show={showPrev} cur={pv.camera} prevVal={prev?.camera} /></p>}
        {(pv.resolution_x > 0 || pv.resolution_y > 0) && (
          <p><span className="dialog-label">{t('render.resolution')}</span>{pv.resolution_x} × {pv.resolution_y}
            {showPrev && <Prev show cur={`${pv.resolution_x}×${pv.resolution_y}`} prevVal={`${prev.resolution_x}×${prev.resolution_y}`} />}
          </p>
        )}
        <p><span className="dialog-label">{t('render.frames')}</span>{pv.start_frame} – {pv.end_frame}
          {showPrev && <Prev show cur={`${pv.start_frame}-${pv.end_frame}`} prevVal={`${prev.start_frame}-${prev.end_frame}`} />}
        </p>
        {pv.frame_step > 1 && <p><span className="dialog-label">{t('render.step')}</span>{pv.frame_step}<Prev show={showPrev} cur={pv.frame_step} prevVal={prev?.frame_step} /></p>}
        {pv.output_format && <p><span className="dialog-label">{t('render.outputFormat')}</span>{pv.output_format}<Prev show={showPrev} cur={pv.output_format} prevVal={prev?.output_format} /></p>}
      </>}
    </Dialog>
  )
}
