import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from './toastContext'
import './SaveFileDialog.css'
import '../styles/common.css'

export type SaveFileRequest = {
  content: string
  defaultFilename: string
  mimeType: string
}

type SaveFileDialogProps = SaveFileRequest & { onClose: () => void }

const SaveFileDialog = ({ content, defaultFilename, mimeType, onClose }: SaveFileDialogProps) => {
  const [filename, setFilename] = useState(defaultFilename)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const inputId = useId()
  const errorId = useId()
  const helpId = useId()
  const extension = defaultFilename.slice(defaultFilename.lastIndexOf('.'))
  const { showToast } = useToast()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    inputRef.current?.setSelectionRange(0, defaultFilename.lastIndexOf('.'))
    return () => { previousFocus?.focus() }
  }, [defaultFilename])

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key === 'Tab') {
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('input, button')
      const first = controls?.[0]
      const last = controls?.[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    const name = filename.trim()
    if (!name || name === '.' || name === '..') {
      setError('请输入文件名')
      inputRef.current?.focus()
      return
    }
    if (/[\p{Cc}<>:"/\\|?*]/u.test(name) || /[. ]$/.test(name)) {
      setError('文件名不能包含路径或特殊字符，也不能以句点结尾')
      inputRef.current?.focus()
      return
    }
    const downloadName = /\.[^.]+$/.test(name) ? name : `${name}${extension}`
    try {
      const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
      const link = document.createElement('a')
      try {
        link.href = url
        link.download = downloadName
        document.body.appendChild(link)
        link.click()
      } finally {
        link.remove()
        // Allow the browser to consume the download before releasing its URL.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      showToast('已发起文件下载')
      onClose()
    } catch {
      setError('保存文件失败，请重试')
    }
  }

  return createPortal(
    <div className="save-file-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={dialogRef} className="save-file-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={save} onKeyDown={handleKeyDown}>
        <h2 id={titleId}>保存到文件</h2>
        <label htmlFor={inputId}>文件名</label>
        <input ref={inputRef} id={inputId} value={filename} onChange={(event) => { setFilename(event.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? `${helpId} ${errorId}` : helpId} autoComplete="off" />
        <p id={helpId} className="save-file-help">未填写扩展名时，自动添加 {extension}</p>
        {error && <p id={errorId} className="save-file-error" role="alert">{error}</p>}
        <div className="save-file-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export default SaveFileDialog
