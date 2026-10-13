import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { parseJsonSchema } from '../monaco/jsonSchema'
import './SaveFileDialog.css'
import './JsonSchemaDialog.css'

type Props = { value: string; onSave: (schema: string) => void; onClose: () => void }

const JsonSchemaDialog = ({ value, onSave, onClose }: Props) => {
  const [source, setSource] = useState(value)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()

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
      const controls = formRef.current?.querySelectorAll<HTMLElement>('textarea, button')
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
    try {
      parseJsonSchema(source)
      onSave(source.trim())
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Schema 无效')
    }
  }

  return createPortal(
    <div className="save-file-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={formRef} className="save-file-dialog json-schema-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={save} onKeyDown={handleKeyDown}>
        <h2 id={titleId}>JSON Schema</h2>
        <label htmlFor={inputId}>当前文档的校验规则</label>
        <textarea ref={inputRef} id={inputId} value={source} onChange={(event) => { setSource(event.target.value); setError('') }} spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? `${helpId} ${errorId}` : helpId} placeholder={'{\n  "type": "object",\n  "properties": { "name": { "type": "string" } },\n  "required": ["name"]\n}'} />
        <p id={helpId} className="save-file-help">用于字段补全与校验，仅作用于当前文档。留空可移除规则；外部引用不会自动下载。</p>
        {error && <p id={errorId} className="save-file-error" role="alert">{error}</p>}
        <div className="save-file-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">应用</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export default JsonSchemaDialog
