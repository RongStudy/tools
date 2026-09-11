import { beforeEach, describe, expect, it } from 'vitest'
import {
  attachDragPan,
  attachZoomable,
  DIAGRAM_ZOOM_MAX,
  DIAGRAM_ZOOM_MIN,
  enhanceMermaidBlock,
} from '../mermaidBlockViewer'

const SVG = '<svg viewBox="0 0 120 60"><text>diagram</text></svg>'

describe('attachZoomable', () => {
  it('放大/缩小修改画布与 svg 宽度，并受边界限制', () => {
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const zoom = attachZoomable(canvas, svg)

    expect(zoom.getZoom()).toBe(100)
    zoom.zoomIn()
    expect(zoom.getZoom()).toBe(125)
    expect(canvas.style.width).toBe('125%')
    expect(svg.style.width).toBe('100%')

    zoom.zoomOut()
    expect(zoom.getZoom()).toBe(100)

    zoom.setZoom(DIAGRAM_ZOOM_MAX + 100)
    expect(zoom.getZoom()).toBe(DIAGRAM_ZOOM_MAX)
    zoom.setZoom(DIAGRAM_ZOOM_MIN - 100)
    expect(zoom.getZoom()).toBe(DIAGRAM_ZOOM_MIN)
  })

  it('缩放变化回调收到最新值（仅变化时触发）', () => {
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const values: number[] = []
    const zoom = attachZoomable(canvas, svg, (value) => values.push(value))

    expect(values).toEqual([])
    zoom.zoomIn()
    expect(values).toEqual([125])
    zoom.zoomIn()
    expect(values).toEqual([125, 150])
  })
})

describe('attachDragPan', () => {
  it('指针拖动修改滚动位置并恢复光标', () => {
    const scroller = document.createElement('div')
    scroller.scrollLeft = 50
    scroller.scrollTop = 40
    scroller.setPointerCapture = () => undefined
    scroller.hasPointerCapture = () => true
    scroller.releasePointerCapture = () => undefined
    const detach = attachDragPan(scroller)

    scroller.dispatchEvent(new PointerEvent('pointerdown', {
      button: 0, pointerId: 1, clientX: 100, clientY: 80,
    }))
    scroller.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 1, clientX: 60, clientY: 50,
    }))
    expect(scroller.classList.contains('is-dragging')).toBe(true)
    expect(scroller.scrollLeft).toBe(90)
    expect(scroller.scrollTop).toBe(70)

    scroller.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    expect(scroller.classList.contains('is-dragging')).toBe(false)

    detach()
  })
})

describe('enhanceMermaidBlock', () => {
  let block: HTMLElement

  beforeEach(() => {
    block = document.createElement('div')
    block.className = 'mermaid-block'
    block.innerHTML = SVG
  })

  it('包装出工具栏、滚动容器与画布', () => {
    enhanceMermaidBlock(block)

    expect(block.querySelector('.mermaid-block-toolbar')).not.toBeNull()
    expect(block.querySelector('.mermaid-block-body')).not.toBeNull()
    expect(block.querySelector('.mermaid-block-canvas svg')).not.toBeNull()
    expect(block.querySelector('button[title="全屏查看"]')).not.toBeNull()
  })

  it('工具栏按钮可放大缩小图表', () => {
    enhanceMermaidBlock(block)

    const canvas = block.querySelector('.mermaid-block-canvas') as HTMLElement
    const zoomValue = block.querySelector('.mermaid-block-zoom-value')
    const zoomIn = block.querySelector('button[aria-label="放大图表"]') as HTMLButtonElement
    const zoomOut = block.querySelector('button[aria-label="缩小图表"]') as HTMLButtonElement

    zoomIn.click()
    expect(canvas.style.width).toBe('125%')
    expect(zoomValue?.textContent).toBe('125%')

    zoomOut.click()
    expect(canvas.style.width).toBe('100%')
    expect(zoomValue?.textContent).toBe('100%')
  })

  it('全屏按钮打开覆盖层，ESC 退出并恢复背景滚动', () => {
    enhanceMermaidBlock(block)

    const fullscreen = block.querySelector('button[title="全屏查看"]') as HTMLButtonElement
    fullscreen.click()

    const overlay = document.querySelector('.mermaid-block-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay?.querySelector('svg')).not.toBeNull()
    // 覆盖层展示的是克隆，原块图表不受影响
    expect(block.querySelector('svg')).not.toBeNull()
    expect(document.body.style.overflow).toBe('hidden')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.mermaid-block-overlay')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })
})
