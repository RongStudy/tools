import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import Editor from '@monaco-editor/react'
import ToolLayout from '../components/ToolLayout'
import { readExpiringStorage, TWO_DAYS_IN_MS, writeExpiringStorage } from '../utils/expiringStorage'
import './MermaidRenderer.css'

const MERMAID_DRAFT_KEY = 'dev-tools:mermaid-renderer:draft'
const RENDER_DELAY_MS = 300
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 25

type PreviewDrag = {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}

export const DEFAULT_MERMAID_CODE = `flowchart LR
  A[输入 Mermaid 代码] --> B{语法正确?}
  B -->|是| C[渲染 SVG 图表]
  B -->|否| D[显示错误信息]
  D --> A`

let mermaidPromise: Promise<typeof import('mermaid')['default']> | null = null

const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark',
        suppressErrorRendering: true,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        themeVariables: {
          background: '#0f1011',
          primaryColor: '#18191a',
          primaryTextColor: '#f7f8f8',
          primaryBorderColor: '#5e6ad2',
          lineColor: '#8a8f98',
          secondaryColor: '#141516',
          tertiaryColor: '#191a1b',
        },
      })
      return mermaid
    })
  }

  return mermaidPromise
}

const editorLoading = <div className="monaco-loading">编辑器加载中</div>

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return '无法解析 Mermaid 代码'

  return error.message
    .replace(/^Error:\s*/i, '')
    .replace(/\n+\s*at .*/s, '')
    .trim() || '无法解析 Mermaid 代码'
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const MermaidRenderer = () => {
  const [initialCode] = useState(() => (
    readExpiringStorage<string>(MERMAID_DRAFT_KEY) ?? DEFAULT_MERMAID_CODE
  ))
  const [code, setCode] = useState(initialCode)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [isRendering, setIsRendering] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isDragging, setIsDragging] = useState(false)
  const previewDragRef = useRef<PreviewDrag | null>(null)
  const renderSequenceRef = useRef(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const renderDiagram = useCallback(async (source: string) => {
    const sequence = ++renderSequenceRef.current

    if (!source.trim()) {
      setSvg('')
      setError('')
      setIsRendering(false)
      return
    }

    setIsRendering(true)
    try {
      const mermaid = await loadMermaid()
      const result = await mermaid.render(`mermaid-diagram-${sequence}`, source)
      if (sequence !== renderSequenceRef.current) return

      setSvg(result.svg)
      setError('')
    } catch (renderError) {
      if (sequence !== renderSequenceRef.current) return

      setSvg('')
      setError(getErrorMessage(renderError))
    } finally {
      if (sequence === renderSequenceRef.current) {
        setIsRendering(false)
      }
    }
  }, [])

  useEffect(() => {
    writeExpiringStorage(MERMAID_DRAFT_KEY, code, TWO_DAYS_IN_MS)

    const timer = window.setTimeout(() => {
      void renderDiagram(code)
    }, RENDER_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [code, renderDiagram])

  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  const resetExample = () => {
    setCode(DEFAULT_MERMAID_CODE)
  }

  const clearCode = () => {
    renderSequenceRef.current += 1
    setCode('')
    setSvg('')
    setError('')
    setIsRendering(false)
    setZoom(100)
  }

  const zoomOut = () => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))
  const zoomIn = () => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))

  const startPreviewDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!svg || event.button !== 0 || (event.pointerType === 'touch')) return

    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setIsDragging(true)
    event.preventDefault()
  }

  const movePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = previewDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.currentTarget.scrollLeft = drag.scrollLeft + drag.startX - event.clientX
    event.currentTarget.scrollTop = drag.scrollTop + drag.startY - event.clientY
    event.preventDefault()
  }

  const stopPreviewDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = previewDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    previewDragRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
  }

  const downloadSvg = () => {
    if (!svg) return

    const content = `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`
    downloadBlob(new Blob([content], { type: 'image/svg+xml;charset=utf-8' }), 'mermaid-diagram.svg')
  }

  const downloadPng = () => {
    if (!svg) return

    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const image = new Image()

    image.onload = () => {
      const scale = 2
      const width = Math.max(1, image.naturalWidth || image.width)
      const height = Math.max(1, image.naturalHeight || image.height)
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale

      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        return
      }

      context.fillStyle = '#0f1011'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, 'mermaid-diagram.png')
        URL.revokeObjectURL(url)
      }, 'image/png')
    }

    image.onerror = () => URL.revokeObjectURL(url)
    image.src = url
  }

  const toolbar = (
    <div className="mermaid-toolbar">
      <span className={`mermaid-render-status ${error ? 'error' : ''}`} role="status">
        {isRendering ? '渲染中' : error ? '语法错误' : svg ? '已渲染' : '等待输入'}
      </span>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void renderDiagram(code)}
        disabled={!code.trim() || isRendering}
      >
        渲染
      </button>
    </div>
  )

  return (
    <ToolLayout
      className={`mermaid-renderer ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title="Mermaid 渲染"
      description="输入 Mermaid 代码，实时生成并导出图表"
      actions={toolbar}
      hideHeader={isFullscreen}
    >
      <div className={`mermaid-workspace ${isFullscreen ? 'preview-is-fullscreen' : ''}`}>
        {!isFullscreen && (
          <div className="editor-panel mermaid-code-panel">
            <div className="panel-header">
              <span>Mermaid 代码</span>
              <div className="panel-actions">
                <button type="button" className="btn-small" onClick={resetExample}>示例</button>
                <button type="button" className="btn-small" onClick={clearCode} disabled={!code}>清空</button>
              </div>
            </div>
            <div className="mermaid-editor-body">
              <Editor
                height="100%"
                defaultLanguage="markdown"
                value={code}
                loading={editorLoading}
                onChange={(value) => setCode(value ?? '')}
                onMount={(editor, monaco) => {
                  editor.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                    () => void renderDiagram(editor.getValue())
                  )
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbersMinChars: 3,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 12 },
                }}
              />
            </div>
          </div>
        )}

        <div
          className={`editor-panel mermaid-preview-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          data-testid="mermaid-preview"
        >
          <div className="panel-header">
            <span>预览</span>
            <div className="panel-actions">
              <div className="mermaid-zoom-controls" role="group" aria-label="图表缩放">
                <button
                  type="button"
                  className="btn-small mermaid-zoom-button"
                  onClick={zoomOut}
                  disabled={!svg || zoom <= MIN_ZOOM}
                  aria-label="缩小图表"
                  title="缩小"
                >
                  −
                </button>
                <button
                  type="button"
                  className="btn-small mermaid-zoom-value"
                  onClick={() => setZoom(100)}
                  disabled={!svg || zoom === 100}
                  aria-label={`重置图表缩放，当前 ${zoom}%`}
                  title="重置为 100%"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  className="btn-small mermaid-zoom-button"
                  onClick={zoomIn}
                  disabled={!svg || zoom >= MAX_ZOOM}
                  aria-label="放大图表"
                  title="放大"
                >
                  +
                </button>
              </div>
              <button type="button" className="btn-small" onClick={downloadSvg} disabled={!svg}>SVG</button>
              <button type="button" className="btn-small" onClick={downloadPng} disabled={!svg}>PNG</button>
              <button
                type="button"
                className="btn-small btn-fullscreen"
                onClick={() => setIsFullscreen((value) => !value)}
                title={isFullscreen ? '退出全屏' : '全屏查看'}
              >
                {isFullscreen ? '退出全屏' : '全屏'}
              </button>
            </div>
          </div>
          <div
            className={`mermaid-preview-body ${svg ? 'has-diagram' : ''} ${isDragging ? 'is-dragging' : ''}`}
            data-testid="mermaid-preview-body"
            onPointerDown={startPreviewDrag}
            onPointerMove={movePreview}
            onPointerUp={stopPreviewDrag}
            onPointerCancel={stopPreviewDrag}
            onLostPointerCapture={stopPreviewDrag}
            onDragStart={(event) => event.preventDefault()}
          >
            <div
              className="mermaid-canvas"
              data-testid="mermaid-canvas"
              style={svg ? { width: `${Math.max(100, zoom)}%` } : undefined}
            >
              {error ? (
                <div className="mermaid-error" role="alert">
                  <strong>无法渲染图表</strong>
                  <pre>{error}</pre>
                </div>
              ) : svg ? (
                <div
                  className="mermaid-diagram"
                  role="img"
                  aria-label="Mermaid 图表预览"
                  style={{
                    width: `${Math.min(100, zoom)}%`,
                    maxWidth: `${48 * zoom / 100}rem`,
                  } as CSSProperties}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <div className="mermaid-empty">
                  {isRendering ? '正在生成图表...' : '输入 Mermaid 代码后将在这里显示图表'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  )
}

export default MermaidRenderer
