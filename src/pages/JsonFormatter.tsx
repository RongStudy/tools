import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import SplitPaneDivider from '../components/SplitPaneDivider'
import {
  getSplitPaneGridStyle,
} from '../hooks/useSplitPane'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import ToolLayout from '../components/ToolLayout'
import SaveFileDialog, { type SaveFileRequest } from '../components/SaveFileDialog'
import JsonSchemaDialog from '../components/JsonSchemaDialog'
import { modelPath, useMonacoModels } from '../hooks/useMonacoModels'
import { languageEditorOptions } from '../monaco/languageCapabilities'
import { configureJsonSchemas } from '../monaco/jsonSchema'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import { useToast } from '../components/toastContext'
import { writeTextToClipboard } from '../utils/clipboard'
import { readExpiringStorage } from '../utils/expiringStorage'
import {
  createJsonDocument,
  DEFAULT_JSON_DOCUMENT,
  normalizeJsonDocument,
  type JsonDocument,
} from '../utils/jsonFormatter'
import { useDraftPersistence } from '../hooks/useDraftPersistence'
import { useJsonTasks } from '../hooks/useJsonTasks'
import type { JsonOperation } from '../utils/jsonText'
import type { MonacoEditor } from '../types/monaco'
import './JsonFormatter.css'
import '../styles/common.css'

const JSON_FORMATTER_DRAFT_KEY = 'dev-tools:json-formatter:draft'

type JsonFormatterDraft = {
  activeDocumentId: string
  documents: JsonDocument[]
  indentSize: number
}

type LegacyJsonFormatterDraft = {
  input: string
  output: string
  indentSize: number
}

const DEFAULT_JSON_FORMATTER_DRAFT: JsonFormatterDraft = {
  activeDocumentId: DEFAULT_JSON_DOCUMENT.id,
  documents: [DEFAULT_JSON_DOCUMENT],
  indentSize: 2,
}

const editorLoading = <div className="monaco-loading">编辑器加载中</div>

const readJsonFormatterDraft = (): JsonFormatterDraft => {
  const savedDraft = readExpiringStorage<unknown>(JSON_FORMATTER_DRAFT_KEY)
  if (!savedDraft || typeof savedDraft !== 'object') return DEFAULT_JSON_FORMATTER_DRAFT

  const draft = savedDraft as Partial<JsonFormatterDraft & LegacyJsonFormatterDraft>
  if (Array.isArray(draft.documents)) {
    const documents = draft.documents
      .map(normalizeJsonDocument)
      .filter((document): document is JsonDocument => document !== null)
    const activeDocumentId = documents.some((document) => document.id === draft.activeDocumentId)
      ? draft.activeDocumentId as string
      : documents[0]?.id

    if (documents.length && activeDocumentId && typeof draft.indentSize === 'number') {
      return { activeDocumentId, documents, indentSize: draft.indentSize }
    }
  }

  if (typeof draft.input === 'string' && typeof draft.output === 'string' && typeof draft.indentSize === 'number') {
    return {
      activeDocumentId: DEFAULT_JSON_DOCUMENT.id,
      documents: [{ ...DEFAULT_JSON_DOCUMENT, input: draft.input, output: draft.output }],
      indentSize: draft.indentSize,
    }
  }

  return DEFAULT_JSON_FORMATTER_DRAFT
}

const JsonFormatter = () => {
  const [initialDraft] = useState(readJsonFormatterDraft)
  const [documents, setDocuments] = useState(initialDraft.documents)
  const [activeDocumentId, setActiveDocumentId] = useState(initialDraft.activeDocumentId)
  const [indentSize, setIndentSize] = useState(initialDraft.indentSize)
  const [fullscreenMode, setFullscreenMode] = useState<'none' | 'output' | 'both'>('none')
  const [saveRequest, setSaveRequest] = useState<SaveFileRequest | null>(null)
  const [showSchema, setShowSchema] = useState(false)
  const [monacoMounted, setMonacoMounted] = useState(false)
  const [diagnostics, setDiagnostics] = useState<{ path: string; markers: MonacoEditorNamespace.IMarker[] }>({ path: '', markers: [] })
  const editorRef = useRef<MonacoEditor | null>(null)
  const outputEditorRef = useRef<MonacoEditor | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const { showToast } = useToast()
  const isOutputFullscreen = fullscreenMode === 'output'
  const isDualFullscreen = fullscreenMode === 'both'
  const isFullscreen = fullscreenMode !== 'none'
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]
  const { input, output, error, splitRatio } = activeDocument
  const editorGridStyle = getSplitPaneGridStyle(splitRatio)
  const inputPath = modelPath('json', activeDocument.id, 'input.json')
  const registerMonaco = useMonacoModels(documents.flatMap(({ id }) => [modelPath('json', id, 'input.json'), modelPath('json', id, 'output.json')]))
  const schemaDocuments = JSON.stringify(documents.map(({ id, schema }) => ({ path: modelPath('json', id, 'input.json'), schema })))

  useEffect(() => {
    if (!monacoMounted) return
    let cancelled = false
    void import('monaco-editor/languages/features/json/register').then(({ jsonDefaults }) => {
      if (!cancelled) configureJsonSchemas(jsonDefaults, JSON.parse(schemaDocuments))
    })
    return () => { cancelled = true }
  }, [monacoMounted, schemaDocuments])

  const handleValidate = useCallback((markers: MonacoEditorNamespace.IMarker[]) => {
    const path = editorRef.current?.getModel()?.uri.toString() ?? ''
    setDiagnostics({ path, markers })
  }, [])

  const draft = useMemo(() => ({ activeDocumentId, documents, indentSize }), [activeDocumentId, documents, indentSize])
  useDraftPersistence(JSON_FORMATTER_DRAFT_KEY, draft)
  const { process, cancel, busyIds } = useJsonTasks()

  useEffect(() => {
    // A page may have closed while its worker was still running. Resume those previews.
    initialDraft.documents.filter((document) => document.input && !document.output && !document.error).forEach((document) => {
      process(document.id, document.input, 'format', initialDraft.indentSize, (result) => {
        setDocuments((current) => current.map((item) => (
          item.id === document.id && item.input === document.input ? { ...item, ...result } : item
        )))
      })
    })
  }, [initialDraft, process])

  const exitFullscreen = useCallback(() => {
    setFullscreenMode('none')
  }, [])

  const toggleOutputFullscreen = useCallback(() => {
    setFullscreenMode((currentMode) => currentMode === 'none' ? 'output' : 'none')
  }, [])

  const toggleDualFullscreen = useCallback(() => {
    setFullscreenMode((currentMode) => currentMode === 'none' ? 'both' : 'none')
  }, [])

  useEscapeToClose(isFullscreen, exitFullscreen)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      editorRef.current?.layout()
      outputEditorRef.current?.layout()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activeDocumentId, error, fullscreenMode, splitRatio])

  const updateActiveDocument = (updates: Partial<Pick<JsonDocument, 'input' | 'output' | 'error' | 'splitRatio' | 'schema'>>) => {
    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.id === activeDocumentId ? { ...document, ...updates } : document
    )))
  }

  const processInput = (text: string, operation: JsonOperation, nextIndentSize = indentSize, debounce = false) => {
    const documentId = activeDocumentId
    updateActiveDocument({ input: text, output: '', error: '' })
    process(documentId, text, operation, nextIndentSize, (result) => {
      setDocuments((current) => current.map((document) => (
        document.id === documentId && document.input === text ? { ...document, ...result } : document
      )))
    }, debounce)
  }
  const formatJson = () => processInput(input, 'format')
  const compressJson = () => processInput(input, 'compress')
  const escapeJson = () => processInput(input, 'escape')
  const unescapeJsonAction = () => processInput(input, 'unescape')
  const handleInputChange = (value: string | undefined, nextIndentSize = indentSize) => {
    processInput(value ?? '', 'format', nextIndentSize, true)
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    const success = await writeTextToClipboard(text)
    if (success) {
      showToast('已复制到剪贴板')
    } else {
      showToast('复制失败', 'error')
    }
  }

  // 清空内容
  const clearAll = () => {
    cancel(activeDocumentId)
    updateActiveDocument({ input: '', output: '', error: '' })
  }

  const addDocument = () => {
    const document = createJsonDocument(documents)
    setDocuments((currentDocuments) => [...currentDocuments, document])
    setActiveDocumentId(document.id)
  }

  const closeDocument = (documentId: string) => {
    cancel(documentId)
    if (documents.length === 1) {
      clearAll()
      return
    }

    const currentIndex = documents.findIndex((document) => document.id === documentId)
    const nextActiveDocument = documents[currentIndex + 1] ?? documents[currentIndex - 1]
    setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== documentId))
    if (documentId === activeDocumentId) {
      setActiveDocumentId(nextActiveDocument.id)
    }
  }

  const toolbar = (
    <div className="toolbar">
      <div className="indent-control">
        <label htmlFor="json-indent-size">缩进:</label>
        <select
          id="json-indent-size"
          name="jsonIndentSize"
          value={indentSize}
          onChange={(e) => {
            const newSize = Number(e.target.value)
            setIndentSize(newSize)
            if (input.trim()) {
              handleInputChange(input, newSize)
            }
          }}
        >
          <option value={2}>2 空格</option>
          <option value={4}>4 空格</option>
          <option value={0}>无缩进</option>
        </select>
      </div>
      <button onClick={formatJson} className="btn btn-primary">格式化</button>
      <button onClick={compressJson} className="btn btn-secondary">压缩</button>
      <button onClick={escapeJson} className="btn btn-secondary">转义</button>
      <button onClick={unescapeJsonAction} className="btn btn-secondary">解转义</button>
      <button onClick={() => setShowSchema(true)} className="btn btn-secondary" aria-pressed={Boolean(activeDocument.schema)}>Schema{activeDocument.schema ? ' · 已启用' : ''}</button>
      <button onClick={clearAll} className="btn btn-danger">清空</button>
    </div>
  )

  const firstDiagnostic = diagnostics.path === inputPath ? diagnostics.markers[0] : undefined
  const status = error || firstDiagnostic ? (
    <div className="error-message">
      <span className="error-icon">!</span>
      {error || firstDiagnostic?.message}
      {firstDiagnostic && <button type="button" className="btn-small" onClick={() => {
        editorRef.current?.setPosition({ lineNumber: firstDiagnostic.startLineNumber, column: firstDiagnostic.startColumn })
        editorRef.current?.revealLineInCenter(firstDiagnostic.startLineNumber)
        editorRef.current?.focus()
      }}>定位 {firstDiagnostic.startLineNumber}:{firstDiagnostic.startColumn}</button>}
    </div>
  ) : null

  return (
    <ToolLayout
      className={`json-formatter ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title="JSON格式化工具"
      description="格式化、压缩、转义和解转义 JSON 内容"
      actions={toolbar}
      status={status}
      hideHeader={isFullscreen}
    >
      {!isFullscreen && (
        <div className="json-document-tabs" role="tablist" aria-label="JSON 文档">
          <div className="json-document-tab-list">
            {documents.map((document) => (
              <div className="json-document-tab" key={document.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={document.id === activeDocumentId}
                  className={`json-document-tab-button ${document.id === activeDocumentId ? 'is-active' : ''}`}
                  onClick={() => setActiveDocumentId(document.id)}
                >
                  {document.name}
                </button>
                {documents.length > 1 && (
                  <button
                    type="button"
                    className="json-document-tab-close"
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
          <button type="button" className="btn-small json-document-add" onClick={addDocument}>
            新建 JSON
          </button>
        </div>
      )}
      <div
        ref={editorContainerRef}
        data-testid="json-editor-container"
        className={`editor-container ${isOutputFullscreen ? 'fullscreen-container' : ''} ${isDualFullscreen ? 'dual-fullscreen-container' : ''}`}
        style={editorGridStyle}
      >
        {!isOutputFullscreen && (
          <div className={`editor-panel ${isDualFullscreen ? 'fullscreen-panel' : ''}`}>
            <div className="panel-header">
              <span>输入</span>
              <div className="panel-actions">
                <button
                  onClick={() => copyToClipboard(input)}
                  className="btn-small"
                  disabled={!input}
                >
                  复制
                </button>
                <button
                  onClick={toggleDualFullscreen}
                  className="btn-small btn-fullscreen"
                  title={isDualFullscreen ? '退出全屏' : '输入输出全屏'}
                >
                  {isDualFullscreen ? '⤓ 退出全屏' : '⛶ 全屏'}
                </button>
              </div>
            </div>
            <div className="json-editor-body">
              <Editor
                height="100%"
                defaultLanguage="json"
                path={inputPath}
                keepCurrentModel
                value={input}
                loading={editorLoading}
                onChange={(value) => handleInputChange(value)}
                onValidate={handleValidate}
                theme="vs-dark"
                options={{
                  ...languageEditorOptions,
                  minimap: { enabled: false },
                  fontSize: isDualFullscreen ? 16 : 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  fixedOverflowWidgets: true,
                  scrollBeyondLastLine: false,
                  ariaLabel: 'JSON 输入',
                }}
                onMount={(editor, monaco) => {
                  editorRef.current = editor
                  registerMonaco(monaco)
                  setMonacoMounted(true)
                }}
              />
            </div>
          </div>
        )}

        {!isOutputFullscreen && (
          <SplitPaneDivider
            containerRef={editorContainerRef}
            ratio={splitRatio}
            onRatioChange={(nextRatio) => updateActiveDocument({ splitRatio: nextRatio })}
            label="调整输入输出宽度"
          />
        )}

        <div className={`editor-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}>
          <div className="panel-header">
            <span>输出{busyIds.includes(activeDocumentId) && <span role="status"> · 处理中…</span>}</span>
            <div className="panel-actions">
              <button
                type="button"
                className="btn-small"
                disabled={!output}
                onClick={() => setSaveRequest({ content: output, defaultFilename: `${activeDocument.name}.json`, mimeType: 'application/json;charset=utf-8' })}
              >
                保存到文件
              </button>
              <button
                onClick={() => copyToClipboard(output)}
                className="btn-small"
                disabled={!output}
              >
                复制
              </button>
              <button
                onClick={toggleOutputFullscreen}
                className="btn-small btn-fullscreen"
                title={isFullscreen ? '退出全屏' : '全屏查看'}
              >
                {isFullscreen ? '⤓ 退出全屏' : '⛶ 全屏'}
              </button>
            </div>
          </div>
          <div className="json-editor-body">
            <Editor
              height="100%"
              defaultLanguage="json"
              path={modelPath('json', activeDocument.id, 'output.json')}
              keepCurrentModel
              value={output}
              loading={editorLoading}
              theme="vs-dark"
              options={{
                minimap: { enabled: !isFullscreen },
                fontSize: isFullscreen ? 16 : 14,
                wordWrap: 'on',
                automaticLayout: true,
                fixedOverflowWidgets: true,
                scrollBeyondLastLine: false,
                readOnly: true,
                ariaLabel: 'JSON 输出',
                guides: {
                  bracketPairs: 'active',
                  bracketPairsHorizontal: 'active',
                },
                bracketPairColorization: { enabled: true },
              }}
              onMount={(editor, monaco) => {
                outputEditorRef.current = editor
                registerMonaco(monaco)
              }}
            />
          </div>
        </div>
      </div>
      {saveRequest && <SaveFileDialog {...saveRequest} onClose={() => setSaveRequest(null)} />}
      {showSchema && <JsonSchemaDialog value={activeDocument.schema} onSave={(schema) => updateActiveDocument({ schema })} onClose={() => setShowSchema(false)} />}
    </ToolLayout>
  )
}

export default JsonFormatter
