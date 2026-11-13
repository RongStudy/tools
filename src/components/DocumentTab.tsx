import { t, useLocale } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import './DocumentTab.css'

type DocumentTabProps = {
  name: string
  selected: boolean
  prefix: string
  onSelect: () => void
  onRename: (name: string) => void
  onClose?: () => void
}

export default function DocumentTab({ name, selected, prefix, onSelect, onRename, onClose }: DocumentTabProps) {
  useLocale()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const finishedRef = useRef(true)
  const restoreFocusRef = useRef(false)

  useEffect(() => {
    if (editing) inputRef.current?.select()
    else if (restoreFocusRef.current) {
      restoreFocusRef.current = false
      buttonRef.current?.focus()
    }
  }, [editing])

  const beginRename = () => {
    onSelect()
    setDraft(name)
    finishedRef.current = false
    setEditing(true)
  }

  const finishRename = (save: boolean, restoreFocus = false) => {
    if (finishedRef.current) return
    finishedRef.current = true
    restoreFocusRef.current = restoreFocus
    setEditing(false)
    if (save && draft.trim()) onRename(draft.trim())
  }

  return (
    <div className={`${prefix}-tab document-tab${selected ? ' is-active' : ''}`}>
      <div className="document-tab-name">
        <button
          ref={buttonRef}
          type="button"
          role="tab"
          aria-selected={selected}
          aria-hidden={editing || undefined}
          tabIndex={editing ? -1 : 0}
          className={`${prefix}-tab-button document-tab-button${selected ? ' is-active' : ''}`}
          style={editing ? { visibility: 'hidden' } : undefined}
          title={t("{value0} · 双击或按 F2 重命名", { value0: name })}
          onClick={onSelect}
          onDoubleClick={beginRename}
          onKeyDown={(event) => {
            if (event.key === 'F2') { event.preventDefault(); beginRename() }
          }}
        >
          <svg className="document-tab-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
            <path d="M3.5 4.5h9m-9 3h9m-9 3h6" />
          </svg>
          <span className="document-tab-label">{name}</span>
        </button>
        {editing && <input
          ref={inputRef}
          autoFocus
          className="document-tab-rename"
          aria-label={t("重命名 {value0}", { value0: name })}
          value={draft}
          maxLength={80}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finishRename(true)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              finishRename(event.key === 'Enter', true)
            }
          }}
        />}
      </div>
      {onClose && <button
        type="button"
        className={`${prefix}-tab-close document-tab-close`}
        aria-label={t("关闭 {value0}", { value0: name })}
        title={t("关闭 {value0}", { value0: name })}
        onClick={onClose}
      >×</button>}
    </div>
  )
}
