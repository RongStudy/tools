import { t, useLocale } from '../i18n'
import EditorStatusBar from '../components/EditorStatusBar'
import { useDraftPersistence } from '../hooks/useDraftPersistence'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import Editor from '@monaco-editor/react'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import SplitPaneDivider from '../components/SplitPaneDivider'
import {
  getSplitPaneGridStyle,
  usePersistentSplitRatio,
} from '../hooks/useSplitPane'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useToast } from '../components/toastContext'
import ToolLayout from '../components/ToolLayout'
import ToolOptions from '../components/ToolOptions'
import { useAppTheme, type AppTheme } from '../themeContext'
import { readExpiringStorage } from '../utils/expiringStorage'
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
const MERMAID_SPLIT_RATIO_KEY = 'dev-tools:mermaid-renderer:split-ratio'
const RENDER_DELAY_MS = 300
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 25
const SUPPORTED_TEXT_FILE = /\.(?:md|markdown|mmd|mermaid|txt)$/i

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
  A[Enter Mermaid code] --> B{Valid syntax?}
  B -->|Yes| C[Render SVG diagram]
  B -->|No| D[Show error]
  D --> A`

let mermaidPromise: Promise<typeof import('mermaid')['default']> | null = null
let initializedMermaidTheme: AppTheme | null = null

const loadMermaid = async (theme: AppTheme) => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => mermaid)
  }

  const mermaid = await mermaidPromise
  if (initializedMermaidTheme !== theme) {
    const light = theme === 'light'
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: light ? 'default' : 'dark',
      suppressErrorRendering: true,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      themeVariables: light ? {
        background: '#ffffff',
        primaryColor: '#eef1f5',
        primaryTextColor: '#20232b',
        primaryBorderColor: '#4f5bc3',
        lineColor: '#5d6572',
        secondaryColor: '#f1f3f6',
        tertiaryColor: '#ffffff',
      } : {
        background: '#0f1011',
        primaryColor: '#18191a',
        primaryTextColor: '#f7f8f8',
        primaryBorderColor: '#5e6ad2',
        lineColor: '#8a8f98',
        secondaryColor: '#141516',
        tertiaryColor: '#191a1b',
      },
    })
    initializedMermaidTheme = theme
  }
  return mermaid
}

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return t("无法解析内容")

  return error.message
    .replace(/^Error:\s*/i, '')
    .replace(/\n+\s*at .*/s, '')
    .trim() || t("无法解析内容")
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
  const locale = useLocale()
  const { theme, monacoTheme } = useAppTheme()
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
  const [splitRatio, setSplitRatio] = usePersistentSplitRatio(MERMAID_SPLIT_RATIO_KEY)
  const previewDragRef = useRef<PreviewDrag | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileReadSequenceRef = useRef(0)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const renderSequenceRef = useRef(0)
  const markdownMermaidSeqRef = useRef(0)
  const markdownPreviewRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [isFileDragging, setIsFileDragging] = useState(false)
  const { showToast } = useToast()
  const [editorState, setEditorState] = useState<{
    editor: MonacoEditorNamespace.IStandaloneCodeEditor
    monaco: Parameters<NonNullable<import('@monaco-editor/react').EditorProps['onMount']>>[1]
  } | null>(null)
  const renderContentRef = useRef<(source: string) => Promise<void>>(async () => {})

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
        const mermaid = await loadMermaid(theme)
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
  }, [mode, theme])
  renderContentRef.current = renderContent

  useEffect(() => {
    const monaco = editorState?.monaco
    const model = editorState?.editor.getModel()
    if (!monaco || !model) return
    const match = /(?:Parse error on line|line)\s+(\d+)/i.exec(error)
    const line = Math.min(model.getLineCount(), Math.max(1, Number(match?.[1] ?? 1)))
    monaco.editor.setModelMarkers(model, 'mermaid-renderer', error && activeFormat === 'mermaid' ? [{
      severity: monaco.MarkerSeverity.Error,
      message: error,
      startLineNumber: line,
      endLineNumber: line,
      startColumn: 1,
      endColumn: model.getLineMaxColumn(line),
    }] : [])
  }, [error, activeFormat, code, editorState])

  const clearSavedDraft = useDraftPersistence(MERMAID_DRAFT_KEY, code)

  useEffect(() => () => { fileReadSequenceRef.current += 1 }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void renderContent(code)
    }, RENDER_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [code, mode, renderContent, locale])

  useEscapeToClose(isFullscreen, () => setIsFullscreen(false))

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
          const mermaid = await loadMermaid(theme)
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
            t("<strong>Mermaid 图表渲染失败</strong>") +
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
  }, [activeFormat, html, theme])

  const changeCode = (value: string) => {
    fileReadSequenceRef.current += 1
    if (value !== code) renderSequenceRef.current += 1
    setSourceName('')
    setCode(value)
  }

  const resetExample = () => {
    changeCode(mode === 'markdown' || (mode === 'auto' && activeFormat === 'markdown')
      ? DEFAULT_MARKDOWN_CODE
      : DEFAULT_MERMAID_CODE)
  }

  const clearCode = () => {
    changeCode('')
    setSvg('')
    setHtml('')
    setError('')
    setActiveFormat(null)
    setIsRendering(false)
    setZoom(100)
  }

  const loadTextFile = async (file: File) => {
    const sequence = ++fileReadSequenceRef.current
    if (!SUPPORTED_TEXT_FILE.test(file.name)) {
      showToast(t("请选择 Markdown、Mermaid 或文本文件"), 'error')
      return
    }

    try {
      const content = await file.text()
      if (sequence !== fileReadSequenceRef.current) return
      if (content.includes('\0')) throw new Error(t("非文本文件"))
      const source = content.replace(/^\uFEFF/, '')
      if (source !== code || mode !== 'auto') renderSequenceRef.current += 1
      setMode('auto')
      setSourceName(file.name)
      setCode(source)
      setZoom(100)
      showToast(t("已加载 {value0}", { value0: file.name }))
    } catch {
      if (sequence === fileReadSequenceRef.current) showToast(t("读取文件失败：{value0}", { value0: file.name }), 'error')
    }
  }

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void loadTextFile(file)
  }

  const onFileDragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsFileDragging(true)
  }

  const onFileDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
      setIsFileDragging(false)
    }
  }

  const onFileDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsFileDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void loadTextFile(file)
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

      context.fillStyle = theme === 'light' ? '#ffffff' : '#0f1011'
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
<html lang="${locale === "zh" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t("Markdown 导出")}</title>
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
    ? t("渲染中")
    : error
      ? t("语法错误")
      : activeFormat === 'mermaid' && svg
        ? t("已渲染 {value0}", { value0: formatLabel })
        : activeFormat === 'markdown' && html
          ? t("已渲染 {value0}", { value0: formatLabel })
          : t("等待输入")

  const toolbar = (
    <div className="mermaid-toolbar">
      <label className="tool-select-control"><span className="dock-sr-only">{t('渲染格式')}</span>
        <select aria-label={t('渲染格式')} value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>{MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>
      </label>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void renderContent(code)}
        disabled={!code.trim() || isRendering}
      >
        {t("渲染")}</button>
      <ToolOptions label={t('编辑选项')} compact closeOnAction>
        <button type="button" className="btn-small" onClick={clearSavedDraft}>{t("清除已保存草稿")}</button>
      </ToolOptions>
    </div>
  )

  return (
    <ToolLayout
      className={`mermaid-renderer ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title={t("Mermaid / Markdown 渲染")}
      actions={toolbar}
      hideHeader={isFullscreen}
    >
      <div
        ref={workspaceRef}
        className={`mermaid-workspace ${isFullscreen ? 'preview-is-fullscreen' : ''}`}
        style={getSplitPaneGridStyle(splitRatio)}
      >
        {!isFullscreen && (
          <div
            className={`editor-panel mermaid-code-panel${isFileDragging ? ' is-file-dragging' : ''}`}
            onDragOver={onFileDragOver}
            onDragLeave={onFileDragLeave}
            onDrop={onFileDrop}
          >
            <div className="panel-header">
              <span className="mermaid-source-title" title={sourceName || t("编辑 Markdown 或 Mermaid 内容")}>
                {t("内容")}<small>{sourceName || t("可拖入本地文件")}</small>
              </span>
              <div className="panel-actions">
                <input
                  ref={fileInputRef}
                  hidden
                  type="file"
                  accept=".md,.markdown,.mmd,.mermaid,.txt,text/markdown,text/plain"
                  aria-label={t("选择 Markdown 或 Mermaid 文件")}
                  onChange={onFileInputChange}
                />
                <button type="button" className="btn-small" onClick={() => fileInputRef.current?.click()}>
                  {t("打开文件")}</button>
                <button type="button" className="btn-small" onClick={resetExample}>{t("示例")}</button>
                <button type="button" className="btn-small" onClick={clearCode} disabled={!code}>{t('清空')}</button>
              </div>
            </div>
            <div className="mermaid-editor-body">
              <Editor
                height="100%"
                language={(mode === 'auto' ? detectFormat(code) : mode) === 'mermaid' ? 'mermaid' : 'markdown'}
                value={code}
                loading={<div className="monaco-loading">{t("编辑器加载中")}</div>}
                onChange={(value) => changeCode(value ?? '')}
                onMount={(editor, monaco) => {
                  setEditorState({ editor, monaco })
                  editor.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                    () => void renderContentRef.current(editor.getValue())
                  )
                }}
                theme={monacoTheme}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbersMinChars: 3,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 12 },
                  ariaLabel: t("内容编辑器"),
                }}
              />
            </div>
            <EditorStatusBar text={code} label={t("内容")}>{sourceName || 'Markdown / Mermaid'}</EditorStatusBar>
          </div>
        )}

        {!isFullscreen && (
          <SplitPaneDivider
            containerRef={workspaceRef}
            ratio={splitRatio}
            onRatioChange={setSplitRatio}
            label={t("调整内容预览宽度")}
          />
        )}

        <div
          className={`editor-panel mermaid-preview-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          data-testid="mermaid-preview"
        >
          <div className="panel-header">
            <span>{t("预览")}</span>
            <div className="panel-actions">
              <div className="mermaid-format-actions">
                <div className={`mermaid-format-action-group${activeFormat === 'mermaid' ? ' is-visible' : ''}`} aria-hidden={activeFormat !== 'mermaid'}>
                  <div className="mermaid-zoom-controls" role="group" aria-label={t("图表缩放")}>
                    <button
                      type="button"
                      className="btn-small mermaid-zoom-button"
                      onClick={zoomOut}
                      disabled={!svg || zoom <= MIN_ZOOM}
                      aria-label={t("缩小图表")}
                      title={t("缩小")}
                    >−</button>
                    <button
                      type="button"
                      className="btn-small mermaid-zoom-value"
                      onClick={() => setZoom(100)}
                      disabled={!svg || zoom === 100}
                      aria-label={t("重置图表缩放，当前 {value0}%", { value0: zoom })}
                      title={t("重置为 100%")}
                    >{zoom}%</button>
                    <button
                      type="button"
                      className="btn-small mermaid-zoom-button"
                      onClick={zoomIn}
                      disabled={!svg || zoom >= MAX_ZOOM}
                      aria-label={t("放大图表")}
                      title={t("放大")}
                    >+</button>
                  </div>
                  <ToolOptions label={t('导出')} compact closeOnAction>
                  <button type="button" className="btn-small" onClick={downloadSvg} disabled={!svg}>SVG</button>
                  <button type="button" className="btn-small" onClick={downloadPng} disabled={!svg}>PNG</button>
                  </ToolOptions>
                </div>
                <div className={`mermaid-format-action-group${activeFormat === 'markdown' ? ' is-visible' : ''}`} aria-hidden={activeFormat !== 'markdown'}>
                  <ToolOptions label={t('预览选项')} compact>
                  <div className="mermaid-layout-switch" role="group" aria-label={t("内容布局")}>
                    {LAYOUT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`btn-small mode-button ${markdownLayout === option.value ? 'active' : ''}`}
                        onClick={() => setMarkdownLayout(option.value)}
                        aria-pressed={markdownLayout === option.value}
                        title={t(option.title)}
                      >
                        {t(option.label)}
                      </button>
                    ))}
                  </div>
                  </ToolOptions>
                <button type="button" className="btn-small" onClick={downloadHtml} disabled={!html}>HTML</button>
                </div>
              </div>
              <button
                type="button"
                className="btn-small btn-fullscreen"
                onClick={() => setIsFullscreen((value) => !value)}
                title={isFullscreen ? t("退出全屏") : t("全屏查看")}
              >
                {isFullscreen ? t("⤓ 退出全屏") : t("⛶ 全屏")}
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
                  <strong>{t("无法渲染")}{formatLabel ? ` ${formatLabel}` : ''}{t("内容")}</strong>
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
                    {isRendering ? t("正在渲染 Markdown...") : t("输入 Markdown 内容后将在这里显示渲染结果")}
                  </div>
                )
              ) : activeFormat === 'mermaid' ? (
                svg ? (
                  <div
                    className="mermaid-diagram"
                    role="img"
                    aria-label={t("Mermaid 图表预览")}
                    style={{
                      width: `${Math.min(100, zoom)}%`,
                      maxWidth: `${48 * zoom / 100}rem`,
                    } as CSSProperties}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <div className="mermaid-empty">
                    {isRendering ? t("正在生成图表...") : t("输入 Mermaid 代码后将在这里显示图表")}
                  </div>
                )
              ) : (
                <div className="mermaid-empty">
                  {t("输入内容后将在这里显示渲染结果（自动识别 Mermaid / Markdown，支持 LaTeX 数学公式）")}</div>
              )}
            </div>
          </div>
          <div className="editor-status-bar">
            <span className={error ? 'mermaid-render-status error' : 'mermaid-render-status'} role="status">{statusText}</span>
            <span title={t("Cmd/Ctrl + Enter 渲染")}>⌘ / Ctrl + Enter</span>
          </div>
        </div>
      </div>
    </ToolLayout>
  )
}

export default MermaidRenderer
