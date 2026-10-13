import { useDetectedLanguages } from '../hooks/useDetectedLanguages'
import { useDraftPersistence } from '../hooks/useDraftPersistence'
import { useMemo, useState, useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import EditorLanguageTools, { type EditorLanguageBinding } from '../components/EditorLanguageTools'
import { languageEditorOptions } from '../monaco/languageCapabilities'
import { modelPath, useMonacoModels } from '../hooks/useMonacoModels'
import ToolLayout from '../components/ToolLayout'
import SaveFileDialog, { type SaveFileRequest } from '../components/SaveFileDialog'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useToast } from '../components/toastContext'
import { writeTextToClipboard } from '../utils/clipboard'
import { readExpiringStorage } from '../utils/expiringStorage'
import './ScratchPad.css'
import '../styles/common.css'

const SCRATCH_PAD_DRAFT_KEY = 'dev-tools:scratch-pad:draft'

const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 32
const DEFAULT_FONT_SIZE = 14
const MAX_PANES = 3

type ScratchPane = {
  id: string
  content: string
  language: string
}

type ScratchDocument = {
  id: string
  name: string
  panes: ScratchPane[]
}

type ScratchPadDraft = {
  activeDocumentId: string
  documents: ScratchDocument[]
  fontSize: number
}

type LegacyScratchDocument = {
  id: string
  name: string
  content: string
  language: string
}

type LegacyScratchPadDraft = {
  content: string
  fontSize: number
}

const createPane = (content = '', language = 'auto'): ScratchPane => ({
  id: `pane-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  content,
  language,
})

const DEFAULT_SCRATCH_DOCUMENT: ScratchDocument = {
  id: 'scratch-1',
  name: '文本 1',
  panes: [{ id: 'pane-1', content: '', language: 'auto' }],
}

const DEFAULT_SCRATCH_PAD_DRAFT: ScratchPadDraft = {
  activeDocumentId: DEFAULT_SCRATCH_DOCUMENT.id,
  documents: [DEFAULT_SCRATCH_DOCUMENT],
  fontSize: DEFAULT_FONT_SIZE,
}

const LANGUAGES = [
  { value: 'auto', label: '自动检测' },
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
    id: `scratch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: `文本 ${highestDocumentNumber + 1}`,
    panes: [createPane()],
  }
}

const isScratchPane = (value: unknown): value is ScratchPane => {
  if (!value || typeof value !== 'object') return false

  const pane = value as Partial<ScratchPane>
  return typeof pane.id === 'string'
    && typeof pane.content === 'string'
    && typeof pane.language === 'string'
}

const normalizeDocument = (value: unknown): ScratchDocument | null => {
  if (!value || typeof value !== 'object') return null

  const document = value as Partial<ScratchDocument> & Partial<LegacyScratchDocument>
  if (typeof document.id !== 'string' || typeof document.name !== 'string') return null

  if (Array.isArray(document.panes)) {
    const panes = document.panes.filter(isScratchPane).slice(0, MAX_PANES)
    return panes.length ? { id: document.id, name: document.name, panes } : null
  }

  if (typeof document.content === 'string' && typeof document.language === 'string') {
    return {
      id: document.id,
      name: document.name,
      panes: [createPane(document.content, document.language)],
    }
  }

  return null
}

const normalizeFontSize = (fontSize: unknown): number => {
  if (typeof fontSize !== 'number' || Number.isNaN(fontSize)) return DEFAULT_FONT_SIZE
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(fontSize)))
}

const readScratchPadDraft = (): ScratchPadDraft => {
  const savedDraft = readExpiringStorage<unknown>(SCRATCH_PAD_DRAFT_KEY)
  if (!savedDraft || typeof savedDraft !== 'object') return DEFAULT_SCRATCH_PAD_DRAFT

  const draft = savedDraft as Partial<ScratchPadDraft> & Partial<LegacyScratchPadDraft>
  if (Array.isArray(draft.documents)) {
    const documents = draft.documents
      .map(normalizeDocument)
      .filter((document): document is ScratchDocument => document !== null)
    if (documents.length) {
      const activeDocumentId = documents.some((document) => document.id === draft.activeDocumentId)
        ? draft.activeDocumentId as string
        : documents[0].id
      return { activeDocumentId, documents, fontSize: normalizeFontSize(draft.fontSize) }
    }
  }

  if (typeof draft.content === 'string') {
    return {
      activeDocumentId: DEFAULT_SCRATCH_DOCUMENT.id,
      documents: [{
        id: DEFAULT_SCRATCH_DOCUMENT.id,
        name: DEFAULT_SCRATCH_DOCUMENT.name,
        panes: [createPane(draft.content, 'plaintext')],
      }],
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedPaneIds, setSelectedPaneIds] = useState<Record<string, string>>({})
  const [saveRequest, setSaveRequest] = useState<SaveFileRequest | null>(null)
  const [paneBindings, setPaneBindings] = useState<Record<string, EditorLanguageBinding>>({})
  const paneIdsKey = documents.flatMap((document) => document.panes.map((pane) => pane.id)).join('\n')
  useEffect(() => {
    const liveIds = new Set(paneIdsKey.split('\n'))
    setPaneBindings((current) => Object.fromEntries(Object.entries(current).filter(([id]) => liveIds.has(id))))
  }, [paneIdsKey])
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]
  const { panes } = activeDocument
  const languageInputs = useMemo(() => panes.map((pane) => ({ ...pane, id: `${activeDocument.id}/${pane.id}` })), [activeDocument.id, panes])
  const detectedLanguages = useDetectedLanguages(languageInputs)
  const registerMonaco = useMonacoModels(documents.flatMap((document) => document.panes.map((pane) => modelPath('scratch', document.id, pane.id))))
  const selectedPaneIndex = Math.max(0, panes.findIndex((pane) => pane.id === selectedPaneIds[activeDocument.id]))
  const selectedPane = panes[selectedPaneIndex]
  const { showToast } = useToast()

  const draft = useMemo(() => ({ activeDocumentId, documents, fontSize }), [activeDocumentId, documents, fontSize])
  useDraftPersistence(SCRATCH_PAD_DRAFT_KEY, draft)

  useEscapeToClose(isFullscreen, () => setIsFullscreen(false))

  const updateActiveDocument = useCallback((updater: (document: ScratchDocument) => ScratchDocument) => {
    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.id === activeDocumentId ? updater(document) : document
    )))
  }, [activeDocumentId])

  const updatePane = useCallback((paneId: string, updates: Partial<Omit<ScratchPane, 'id'>>) => {
    updateActiveDocument((document) => ({
      ...document,
      panes: document.panes.map((pane) => (
        pane.id === paneId ? { ...pane, ...updates } : pane
      )),
    }))
  }, [updateActiveDocument])

  const addPane = () => {
    updateActiveDocument((document) => {
      if (document.panes.length >= MAX_PANES) return document
      return { ...document, panes: [...document.panes, createPane()] }
    })
  }

  const removePane = (paneId: string) => {
    updateActiveDocument((document) => {
      if (document.panes.length <= 1) return document
      return { ...document, panes: document.panes.filter((pane) => pane.id !== paneId) }
    })
  }

  const clearAllPanes = () => {
    updateActiveDocument((document) => ({
      ...document,
      panes: document.panes.map((pane) => ({ ...pane, content: '' })),
    }))
  }

  const addDocument = () => {
    const document = createScratchDocument(documents)
    setDocuments((currentDocuments) => [...currentDocuments, document])
    setActiveDocumentId(document.id)
  }

  const closeDocument = (documentId: string) => {
    if (documents.length === 1) {
      clearAllPanes()
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

  const copyPane = async (pane: ScratchPane) => {
    const success = await writeTextToClipboard(pane.content)
    if (success) {
      showToast('已复制到剪贴板')
    } else {
      showToast('复制失败', 'error')
    }
  }

  const selectPane = (paneId: string) => {
    setSelectedPaneIds((current) => current[activeDocument.id] === paneId
      ? current
      : { ...current, [activeDocument.id]: paneId })
  }

  const saveSelectedPane = () => {
    setSaveRequest({
      content: selectedPane.content,
      defaultFilename: `${activeDocument.name}-栏 ${selectedPaneIndex + 1}.txt`,
      mimeType: 'text/plain;charset=utf-8',
    })
  }

  const totalChars = panes.reduce((sum, pane) => sum + pane.content.length, 0)

  const toolbar = (
    <div className="scratch-toolbar">
      <div className="scratch-zoom-control" role="group" aria-label="字号缩放">
        <button
          onClick={zoomOut}
          className="btn btn-secondary"
          disabled={fontSize <= MIN_FONT_SIZE}
          title="缩小字号"
        >
          缩小
        </button>
        <span className="scratch-font-size" title="当前字号">{fontSize}px</span>
        <button
          onClick={zoomIn}
          className="btn btn-secondary"
          disabled={fontSize >= MAX_FONT_SIZE}
          title="放大字号"
        >
          放大
        </button>
        <button
          onClick={resetZoom}
          className="btn btn-secondary"
          title={`恢复默认字号（${DEFAULT_FONT_SIZE}px）`}
        >
          默认字号
        </button>
      </div>
      <button onClick={clearAllPanes} className="btn btn-danger">清空</button>
    </div>
  )

  return (
    <ToolLayout
      className={`scratch-pad ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title="临时文本输入"
      description="随手记录或粘贴文本，支持多标签、分栏、字号缩放和全屏编辑"
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
      <div className={`editor-panel scratch-editor-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}>
        <div className="panel-header">
          <span>输入</span>
          <div className="panel-actions">
            <button
              type="button"
              onClick={saveSelectedPane}
              className="btn-small"
              title={`保存栏 ${selectedPaneIndex + 1} 到本地文件`}
            >
              保存本栏
            </button>
            <button
              onClick={addPane}
              className="btn-small"
              disabled={panes.length >= MAX_PANES}
              title="新增分栏"
            >
              ＋ 分栏
            </button>
            <small className="scratch-char-count">{totalChars.toLocaleString()} 字符</small>
            <button
              onClick={() => setIsFullscreen((value) => !value)}
              className="btn-small btn-fullscreen"
              title={isFullscreen ? '退出全屏' : '浏览器内全屏'}
            >
              {isFullscreen ? '⤓ 退出全屏' : '⛶ 全屏'}
            </button>
          </div>
        </div>
        <div
          className="scratch-editor-body"
          style={{ gridTemplateColumns: `repeat(${panes.length}, minmax(0, 1fr))` }}
        >
          {panes.map((pane, index) => (
            <div
              className={`scratch-pane${pane.id === selectedPane.id ? ' is-active' : ''}`}
              key={pane.id}
              onPointerDownCapture={() => selectPane(pane.id)}
              onFocusCapture={() => selectPane(pane.id)}
            >
              <div className="scratch-pane-header">
                <span className="scratch-pane-label">栏 {index + 1}</span>
                <select
                  value={pane.language}
                  onChange={(e) => updatePane(pane.id, { language: e.target.value })}
                  aria-label={`栏 ${index + 1} 语言`}
                >
                  {LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>{option.value === 'auto' && pane.language === 'auto' ? `自动 · ${LANGUAGES.find((item) => item.value === detectedLanguages[`${activeDocument.id}/${pane.id}`])?.label ?? '纯文本'}` : option.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => copyPane(pane)}
                  className="btn-small"
                  disabled={!pane.content}
                  title={`复制栏 ${index + 1}`}
                >
                  复制
                </button>
                <EditorLanguageTools
                  binding={paneBindings[pane.id]}
                  language={detectedLanguages[`${activeDocument.id}/${pane.id}`]}
                  path={modelPath('scratch', activeDocument.id, pane.id)}
                  label={`栏 ${index + 1}`}
                />
                {panes.length > 1 && (
                  <button
                    onClick={() => removePane(pane.id)}
                    className="scratch-pane-close"
                    aria-label={`关闭栏 ${index + 1}`}
                    title={`关闭栏 ${index + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="scratch-pane-editor">
                <Editor
                  height="100%"
                  path={modelPath('scratch', activeDocument.id, pane.id)}
                  keepCurrentModel
                  onMount={(editor, monaco) => {
                    registerMonaco(monaco)
                    setPaneBindings((current) => ({ ...current, [pane.id]: { editor, monaco } }))
                  }}
                  language={detectedLanguages[`${activeDocument.id}/${pane.id}`]}
                  value={pane.content}
                  loading={editorLoading}
                  onChange={(value) => updatePane(pane.id, { content: value ?? '' })}
                  theme="vs-dark"
                  options={{
                    ...languageEditorOptions,
                    minimap: { enabled: false },
                    fontSize,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    ariaLabel: `临时文本栏 ${index + 1}`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {saveRequest && <SaveFileDialog {...saveRequest} onClose={() => setSaveRequest(null)} />}
    </ToolLayout>
  )
}

export default ScratchPad
