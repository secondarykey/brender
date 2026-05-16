import { useState, useRef, useEffect } from 'react'

// 長押しで発火するボタン。押している間 conic-gradient でプログレスリングを表示する。
// className にプロジェクトのボタンクラス（"btn btn-danger" 等）を渡す。
export default function HoldButton({
  children,
  onClick,
  ms = 1500,
  className = 'btn btn-danger',
  progressColor = 'rgba(255,255,255,0.75)',
  borderRadius = '4px',
  disabled = false,
  helpText = '',
}) {
  const [isHolding, setIsHolding]   = useState(false)
  const [progress, setProgress]     = useState(0)
  const [showHelp, setShowHelp]     = useState(false)
  const timerRef    = useRef(null)
  const intervalRef = useRef(null)
  const helpTimerRef = useRef(null)

  const startHolding = () => {
    if (disabled) return
    setShowHelp(false)
    clearTimeout(helpTimerRef.current)
    setIsHolding(true)
    setProgress(0)
    const startTime = Date.now()
    intervalRef.current = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - startTime) / ms) * 100))
    }, 10)
    timerRef.current = setTimeout(() => {
      onClick()
      reset()
    }, ms)
  }

  const reset = () => {
    setIsHolding(false)
    setProgress(0)
    clearTimeout(timerRef.current)
    clearInterval(intervalRef.current)
    timerRef.current = null
    intervalRef.current = null
  }

  const cancelHolding = () => {
    if (!isHolding) return
    reset()
    if (helpText) {
      setShowHelp(true)
      helpTimerRef.current = setTimeout(() => setShowHelp(false), 2000)
    }
  }

  useEffect(() => () => {
    clearTimeout(timerRef.current)
    clearInterval(intervalRef.current)
    clearTimeout(helpTimerRef.current)
  }, [])

  useEffect(() => {
    if (disabled && isHolding) reset()
  }, [disabled])

  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: helpText ? 20 : 0,
    }}>
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 3,
          borderRadius,
          background: isHolding
            ? `conic-gradient(${progressColor} ${progress}%, transparent ${progress}%)`
            : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseDown={e => { e.preventDefault(); startHolding() }}
        onMouseUp={cancelHolding}
        onMouseLeave={cancelHolding}
        onTouchStart={e => { e.preventDefault(); startHolding() }}
        onTouchEnd={cancelHolding}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <div className={className} style={{ pointerEvents: 'none' }}>
          {children}
        </div>
      </div>
      {helpText && (
        <div style={{
          position: 'absolute',
          bottom: -20,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: showHelp ? 1 : 0,
          transition: 'opacity 0.3s',
        }}>
          {helpText}
        </div>
      )}
    </div>
  )
}
