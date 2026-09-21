import { useTranslation } from 'react-i18next'
import Dialog from './Dialog'
import HoldButton from './HoldButton'

// 削除などの確認ダイアログ。Dialog を派生したもの。
// 既定は赤い確定ボタン（削除）。busy 中はボタン無効化＋背景クローズ無効。
// confirmDisabled は確定ボタンのみを無効化する（キャンセルは残す）。
// hold=true にすると確定ボタンが長押し式になる。
export default function ConfirmDialog({
  open = true,
  title,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  confirmClassName = 'btn btn-danger',
  busy = false,
  confirmDisabled = false,
  hold = false,
  message,
  messageSeverity = 'error',
  children,
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      closeOnBackdrop={!busy}
      message={message}
      messageSeverity={messageSeverity}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          {hold ? (
            <HoldButton
              className={confirmClassName}
              onClick={onConfirm}
              disabled={busy || confirmDisabled}
              helpText={t('common.holdToConfirm')}
            >
              {confirmLabel ?? t('common.delete')}
            </HoldButton>
          ) : (
            <button className={confirmClassName} onClick={onConfirm} disabled={busy || confirmDisabled}>
              {confirmLabel ?? t('common.delete')}
            </button>
          )}
        </>
      }
    >
      {children}
    </Dialog>
  )
}
