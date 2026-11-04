import { useEffect, useRef, useState } from 'react'
import { useToast } from '../components/toastContext'
import { isFilePickerCancelled, localFileErrorMessage, writeLocalFile, type OpenLocalFile } from '../utils/localFile'

/** 文件句柄仅在当前页面会话中使用，保存成功后更新对应文件的磁盘快照。 */
export function useLocalFiles() {
  const [files, setFiles] = useState<Record<string, OpenLocalFile>>({})
  const [savingFile, setSavingFile] = useState<OpenLocalFile | null>(null)
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const { showToast } = useToast()

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const bind = (key: string, file: OpenLocalFile) => setFiles((current) => ({ ...current, [key]: file }))
  const remove = (...keys: string[]) => setFiles((current) => {
    const next = { ...current }
    keys.forEach((key) => { delete next[key] })
    return next
  })
  const swap = (first: string, second: string) => setFiles((current) => {
    const next = { ...current }
    if (current[second]) next[first] = current[second]; else delete next[first]
    if (current[first]) next[second] = current[first]; else delete next[second]
    return next
  })

  const save = async (key: string, content: string) => {
    const opened = files[key]
    if (!opened || opened.content === content || busyRef.current) return
    busyRef.current = true
    setSavingFile(opened)
    try {
      const saved = await writeLocalFile(opened, content)
      if (!mountedRef.current) return
      setFiles((current) => Object.fromEntries(Object.entries(current).map(([fileKey, file]) => [fileKey, file === opened ? saved : file])))
      showToast(`已保存 ${opened.name}`)
    } catch (error) {
      if (mountedRef.current) showToast(localFileErrorMessage(error, 'save'), 'error')
    } finally {
      busyRef.current = false
      if (mountedRef.current) setSavingFile(null)
    }
  }

  const reportLoadError = (error: unknown) => {
    if (mountedRef.current && !isFilePickerCancelled(error)) showToast(localFileErrorMessage(error, 'load'), 'error')
  }

  return { files, savingFile, bind, remove, swap, save, reportLoadError }
}
