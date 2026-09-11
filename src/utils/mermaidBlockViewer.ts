/**
 * 内嵌 Mermaid 图表块交互增强（纯前端、命令式 DOM 操作）
 *
 * 为 Markdown 中渲染出的每个 mermaid 图表块提供：
 * - 缩放：工具栏 − / + 按钮，缩放值应用到画布宽度（滚动区随之伸缩）
 * - 拖动平移：按住拖动画布（基于滚动条位移，与主页面预览交互一致）
 * - 全屏：右上角按钮 → 浏览器标签页内 fixed 覆盖层（ESC / 关闭按钮退出）
 */

export const DIAGRAM_ZOOM_MIN = 50
export const DIAGRAM_ZOOM_MAX = 300
export const DIAGRAM_ZOOM_STEP = 25

type ZoomableView = {
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  getZoom: () => number
}

/**
 * 给画布绑定缩放。canvas 宽度按缩放百分比伸缩（>100% 时产生横向滚动），
 * svg 始终占满画布宽度。
 */
export const attachZoomable = (
  canvas: HTMLElement,
  svg: SVGElement,
  onZoomChange?: (zoom: number) => void
): ZoomableView => {
  let zoom = 100

  const apply = (value: number) => {
    zoom = Math.min(DIAGRAM_ZOOM_MAX, Math.max(DIAGRAM_ZOOM_MIN, value))
    canvas.style.width = `${Math.max(100, zoom)}%`
    svg.style.width = `${Math.min(100, zoom)}%`
    onZoomChange?.(zoom)
  }

  return {
    setZoom: apply,
    zoomIn: () => apply(zoom + DIAGRAM_ZOOM_STEP),
    zoomOut: () => apply(zoom - DIAGRAM_ZOOM_STEP),
    getZoom: () => zoom,
  }
}

/**
 * 给滚动容器绑定拖动平移（指针按下拖动 → 修改 scrollLeft/scrollTop）。
 * 返回解绑函数。
 */
export const attachDragPan = (scroller: HTMLElement): (() => void) => {
  let drag: {
    pointerId: number
    startX: number
    startY: number
    scrollLeft: number
    scrollTop: number
  } | null = null

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerType === 'touch') return

    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
    }
    scroller.setPointerCapture?.(event.pointerId)
    scroller.classList.add('is-dragging')
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return

    scroller.scrollLeft = drag.scrollLeft + drag.startX - event.clientX
    scroller.scrollTop = drag.scrollTop + drag.startY - event.clientY
    event.preventDefault()
  }

  const end = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return

    drag = null
    if (scroller.hasPointerCapture?.(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId)
    }
    scroller.classList.remove('is-dragging')
  }

  scroller.addEventListener('pointerdown', onPointerDown)
  scroller.addEventListener('pointermove', onPointerMove)
  scroller.addEventListener('pointerup', end)
  scroller.addEventListener('pointercancel', end)
  scroller.addEventListener('lostpointercapture', end)

  return () => {
    scroller.removeEventListener('pointerdown', onPointerDown)
    scroller.removeEventListener('pointermove', onPointerMove)
    scroller.removeEventListener('pointerup', end)
    scroller.removeEventListener('pointercancel', end)
    scroller.removeEventListener('lostpointercapture', end)
  }
}

const createButton = (label: string, title: string, className: string, onClick: () => void) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.title = title
  button.setAttribute('aria-label', title)
  button.addEventListener('click', onClick)
  return button
}

/**
 * 全屏覆盖层：fixed 铺满视口，展示图表的克隆（不移动原节点，避免影响 React 管理的 DOM）。
 * 自带缩放、拖动与 ESC 退出。
 */
const openFullscreen = (svg: SVGSVGElement) => {
  const overlay = document.createElement('div')
  overlay.className = 'mermaid-block-overlay'

  const toolbar = document.createElement('div')
  toolbar.className = 'mermaid-block-overlay-toolbar'

  const zoomLabel = document.createElement('span')
  zoomLabel.className = 'mermaid-block-zoom-value'
  zoomLabel.textContent = '100%'

  const zoomControls = document.createElement('div')
  zoomControls.className = 'mermaid-zoom-controls'
  zoomControls.setAttribute('role', 'group')
  zoomControls.setAttribute('aria-label', '图表缩放')

  const body = document.createElement('div')
  body.className = 'mermaid-block-overlay-body'

  const canvas = document.createElement('div')
  canvas.className = 'mermaid-block-overlay-canvas'

  const svgClone = svg.cloneNode(true) as SVGSVGElement
  canvas.appendChild(svgClone)
  body.appendChild(canvas)

  const zoomView = attachZoomable(canvas, svgClone, (zoom) => {
    zoomLabel.textContent = `${zoom}%`
  })
  const detachDrag = attachDragPan(body)

  const close = () => {
    window.removeEventListener('keydown', onKeyDown)
    document.body.style.overflow = ''
    detachDrag()
    overlay.remove()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }
  window.addEventListener('keydown', onKeyDown)

  zoomControls.appendChild(createButton('−', '缩小图表', 'btn-small mermaid-zoom-button', zoomView.zoomOut))
  zoomControls.appendChild(zoomLabel)
  zoomControls.appendChild(createButton('+', '放大图表', 'btn-small mermaid-zoom-button', zoomView.zoomIn))

  const fullscreenButton = createButton('退出全屏', '退出全屏', 'btn-small btn-fullscreen', close)

  toolbar.appendChild(zoomControls)
  toolbar.appendChild(fullscreenButton)
  overlay.appendChild(toolbar)
  overlay.appendChild(body)
  document.body.appendChild(overlay)

  // 锁定背景滚动
  document.body.style.overflow = 'hidden'
}

/**
 * 增强已注入 SVG 的 mermaid 块：包装结构 + 工具栏（缩放/全屏）+ 拖动平移。
 * 返回解绑函数。
 */
export const enhanceMermaidBlock = (block: HTMLElement): (() => void) => {
  const svg = block.querySelector('svg')
  if (!svg) return () => {}

  // 包装：工具栏 + 滚动容器 + 画布
  const toolbar = document.createElement('div')
  toolbar.className = 'mermaid-block-toolbar'

  const zoomLabel = document.createElement('span')
  zoomLabel.className = 'mermaid-block-zoom-value'
  zoomLabel.textContent = '100%'

  const zoomControls = document.createElement('div')
  zoomControls.className = 'mermaid-zoom-controls'
  zoomControls.setAttribute('role', 'group')
  zoomControls.setAttribute('aria-label', '图表缩放')

  const body = document.createElement('div')
  body.className = 'mermaid-block-body'

  const canvas = document.createElement('div')
  canvas.className = 'mermaid-block-canvas'
  canvas.appendChild(svg)

  block.appendChild(toolbar)
  block.appendChild(body)
  body.appendChild(canvas)

  const zoomView = attachZoomable(canvas, svg, (zoom) => {
    zoomLabel.textContent = `${zoom}%`
  })
  const detachDrag = attachDragPan(body)

  zoomControls.appendChild(createButton('−', '缩小图表', 'btn-small mermaid-zoom-button', zoomView.zoomOut))
  zoomControls.appendChild(zoomLabel)
  zoomControls.appendChild(createButton('+', '放大图表', 'btn-small mermaid-zoom-button', zoomView.zoomIn))

  const fullscreenButton = createButton('⛶', '全屏查看', 'btn-small btn-fullscreen', () => openFullscreen(svg))

  toolbar.appendChild(zoomControls)
  toolbar.appendChild(fullscreenButton)

  return detachDrag
}
