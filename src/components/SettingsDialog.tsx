import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { getDraftRetentionDays, MAX_DRAFT_RETENTION_DAYS, setDraftRetentionDays } from '../utils/expiringStorage'
import { useAppTheme } from '../themeContext'
import './SaveFileDialog.css'
import './SettingsDialog.css'
import '../styles/common.css'

const SettingsDialog = ({ onClose }: { onClose: () => void }) => {
  const { theme, toggleTheme } = useAppTheme()
  const [days, setDays] = useState(() => String(getDraftRetentionDays()))
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()
  const themeTitleId = useId()
  const draftTitleId = useId()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => { previousFocus?.focus() }
  }, [])

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
    const value = Number(days)
    if (!Number.isInteger(value) || value < 1 || value > MAX_DRAFT_RETENTION_DAYS) {
      setError(`请输入 1–${MAX_DRAFT_RETENTION_DAYS} 之间的整数天数`)
      inputRef.current?.focus()
      return
    }
    if (!setDraftRetentionDays(value)) {
      setError('设置保存失败，请检查浏览器是否允许本地存储后重试')
      return
    }
    onClose()
  }

  return createPortal(
    <div className="save-file-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={dialogRef} className="save-file-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={save} onKeyDown={handleKeyDown} noValidate>
        <div className="settings-header">
          <h2 id={titleId}>设置</h2>
          <button type="button" className="tool-search-close" aria-label="关闭设置" onClick={onClose}>×</button>
        </div>
        <section className="settings-section" aria-labelledby={themeTitleId}>
          <h3 id={themeTitleId}>外观主题</h3>
          <div className="settings-theme-options" role="group" aria-label="选择主题">
            <button type="button" className="btn btn-secondary" aria-pressed={theme === 'dark'} onClick={() => { if (theme !== 'dark') toggleTheme() }}><span aria-hidden="true">{theme === 'dark' ? '✓ ' : ''}</span>深色主题</button>
            <button type="button" className="btn btn-secondary" aria-pressed={theme === 'light'} onClick={() => { if (theme !== 'light') toggleTheme() }}><span aria-hidden="true">{theme === 'light' ? '✓ ' : ''}</span>浅色主题</button>
          </div>
          <p className="save-file-help">主题切换立即生效，并自动记住，无需点击保存。</p>
        </section>
        <section className="settings-section" aria-labelledby={draftTitleId}>
          <h3 id={draftTitleId}>草稿保存</h3>
          <label htmlFor={inputId}>草稿保存时长（天）</label>
          <input ref={inputRef} id={inputId} type="number" min={1} max={MAX_DRAFT_RETENTION_DAYS} step={1} value={days} onChange={(event) => { setDays(event.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? `${helpId} ${errorId}` : helpId} />
          <div id={helpId}>
            <p className="save-file-help">默认 2 天，可设置 1–365 天。点击“保存草稿设置”后，从下一次自动保存起生效，每次保存重新计时。</p>
            <p className="save-file-help">适用于 JSON 格式化、代码对比、临时文本和 Mermaid / Markdown 的自动草稿。</p>
            <p className="save-file-help">草稿数据仅保存在当前浏览器本地，不会上传到云端。清除浏览器网站数据会删除本地草稿。</p>
          </div>
          {error && <p id={errorId} className="save-file-error" role="alert">{error}</p>}
        </section>
        <div className="save-file-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>关闭</button>
          <button type="submit" className="btn btn-primary">保存草稿设置</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export default SettingsDialog
