import { useState, useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { useFullscreen } from '../hooks/useFullscreen'
import { writeTextToClipboard } from '../utils/clipboard'
import { readExpiringStorage, writeExpiringStorage, TWO_DAYS_IN_MS } from '../utils/expiringStorage'
import './ScratchPad.css'
import '../styles/common.css'

const SCRATCH_PAD_DRAFT_KEY = 'dev-tools:scratch-pad:draft'

const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 32
const DEFAULT_FONT_SIZE = 14

type ScratchDocument = {
  id: string
  name: string
  content: string
  language: string
}

type ScratchPadDraft = {
  activeDocumentId: string
  documents: ScratchDocument[]
  fontSize: number
}

type LegacyScratchPadDraft = {
  content: string
  fontSize: number
}

const DEFAULT_SCRATCH_DOCUMENT: ScratchDocument = {
  id: 'scratch-1',
  name: '文本 1',
  content: '',
  language: 'plaintext',
}

const DEFAULT_SCRATCH_PAD_DRAFT: ScratchPadDraft = {
  activeDocumentId: DEFAULT_SCRATCH_DOCUMENT.id,
  documents: [DEFAULT_SCRATCH_DOCUMENT],
  fontSize: DEFAULT_FONT_SIZE,
}

const LANGUAGES = [
  { value: 'plaintext', label: '纯文本' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'scala', label: 'Scala' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'r', label: 'R' },
  { value: 'lua', label: 'Lua' },
  { value: 'perl', label: 'Perl' },
  { value: 'dart', label: 'Dart' },
  { value: 'clojure', label: 'Clojure' },
  { value: 'haskell', label: 'Haskell' },
  { value: 'ocaml', label: 'OCaml' },
  { value: 'fsharp', label: 'F#' },
  { value: 'vb', label: 'Visual Basic' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'bat', label: 'Batch' },
  { value: 'ini', label: 'INI' },
  { value: 'toml', label: 'TOML' },
  { value: 'properties', label: 'Properties' },
]

const createScratchDocument = (documents: ScratchDocument[]): ScratchDocument => {
  const highestDocumentNumber = documents.reduce((highest, document) => {
    const match = /^文本 (\d+)$/.exec(document.name)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)

  return {
    ...DEFAULT_SCRATCH_DOCUMENT,
    id: `scratch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: `文本 ${highestDocumentNumber + 1}`,
  }
}

const isScratchDocument = (value: unknown): value is ScratchDocument => {
  if (!value || typeof value !== 'object') return false

  const document = value as Partial<ScratchDocument>
  return typeof document.id === 'string'
    && typeof document.name === 'string'
    && typeof document.content === 'string'
    && typeof document.language === 'string'
}

const normalizeFontSize = (fontSize: unknown): number => {
  if (typeof fontSize !== 'number' || Number.isNaN(fontSize)) return DEFAULT_FONT_SIZE
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(fontSize)))
}

const readScratchPadDraft = (): ScratchPadDraft => {
  const savedDraft = readExpiringStorage<unknown>(SCRATCH_PAD_DRAFT_KEY)
  if (!savedDraft || typeof savedDraft !== 'object') return DEFAULT_SCRATCH_PAD_DRAFT

  const draft = savedDraft as Partial<ScratchPadDraft & LegacyScratchPadDraft>
  if (Array.isArray(draft.documents)) {
    const documents = draft.documents.filter(isScratchDocument)
    const activeDocumentId = documents.some((document) => document.id === draft.activeDocumentId)
      ? draft.activeDocumentId as string
      : documents[0]?.id
    if (documents.length && activeDocumentId) {
      return { activeDocumentId, documents, fontSize: normalizeFontSize(draft.fontSize) }
    }
  }

  if (typeof draft.content === 'string') {
    return {
      activeDocumentId: DEFAULT_SCRATCH_DOCUMENT.id,
      documents: [{ ...DEFAULT_SCRATCH_DOCUMENT, content: draft.content }],
      fontSize: normalizeFontSize(draft.fontSize),
    }
  }

  return DEFAULT_SCRATCH_PAD_DRAFT
}

const editorLoading = <div className="monaco-loading">编辑器加载中</div>

const ScratchPad = () => {
  const [initialDraft] = useState(readScratchPadDraft)
  const [documents, setDocuments] = useState(initialDraft.documents)
  const [activeDocumentId, setActiveDocumentId] = useState(initialDraft.activeDocumentId)
  const [fontSize, setFontSize] = useState(initialDraft.fontSize)
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]
  const { content, language } = activeDocument

  const editorPanelRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, toggleFullscreen] = useFullscreen(editorPanelRef)
  const { showToast } = useToast()

  useEffect(() => {
    writeExpiringStorage(
      SCRATCH_PAD_DRAFT_KEY,
      { activeDocumentId, documents, fontSize },
      TWO_DAYS_IN_MS
    )
  }, [activeDocumentId, documents, fontSize])

  const updateActiveDocument = useCallback((updates: Partial<Omit<ScratchDocument, 'id' | 'name'>>) => {
    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.id === activeDocumentId ? { ...document, ...updates } : document
    )))
  }, [activeDocumentId])

  const addDocument = () => {
    const document = createScratchDocument(documents)
    setDocuments((currentDocuments) => [...currentDocuments, document])
    setActiveDocumentId(document.id)
  }

  const closeDocument = (documentId: string) => {
    if (documents.length === 1) {
      updateActiveDocument({ content: '' })
      return
    }

    const currentIndex = documents.findIndex((document) => document.id === documentId)
    const nextActiveDocument = documents[currentIndex + 1] ?? documents[currentIndex - 1]
    setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== documentId))
    if (documentId === activeDocumentId) {
      setActiveDocumentId(nextActiveDocument.id)
    }
  }

  const zoomIn = () => setFontSize((size) => Math.min(MAX_FONT_SIZE, size + 1))
  const zoomOut = () => setFontSize((size) => Math.max(MIN_FONT_SIZE, size - 1))
  const resetZoom = () => setFontSize(DEFAULT_FONT_SIZE)

  const copyContent = async () => {
    const success = await writeTextToClipboard(content)
    if (success) {
      showToast('已复制到剪贴板')
    } else {
      showToast('复制失败', 'error')
    }
  }

  const clearContent = () => {
    updateActiveDocument({ content: '' })
  }

  const toolbar = (
    <div className="scratch-toolbar">
      <div className="scratch-zoom-control" role="group" aria-label="字号缩放">
        <button
          onClick={zoomOut}
          className="btn-small"
          disabled={fontSize <= MIN_FONT_SIZE}
          title="缩小字号"
        >
          缩小
        </button>
        <span className="scratch-font-size" title="当前字号">{fontSize}px</span>
        <button
          onClick={zoomIn}
          className="btn-small"
          disabled={fontSize >= MAX_FONT_SIZE}
          title="放大字号"
        >
          放大
        </button>
        <button
          onClick={resetZoom}
          className="btn-small"
          disabled={fontSize === DEFAULT_FONT_SIZE}
          title="重置字号"
        >
          重置
        </button>
      </div>
      <div className="scratch-language-select">
        <label htmlFor="scratch-language">语言:</label>
        <select
          id="scratch-language"
          name="scratchLanguage"
          value={language}
          onChange={(e) => updateActiveDocument({ language: e.target.value })}
        >
          {LANGUAGES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <button onClick={clearContent} className="btn btn-danger">清空</button>
    </div>
  )

  return (
    <ToolLayout
      className={`scratch-pad ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title="临时文本输入"
      description="随手记录或粘贴文本，支持多标签、字号缩放和全屏编辑"
      actions={toolbar}
      hideHeader={isFullscreen}
    >
      {!isFullscreen && (
        <div className="scratch-tabs" role="tablist" aria-label="临时文本">
          <div className="scratch-tab-list">
            {documents.map((document) => (
              <div className="scratch-tab" key={document.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={document.id === activeDocumentId}
                  className={`scratch-tab-button ${document.id === activeDocumentId ? 'is-active' : ''}`}
                  onClick={() => setActiveDocumentId(document.id)}
                >
                  {document.name}
                </button>
                {documents.length > 1 && (
                  <button
                    type="button"
                    className="scratch-tab-close"
                    aria-label={`关闭 ${document.name}`}
                    title={`关闭 ${document.name}`}
                    onClick={() => closeDocument(document.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn-small scratch-tab-add" onClick={addDocument}>
            新建文本
          </button>
        </div>
      )}
      <div
        ref={editorPanelRef}
        className={`editor-panel scratch-editor-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
      >
        <div className="panel-header">
          <span>输入</span>
          <div className="panel-actions">
            <small className="scratch-char-count">{content.length.toLocaleString()} 字符</small>
            <button onClick={copyContent} className="btn-small" disabled={!content}>复制</button>
            <button onClick={toggleFullscreen} className="btn-small btn-fullscreen" title={isFullscreen ? '退出全屏' : '全屏查看'}>
              {isFullscreen ? '⤓ 退出全屏' : '⛶ 全屏'}
            </button>
          </div>
        </div>
        <div className="scratch-editor-body">
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            language={language}
            value={content}
            loading={editorLoading}
            onChange={(value) => updateActiveDocument({ content: value ?? '' })}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    </ToolLayout>
  )
}

export default ScratchPad
