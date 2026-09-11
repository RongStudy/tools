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
import { detectFormat, type ContentFormat } from '../utils/detectFormat'
import { enhanceMermaidBlock } from '../utils/mermaidBlockViewer'
import {
  DEFAULT_MARKDOWN_CODE,
  getMermaidBlockSource,
  markdownExportBaseStyles,
  MARKDOWN_EXPORT_STYLES,
  removeMermaidBlockSource,
  renderMarkdown,
  type MarkdownLayout,
} from '../utils/markdownRenderer'
import './MermaidRenderer.css'

const MERMAID_DRAFT_KEY = 'dev-tools:mermaid-renderer:draft'
const RENDER_DELAY_MS = 300
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 25

type RenderMode = 'auto' | 'mermaid' | 'markdown'

const MODE_OPTIONS: Array<{ value: RenderMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'markdown', label: 'Markdown' },
]

const LAYOUT_OPTIONS: Array<{ value: MarkdownLayout; label: string; title: string }> = [
  { value: 'full', label: '铺满', title: '内容从左侧铺满显示' },
  { value: 'centered', label: '居中', title: '内容居中显示（限制最大宽度）' },
]

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
  if (!(error instanceof Error)) return '无法解析内容'

  return error.message
    .replace(/^Error:\s*/i, '')
    .replace(/\n+\s*at .*/s, '')
    .trim() || '无法解析内容'
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

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
  const [mode, setMode] = useState<RenderMode>('auto')
  const [markdownLayout, setMarkdownLayout] = useState<MarkdownLayout>('full')
  const [activeFormat, setActiveFormat] = useState<ContentFormat | null>(null)
  const [svg, setSvg] = useState('')
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const [isRendering, setIsRendering] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isDragging, setIsDragging] = useState(false)
  const previewDragRef = useRef<PreviewDrag | null>(null)
  const renderSequenceRef = useRef(0)
  const markdownMermaidSeqRef = useRef(0)
  const markdownPreviewRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const renderContent = useCallback(async (source: string) => {
    const sequence = ++renderSequenceRef.current

    if (!source.trim()) {
      setSvg('')
      setHtml('')
      setError('')
      setActiveFormat(null)
      setIsRendering(false)
      return
    }

    const format = mode === 'auto' ? detectFormat(source) : mode

    if (format === 'mermaid') {
      setActiveFormat('mermaid')
      setIsRendering(true)
      try {
        const mermaid = await loadMermaid()
        const result = await mermaid.render(`mermaid-diagram-${sequence}`, source)
        if (sequence !== renderSequenceRef.current) return

        setSvg(result.svg)
        setHtml('')
        setError('')
      } catch (renderError) {
        if (sequence !== renderSequenceRef.current) return

        setSvg('')
        setHtml('')
        setError(getErrorMessage(renderError))
      } finally {
        if (sequence === renderSequenceRef.current) {
          setIsRendering(false)
        }
      }
      return
    }

    setActiveFormat('markdown')
    setIsRendering(true)
    try {
      const result = renderMarkdown(source)
      if (sequence !== renderSequenceRef.current) return

      setHtml(result)
      setSvg('')
      setError('')
    } catch (renderError) {
      if (sequence !== renderSequenceRef.current) return

      setHtml('')
      setSvg('')
      setError(getErrorMessage(renderError))
    } finally {
      if (sequence === renderSequenceRef.current) {
        setIsRendering(false)
      }
    }
  }, [mode])

  useEffect(() => {
    writeExpiringStorage(MERMAID_DRAFT_KEY, code, TWO_DAYS_IN_MS)

    const timer = window.setTimeout(() => {
      void renderContent(code)
    }, RENDER_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [code, mode, renderContent])

  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  // Markdown 内容中的 mermaid 代码块：DOM 注入后逐个异步渲染为 SVG
  useEffect(() => {
    if (activeFormat !== 'markdown' || !html) return

    let cancelled = false

    const renderBlocks = async () => {
      const container = markdownPreviewRef.current
      if (!container) return

      const blocks = Array.from(container.querySelectorAll<HTMLElement>('.mermaid-block'))
      for (const block of blocks) {
        if (cancelled || block.querySelector('svg')) continue

        const source = getMermaidBlockSource(block.id)
        if (!source) continue

        try {
          const mermaid = await loadMermaid()
          const result = await mermaid.render(
            `markdown-mermaid-${++markdownMermaidSeqRef.current}`,
            source
          )
          if (cancelled) return
          // 注入 SVG 并增强为可缩放/拖动/全屏的视图
          block.innerHTML = result.svg
          block.classList.add('rendered')
          enhanceMermaidBlock(block)
        } catch (renderError) {
          if (cancelled) return
          block.innerHTML =
            '<div class="mermaid-inline-error" role="alert">' +
            '<strong>Mermaid 图表渲染失败</strong>' +
            `<pre>${escapeHtml(getErrorMessage(renderError))}</pre>` +
            '</div>'
        } finally {
          removeMermaidBlockSource(block.id)
        }
      }
    }

    void renderBlocks()
    return () => {
      cancelled = true
    }
  }, [activeFormat, html])

  const resetExample = () => {
    setCode(mode === 'markdown' || (mode === 'auto' && activeFormat === 'markdown')
      ? DEFAULT_MARKDOWN_CODE
      : DEFAULT_MERMAID_CODE)
  }

  const clearCode = () => {
    renderSequenceRef.current += 1
    setCode('')
    setSvg('')
    setHtml('')
    setError('')
    setActiveFormat(null)
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

  const downloadHtml = () => {
    // 优先导出实时渲染后的 DOM（含 mermaid 代码块渲染出的 SVG），回退到 html 状态
    const bodyContent = markdownPreviewRef.current?.innerHTML ?? html
    if (!bodyContent) return

    const content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Markdown 导出</title>
<style>${MARKDOWN_EXPORT_STYLES}${markdownExportBaseStyles(markdownLayout)}</style>
</head>
<body class="markdown-export-body">
<main class="markdown-export-main">${bodyContent}</main>
</body>
</html>`
    downloadBlob(new Blob([content], { type: 'text/html;charset=utf-8' }), 'markdown-export.html')
  }

  const formatLabel = activeFormat === 'mermaid'
    ? 'Mermaid'
    : activeFormat === 'markdown'
      ? 'Markdown'
      : ''

  const statusText = isRendering
    ? '渲染中'
    : error
      ? '语法错误'
      : activeFormat === 'mermaid' && svg
        ? `已渲染 ${formatLabel}`
        : activeFormat === 'markdown' && html
          ? `已渲染 ${formatLabel}`
          : '等待输入'

  const toolbar = (
    <div className="mermaid-toolbar">
      <div className="mermaid-mode-switch" role="group" aria-label="渲染格式">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`btn-small mode-button ${mode === option.value ? 'active' : ''}`}
            onClick={() => setMode(option.value)}
            aria-pressed={mode === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className={`mermaid-render-status ${error ? 'error' : ''}`} role="status">
        {statusText}
      </span>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void renderContent(code)}
        disabled={!code.trim() || isRendering}
      >
        渲染
      </button>
    </div>
  )

  return (
    <ToolLayout
      className={`mermaid-renderer ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title="Mermaid / Markdown 渲染"
      description="自动识别 Mermaid 或 Markdown 内容并实时渲染，支持 GFM 与 LaTeX 数学公式"
      actions={toolbar}
      hideHeader={isFullscreen}
    >
      <div className={`mermaid-workspace ${isFullscreen ? 'preview-is-fullscreen' : ''}`}>
        {!isFullscreen && (
          <div className="editor-panel mermaid-code-panel">
            <div className="panel-header">
              <span>内容</span>
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
                    () => void renderContent(editor.getValue())
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
                  ariaLabel: '内容编辑器',
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
              {activeFormat === 'mermaid' && (
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
              )}
              {activeFormat === 'mermaid' && (
                <>
                  <button type="button" className="btn-small" onClick={downloadSvg} disabled={!svg}>SVG</button>
                  <button type="button" className="btn-small" onClick={downloadPng} disabled={!svg}>PNG</button>
                </>
              )}
              {activeFormat === 'markdown' && (
                <div className="mermaid-layout-switch" role="group" aria-label="内容布局">
                  {LAYOUT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`btn-small mode-button ${markdownLayout === option.value ? 'active' : ''}`}
                      onClick={() => setMarkdownLayout(option.value)}
                      aria-pressed={markdownLayout === option.value}
                      title={option.title}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {activeFormat === 'markdown' && (
                <button type="button" className="btn-small" onClick={downloadHtml} disabled={!html}>HTML</button>
              )}
              <button
                type="button"
                className="btn-small btn-fullscreen"
                onClick={() => setIsFullscreen((value) => !value)}
                title={isFullscreen ? '退出全屏' : '全屏查看'}
              >
                {isFullscreen ? '⤓ 退出全屏' : '⛶ 全屏'}
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
              className={`mermaid-canvas ${activeFormat === 'markdown' ? 'has-markdown' : ''}`}
              data-testid="mermaid-canvas"
              style={svg ? { width: `${Math.max(100, zoom)}%` } : undefined}
            >
              {error ? (
                <div className="mermaid-error" role="alert">
                  <strong>无法渲染{formatLabel ? ` ${formatLabel}` : ''}内容</strong>
                  <pre>{error}</pre>
                </div>
              ) : activeFormat === 'markdown' ? (
                html ? (
                  <div
                    className={`markdown-preview layout-${markdownLayout}`}
                    data-testid="markdown-preview"
                    ref={markdownPreviewRef}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <div className="mermaid-empty">
                    {isRendering ? '正在渲染 Markdown...' : '输入 Markdown 内容后将在这里显示渲染结果'}
                  </div>
                )
              ) : activeFormat === 'mermaid' ? (
                svg ? (
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
                )
              ) : (
                <div className="mermaid-empty">
                  输入内容后将在这里显示渲染结果（自动识别 Mermaid / Markdown，支持 LaTeX 数学公式）
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
