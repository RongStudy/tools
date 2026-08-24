import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { writeTextToClipboard } from '../utils/clipboard'
import { readExpiringStorage, writeExpiringStorage, TWO_DAYS_IN_MS } from '../utils/expiringStorage'
import type { MonacoEditor } from '../types/monaco'
import './JsonFormatter.css'
import '../styles/common.css'

const JSON_FORMATTER_DRAFT_KEY = 'dev-tools:json-formatter:draft'

type JsonDocument = {
  id: string
  name: string
  input: string
  output: string
  error: string
}

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

const DEFAULT_JSON_DOCUMENT: JsonDocument = {
  id: 'json-1',
  name: 'JSON 1',
  input: '',
  output: '',
  error: '',
}

const DEFAULT_JSON_FORMATTER_DRAFT: JsonFormatterDraft = {
  activeDocumentId: DEFAULT_JSON_DOCUMENT.id,
  documents: [DEFAULT_JSON_DOCUMENT],
  indentSize: 2,
}

const editorLoading = <div className="monaco-loading">编辑器加载中</div>

const createJsonDocument = (documents: JsonDocument[]): JsonDocument => {
  const highestDocumentNumber = documents.reduce((highest, document) => {
    const match = /^JSON (\d+)$/.exec(document.name)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  const nextDocumentNumber = highestDocumentNumber + 1

  return {
    id: `json-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: `JSON ${nextDocumentNumber}`,
    input: '',
    output: '',
    error: '',
  }
}

const isJsonDocument = (value: unknown): value is JsonDocument => {
  if (!value || typeof value !== 'object') return false

  const document = value as Partial<JsonDocument>
  return typeof document.id === 'string'
    && typeof document.name === 'string'
    && typeof document.input === 'string'
    && typeof document.output === 'string'
    && typeof document.error === 'string'
}

const readJsonFormatterDraft = (): JsonFormatterDraft => {
  const savedDraft = readExpiringStorage<unknown>(JSON_FORMATTER_DRAFT_KEY)
  if (!savedDraft || typeof savedDraft !== 'object') return DEFAULT_JSON_FORMATTER_DRAFT

  const draft = savedDraft as Partial<JsonFormatterDraft & LegacyJsonFormatterDraft>
  if (Array.isArray(draft.documents)) {
    const documents = draft.documents.filter(isJsonDocument)
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
  const editorRef = useRef<MonacoEditor | null>(null)
  const outputEditorRef = useRef<MonacoEditor | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const outputPanelRef = useRef<HTMLDivElement>(null)

  const { showToast } = useToast()
  const isOutputFullscreen = fullscreenMode === 'output'
  const isDualFullscreen = fullscreenMode === 'both'
  const isFullscreen = fullscreenMode !== 'none'
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]
  const { input, output, error } = activeDocument

  useEffect(() => {
    writeExpiringStorage(
      JSON_FORMATTER_DRAFT_KEY,
      { activeDocumentId, documents, indentSize },
      TWO_DAYS_IN_MS
    )
  }, [activeDocumentId, documents, indentSize])

  const enterFullscreen = useCallback(async (element: HTMLElement | null, mode: 'output' | 'both') => {
    if (!element) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.()
      }
      if (element.requestFullscreen) {
        await element.requestFullscreen()
        setFullscreenMode(mode)
      }
    } catch (err) {
      console.error('全屏操作失败:', err)
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen()
      }
      setFullscreenMode('none')
    } catch (err) {
      console.error('退出全屏失败:', err)
    }
  }, [])

  const toggleOutputFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen()
      return
    }
    await enterFullscreen(outputPanelRef.current, 'output')
  }, [enterFullscreen, exitFullscreen, isFullscreen])

  const toggleDualFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen()
      return
    }
    await enterFullscreen(editorContainerRef.current, 'both')
  }, [enterFullscreen, exitFullscreen, isFullscreen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement
      if (!fullscreenElement) {
        setFullscreenMode('none')
      } else if (fullscreenElement === editorContainerRef.current) {
        setFullscreenMode('both')
      } else if (fullscreenElement === outputPanelRef.current) {
        setFullscreenMode('output')
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      editorRef.current?.layout()
      outputEditorRef.current?.layout()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activeDocumentId, error, fullscreenMode])

  // 多层嵌套转义JSON的解转义
  const unescapeJson = useMemo(() => (str: string): string => {
    let result = str
    let previousResult = ''

    // 循环解转义，直到没有变化为止
    while (result !== previousResult) {
      previousResult = result
      try {
        const parsed = JSON.parse(result)
        if (typeof parsed === 'string') {
          result = parsed
        } else {
          break
        }
      } catch {
        result = result
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
      }
    }

    return result
  }, [])

  const formatJsonString = (value: string, size: number): string => {
    let jsonStr = value.trim()
    jsonStr = unescapeJson(jsonStr)
    const jsonObj = JSON.parse(jsonStr)
    return JSON.stringify(jsonObj, null, size)
  }

  const updateActiveDocument = (updates: Partial<Pick<JsonDocument, 'input' | 'output' | 'error'>>) => {
    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.id === activeDocumentId ? { ...document, ...updates } : document
    )))
  }

  // 格式化JSON
  const formatJson = () => {
    try {
      const jsonStr = input.trim()

      if (!jsonStr) {
        updateActiveDocument({ output: '', error: '' })
        return
      }

      updateActiveDocument({ output: formatJsonString(jsonStr, indentSize), error: '' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      updateActiveDocument({ error: `格式错误: ${message}`, output: '' })
    }
  }

  // 压缩JSON
  const compressJson = () => {
    try {
      let jsonStr = input.trim()

      if (!jsonStr) {
        updateActiveDocument({ output: '', error: '' })
        return
      }

      jsonStr = unescapeJson(jsonStr)
      const jsonObj = JSON.parse(jsonStr)
      const compressed = JSON.stringify(jsonObj)
      updateActiveDocument({ output: compressed, error: '' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      updateActiveDocument({ error: `格式错误: ${message}`, output: '' })
    }
  }

  // 转义JSON
  const escapeJson = () => {
    try {
      const jsonStr = input.trim()

      if (!jsonStr) {
        updateActiveDocument({ output: '', error: '' })
        return
      }

      const escaped = JSON.stringify(jsonStr)
      updateActiveDocument({ output: escaped, error: '' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      updateActiveDocument({ error: `处理错误: ${message}`, output: '' })
    }
  }

  // 解转义JSON
  const unescapeJsonAction = () => {
    try {
      const jsonStr = input.trim()

      if (!jsonStr) {
        updateActiveDocument({ output: '', error: '' })
        return
      }

      const unescaped = unescapeJson(jsonStr)
      updateActiveDocument({ output: unescaped, error: '' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      updateActiveDocument({ error: `处理错误: ${message}`, output: '' })
    }
  }

  // 实时预览
  const handleInputChange = (value: string | undefined, nextIndentSize = indentSize) => {
    const newValue = value || ''

    if (newValue.trim()) {
      try {
        updateActiveDocument({
          input: newValue,
          output: formatJsonString(newValue, nextIndentSize),
          error: '',
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        updateActiveDocument({ input: newValue, error: `格式错误: ${message}`, output: '' })
      }
    } else {
      updateActiveDocument({ input: '', output: '', error: '' })
    }
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
    updateActiveDocument({ input: '', output: '', error: '' })
  }

  const addDocument = () => {
    const document = createJsonDocument(documents)
    setDocuments((currentDocuments) => [...currentDocuments, document])
    setActiveDocumentId(document.id)
  }

  const closeDocument = (documentId: string) => {
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
      <button onClick={clearAll} className="btn btn-danger">清空</button>
    </div>
  )

  const status = error ? (
    <div className="error-message">
      <span className="error-icon">!</span>
      {error}
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
                value={input}
                loading={editorLoading}
                onChange={(value) => handleInputChange(value)}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: isDualFullscreen ? 16 : 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
                onMount={(editor) => {
                  editorRef.current = editor
                }}
              />
            </div>
          </div>
        )}

        <div
          ref={outputPanelRef}
          className={`editor-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
        >
          <div className="panel-header">
            <span>输出</span>
            <div className="panel-actions">
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
              value={output}
              loading={editorLoading}
              theme="vs-dark"
              options={{
                minimap: { enabled: !isFullscreen },
                fontSize: isFullscreen ? 16 : 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                readOnly: true,
              }}
              onMount={(editor) => {
                outputEditorRef.current = editor
              }}
            />
          </div>
        </div>
      </div>
    </ToolLayout>
  )
}

export default JsonFormatter
