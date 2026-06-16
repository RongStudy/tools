import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ToastContext, type ToastType } from './toastContext'
import './Toast.css'

/** Toast 项 */
interface ToastItem {
  id: number
  message: string
  type: ToastType
}

/** 全局自增 ID */
let toastId = 0

/**
 * Toast Provider 组件
 * 包裹在应用顶层，提供 toast 通知功能
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <ToastMessage
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * 单个 Toast 消息组件
 */
function ToastMessage({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000)
    return () => clearTimeout(timer)
  }, [onClose])

  const iconMap: Record<ToastType, string> = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
  }

  return (
    <div className={`toast toast-${toast.type}`} onClick={onClose}>
      <span className="toast-icon">{iconMap[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
    </div>
  )
}
