import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  // 成功・完了メッセージ（下部トースト、2秒で自動消去）
  const [toast, setToast] = useState(null)
  // エラーメッセージ（画面上部、クリアまたは置換まで残る）
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  const showToast = useCallback((message) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(message)
    timerRef.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const showError = useCallback((message) => {
    setError(message ? String(message) : '')
  }, [])

  const clearError = useCallback(() => setError(''), [])

  return (
    <ToastContext.Provider value={{ showToast, toast, showError, error, clearError }}>
      {children}
    </ToastContext.Provider>
  )
}

// 成功・完了トースト用
export function useToast() {
  return useContext(ToastContext)
}

// グローバルエラーメッセージ用
export function useMessage() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { showError: () => {}, clearError: () => {}, error: '' }
  return { showError: ctx.showError, clearError: ctx.clearError, error: ctx.error }
}
