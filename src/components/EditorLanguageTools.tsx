import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { hasBuiltinDiagnostics, hasBuiltinLanguageService } from '../monaco/languageCapabilities'
import { useToast } from './toastContext'
import './EditorLanguageTools.css'

export type EditorLanguageBinding = { editor: Monaco.editor.IStandaloneCodeEditor; monaco: typeof Monaco }
type Props = { binding?: EditorLanguageBinding; language: string; path: string; label: string; caption?: string }

const EditorLanguageTools = ({ binding, language, path, label, caption }: Props) => {
  const [markers, setMarkers] = useState<Monaco.editor.IMarker[]>([])
  const [open, setOpen] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [problemLeft, setProblemLeft] = useState<number>()
  const root = useRef<HTMLDivElement>(null)
  const problemList = useRef<HTMLDivElement>(null)
  const listId = useId()
  const { showToast } = useToast()
  const supportsDiagnostics = hasBuiltinDiagnostics(language)

  useEffect(() => {
    setOpen(false)
    setMarkers([])
    if (!binding || !supportsDiagnostics) return
    const { editor, monaco } = binding
    const refresh = () => {
      const model = editor.getModel()
      const next = model && !model.isDisposed() && model.uri.toString() === path
        ? monaco.editor.getModelMarkers({ resource: model.uri }).filter((marker) => marker.severity >= monaco.MarkerSeverity.Warning)
        : []
      next.sort((a, b) => b.severity - a.severity || a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn)
      setMarkers(next)
    }
    const listeners = [
      monaco.editor.onDidChangeMarkers((resources) => { if (resources.some((uri) => uri.toString() === path)) refresh() }),
      editor.onDidChangeModel(refresh),
      editor.onDidChangeModelLanguage(refresh),
      editor.onDidDispose(() => { setMarkers([]); setOpen(false) }),
    ]
    refresh()
    return () => listeners.forEach((listener) => listener.dispose())
  }, [binding, path, supportsDiagnostics, language])

  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      if (!root.current || !problemList.current) return
      const anchor = root.current.getBoundingClientRect()
      const width = problemList.current.getBoundingClientRect().width
      setProblemLeft(Math.max(12 - anchor.left, Math.min(anchor.width - width, window.innerWidth - 12 - anchor.left - width)))
    }
    position()
    window.addEventListener('resize', position)
    return () => window.removeEventListener('resize', position)
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  if (!hasBuiltinLanguageService(language)) return null
  const currentEditor = () => {
    const editor = binding?.editor
    const model = editor?.getModel()
    return model && !model.isDisposed() && model.uri.toString() === path ? editor : undefined
  }
  const runAction = async (id: string) => {
    const editor = currentEditor()
    const action = editor?.getAction(id)
    if (!action?.isSupported()) {
      showToast('语言服务尚未就绪，请稍后重试', 'info')
      return
    }
    editor?.focus()
    try {
      if (id === 'editor.action.formatDocument') setFormatting(true)
      await action.run()
    } catch {
      showToast('处理失败，请重试', 'error')
    } finally {
      setFormatting(false)
    }
  }

  return (
    <div className="editor-language-tools" ref={root} role="group" aria-label={`${label}语言工具`} onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false) }
    }}>
      {caption && <span className="editor-language-label">{caption}</span>}
      <button type="button" className="btn-small" aria-label={`${label}补全`} title="显示补全（Ctrl+Space）" disabled={!binding} onClick={() => void runAction('editor.action.triggerSuggest')}>补全</button>
      <button type="button" className="btn-small" aria-label={`${label}格式化`} title="格式化当前内容（Shift+Alt+F）" disabled={!binding || formatting} onClick={() => void runAction('editor.action.formatDocument')}>格式化</button>
      {supportsDiagnostics && <button type="button" className={`btn-small${markers.length ? ' has-problems' : ''}`} aria-label={`${label}问题 ${markers.length}`} aria-expanded={open} aria-controls={listId} disabled={!binding} onClick={() => setOpen((value) => !value)}>问题 {markers.length}</button>}
      {open && supportsDiagnostics && <div className="editor-problems" ref={problemList} style={{ left: problemLeft, right: problemLeft === undefined ? 0 : 'auto' }} role="region" aria-label={`${label}问题列表`} id={listId}>
        <div className="editor-problems-header"><span>{label} · 问题 {markers.length}</span><button type="button" className="btn-small" aria-label={`关闭${label}问题列表`} onClick={() => setOpen(false)}>关闭</button></div>
        {markers.length ? <ul>{markers.map((marker, index) => <li key={index}><button type="button" onClick={() => {
          const editor = currentEditor()
          if (!editor) return
          editor.setPosition({ lineNumber: marker.startLineNumber, column: marker.startColumn })
          editor.revealLineInCenter(marker.startLineNumber)
          editor.focus()
          setOpen(false)
        }}><span className={binding && marker.severity === binding.monaco.MarkerSeverity.Error ? 'problem-error' : 'problem-warning'}>{binding && marker.severity === binding.monaco.MarkerSeverity.Error ? '错误' : '警告'} {marker.startLineNumber}:{marker.startColumn}</span><span>{marker.message}</span></button></li>)}</ul> : <p>暂无错误或警告</p>}
      </div>}
    </div>
  )
}

export default EditorLanguageTools
