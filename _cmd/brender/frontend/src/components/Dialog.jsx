import { useEffect } from 'react'

// 共通ダイアログ。message を渡すとダイアログ上部にメッセージ領域を表示する。
// 個別のダイアログはこれを派生して作る。
export default function Dialog({
  open = true,
  title,
  onClose,
  closeOnBackdrop = true,
  message,
  messageSeverity = 'error',
  wide = false,
  className = '',
  bodyClassName = '',
  actions,
  children,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && closeOnBackdrop && onClose) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeOnBackdrop, onClose])

  if (!open) return null

  const handleBackdrop = () => {
    if (closeOnBackdrop && onClose) onClose()
  }

  return (
    <div className="dialog-overlay" onClick={handleBackdrop}>
      <div
        className={`dialog${wide ? ' dialog-wide' : ''}${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="dialog-title">{title}</h3>}
        {message && (
          <div className={`dialog-message dialog-message-${messageSeverity}`}>{message}</div>
        )}
        <div className={`dialog-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  )
}
