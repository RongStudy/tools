import { useEffect, useRef } from 'react'
import { useToast } from '../components/toastContext'
import { writeExpiringStorage } from '../utils/expiringStorage'

/** Delay serialization until editing pauses; flush the latest committed draft on exit. */
export const useDraftPersistence = <T,>(key: string, value: T) => {
  const { showToast } = useToast()
  const current = useRef({ value, showToast })
  const dirty = useRef(false)
  const failed = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const flush = useRef(() => {})

  useEffect(() => {
    current.current = { value, showToast }
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush.current(), 600)
  }, [value, showToast])

  useEffect(() => {
    flush.current = () => {
      clearTimeout(timer.current)
      if (!dirty.current) return
      const saved = writeExpiringStorage(key, current.current.value)
      dirty.current = !saved
      if (!saved && !failed.current) {
        current.current.showToast('草稿保存失败，请导出文件或复制内容备份', 'error')
      }
      failed.current = !saved
    }
    const onHidden = () => { if (document.visibilityState === 'hidden') flush.current() }
    window.addEventListener('pagehide', flush.current)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush.current)
      document.removeEventListener('visibilitychange', onHidden)
      flush.current()
    }
  }, [key])
}
