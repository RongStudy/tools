import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ToolDefinition } from '../tools/registry'
import ToolIcon from './ToolIcon'

type ToolSearchDialogProps = {
  tools: ToolDefinition[]
  onClose: () => void
  onSelect: (tool: ToolDefinition) => void
}

const ToolSearchDialog = ({ tools, onClose, onSelect }: ToolSearchDialogProps) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([])
  const restoreFocus = useRef(true)
  const titleId = useId()
  const resultsId = useId()
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return tools.filter((tool) => `${tool.title} ${tool.navTitle} ${tool.description} ${tool.category}`.toLowerCase().includes(normalized))
  }, [query, tools])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => { if (restoreFocus.current) previousFocus?.focus() }
  }, [])

  useEffect(() => {
    resultRefs.current[selectedIndex]?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex])

  const openTool = (tool: ToolDefinition) => {
    restoreFocus.current = false
    onSelect(tool)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (filteredTools.length === 0) return
      const next = (selectedIndex + (event.key === 'ArrowDown' ? 1 : -1) + filteredTools.length) % filteredTools.length
      setSelectedIndex(next)
      if (event.target !== inputRef.current) resultRefs.current[next]?.focus()
    } else if (event.key === 'Enter' && event.target === inputRef.current && filteredTools[selectedIndex]) {
      event.preventDefault()
      openTool(filteredTools[selectedIndex])
    } else if (event.key === 'Tab') {
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input, button') ?? [])
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  return createPortal(
    <div className="tool-search-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} className="tool-search-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}>
        <div className="tool-search-header">
          <h2 id={titleId}>切换工具</h2>
          <button type="button" className="tool-search-close" aria-label="关闭工具搜索" onClick={onClose}>×</button>
        </div>
        <label className="tool-search-field">
          <ToolIcon name="search" />
          <input ref={inputRef} type="search" aria-label="搜索工具" aria-controls={resultsId} value={query} placeholder="输入名称或能力，如 JSON、Base64" onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0) }} />
        </label>
        <div className="tool-search-results" id={resultsId}>
          {filteredTools.map((tool, index) => (
            <button ref={(element) => { resultRefs.current[index] = element }} key={tool.path} type="button" className={`tool-search-result${index === selectedIndex ? ' selected' : ''}`} onFocus={() => setSelectedIndex(index)} onPointerEnter={() => setSelectedIndex(index)} onClick={() => openTool(tool)}>
              <span className="tool-search-result-icon"><ToolIcon name={tool.icon} /></span>
              <span className="tool-search-result-copy"><span>{tool.navTitle}</span><small>{tool.description}</small></span>
              <span className="tool-search-result-enter" aria-hidden="true">↵</span>
            </button>
          ))}
          {filteredTools.length === 0 && <p className="tool-search-empty" role="status">没有匹配的工具</p>}
        </div>
        <p className="tool-search-help">↑↓ 选择 · Enter 打开 · Esc 关闭</p>
      </div>
    </div>,
    document.body,
  )
}

export default ToolSearchDialog
