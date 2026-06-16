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

type JsonFormatterDraft = {
  input: string
  output: string
  indentSize: number
}

const DEFAULT_JSON_FORMATTER_DRAFT: JsonFormatterDraft = {
  input: '',
  output: '',
  indentSize: 2,
}

const editorLoading = <div className="monaco-loading">编辑器加载中</div>

const JsonFormatter = () => {
  const [initialDraft] = useState(() => (
    readExpiringStorage<JsonFormatterDraft>(JSON_FORMATTER_DRAFT_KEY) ?? DEFAULT_JSON_FORMATTER_DRAFT
  ))
  const [input, setInput] = useState(initialDraft.input)
  const [output, setOutput] = useState(initialDraft.output)
  const [error, setError] = useState('')
  const [indentSize, setIndentSize] = useState(initialDraft.indentSize)
  const [fullscreenMode, setFullscreenMode] = useState<'none' | 'output' | 'both'>('none')
  const editorRef = useRef<MonacoEditor | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const outputPanelRef = useRef<HTMLDivElement>(null)

  const { showToast } = useToast()
  const isOutputFullscreen = fullscreenMode === 'output'
  const isDualFullscreen = fullscreenMode === 'both'
  const isFullscreen = fullscreenMode !== 'none'

  useEffect(() => {
    writeExpiringStorage(
      JSON_FORMATTER_DRAFT_KEY,
      { input, output, indentSize },
      TWO_DAYS_IN_MS
    )
  }, [input, output, indentSize])

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

  // 格式化JSON
  const formatJson = () => {
    try {
      setError('')
      const jsonStr = input.trim()

      if (!jsonStr) {
        setOutput('')
        return
      }

      setOutput(formatJsonString(jsonStr, indentSize))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`格式错误: ${message}`)
      setOutput('')
    }
  }

  // 压缩JSON
  const compressJson = () => {
    try {
      setError('')
      let jsonStr = input.trim()

      if (!jsonStr) {
        setOutput('')
        return
      }

      jsonStr = unescapeJson(jsonStr)
      const jsonObj = JSON.parse(jsonStr)
      const compressed = JSON.stringify(jsonObj)
      setOutput(compressed)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`格式错误: ${message}`)
      setOutput('')
    }
  }

  // 转义JSON
  const escapeJson = () => {
    try {
      setError('')
      const jsonStr = input.trim()

      if (!jsonStr) {
        setOutput('')
        return
      }

      const escaped = JSON.stringify(jsonStr)
      setOutput(escaped)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`处理错误: ${message}`)
      setOutput('')
    }
  }

  // 解转义JSON
  const unescapeJsonAction = () => {
    try {
      setError('')
      const jsonStr = input.trim()

      if (!jsonStr) {
        setOutput('')
        return
      }

      const unescaped = unescapeJson(jsonStr)
      setOutput(unescaped)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`处理错误: ${message}`)
      setOutput('')
    }
  }

  // 实时预览
  const handleInputChange = (value: string | undefined, nextIndentSize = indentSize) => {
    const newValue = value || ''
    setInput(newValue)

    if (newValue.trim()) {
      try {
        setOutput(formatJsonString(newValue, nextIndentSize))
        setError('')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`格式错误: ${message}`)
        setOutput('')
      }
    } else {
      setOutput('')
      setError('')
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
    setInput('')
    setOutput('')
    setError('')
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
            <Editor
              height={isDualFullscreen ? 'calc(100vh - 60px)' : '100%'}
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
          <Editor
            height={isFullscreen ? 'calc(100vh - 60px)' : '100%'}
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
          />
        </div>
      </div>
    </ToolLayout>
  )
}

export default JsonFormatter
