import { t } from '../i18n'
import { useCallback, useEffect, useRef } from 'react'
import { useToast } from '../components/toastContext'
import { DRAFT_AUTOSAVE_DISABLED_EVENT, DRAFT_SETTINGS_KEY, getDraftSettings, removeExpiringStorage, writeExpiringStorage } from '../utils/expiringStorage'

/** Delay serialization until editing pauses; flush the latest committed draft on exit. */
export const useDraftPersistence = <T,>(key: string, value: T, revision: unknown = value) => {
  const { showToast } = useToast()
  const current = useRef({ value, showToast, revision })
  const dirty = useRef(false)
  const failed = useRef(false)
  const cleared = useRef<{ revision: unknown }>()
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const flush = useRef(() => {})
  const cancelSave = useCallback(() => {
    clearTimeout(timer.current)
    dirty.current = false
    failed.current = false
    cleared.current = { revision: current.current.revision }
  }, [])

  useEffect(() => {
    current.current = { value, showToast, revision }
    clearTimeout(timer.current)
    if (!getDraftSettings().enabled || (cleared.current && Object.is(cleared.current.revision, revision))) {
      cancelSave()
      return
    }
    cleared.current = undefined
    dirty.current = true
    timer.current = setTimeout(() => flush.current(), 600)
  }, [key, value, showToast, revision, cancelSave])

  useEffect(() => {
    flush.current = () => {
      clearTimeout(timer.current)
      if (!dirty.current) return
      if (!getDraftSettings().enabled) {
        cancelSave()
        return
      }
      const saved = writeExpiringStorage(key, current.current.value)
      dirty.current = !saved
      if (!saved && !failed.current) {
        current.current.showToast(t("草稿保存失败，请导出文件或复制内容备份"), 'error')
      }
      failed.current = !saved
    }
    const onHidden = () => { if (document.visibilityState === 'hidden') flush.current() }
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return
      if ((event.key === key && event.newValue === null) || (event.key === DRAFT_SETTINGS_KEY && !getDraftSettings().enabled)) {
        cancelSave()
      }
    }
    window.addEventListener('pagehide', flush.current)
    window.addEventListener(DRAFT_AUTOSAVE_DISABLED_EVENT, cancelSave)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush.current)
      window.removeEventListener(DRAFT_AUTOSAVE_DISABLED_EVENT, cancelSave)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onHidden)
      flush.current()
    }
  }, [key, cancelSave])

  return () => {
    if (!removeExpiringStorage(key)) {
      showToast(t('草稿清除失败，请重试'), 'error')
      return
    }
    cancelSave()
    showToast(t('已清除本页保存的草稿'))
  }
}
