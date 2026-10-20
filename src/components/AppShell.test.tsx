import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AppShell from './AppShell'
import type { ToolDefinition } from '../tools/registry'

const tools: ToolDefinition[] = [
  { path: '/', title: '首页', navTitle: '首页', description: '工具总览', category: '总览', icon: 'home', component: () => null, isTool: false },
  { path: '/json', title: 'JSON格式化工具', navTitle: 'JSON格式化', description: '格式化、压缩 JSON', category: '编码处理', icon: 'json', component: () => null },
  { path: '/code-diff', title: '代码对比', navTitle: '代码对比', description: '对比两段文本', category: '编码处理', icon: 'diff', component: () => null },
  { path: '/url-codec', title: '编解码', navTitle: '编解码', description: 'URL、Base64 编解码', category: '编码处理', icon: 'codec', iconSrc: '/icons/codec.svg', component: () => null },
]

const MOTION_QUERY = '(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
type MediaProfile = { desktop: boolean; hover: boolean; fine: boolean; motion: boolean }
let profile: MediaProfile
let mediaListeners: Map<string, Set<EventListenerOrEventListenerObject>>
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let frameTime: number

const matchesMedia = (query: string) => (
  (!query.includes('min-width: 901px') || profile.desktop)
  && (!query.includes('hover: hover') || profile.hover)
  && (!query.includes('pointer: fine') || profile.fine)
  && (!query.includes('prefers-reduced-motion: no-preference') || profile.motion)
)

class TestPointerEvent extends MouseEvent {
  readonly pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? 'mouse'
  }
}

const RouteProbe = () => {
  const location = useLocation()
  return <output data-testid="current-route">{location.pathname}</output>
}

const renderAppShell = (initialPath = '/') => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <AppShell tools={tools}>
      <RouteProbe />
      <textarea aria-label="工作区输入" onKeyDown={(event) => event.stopPropagation()} />
    </AppShell>
  </MemoryRouter>
)

const getDockItems = () => within(screen.getByRole('navigation', { name: '工具导航' })).getAllByRole('link')
const getScale = (item: HTMLElement) => Number(item.style.getPropertyValue('--dock-scale') || '1')
const measureDock = () => {
  const items = getDockItems()
  items.forEach((item, index) => {
    // Stable slots: centers at (40, 100), (40, 172), (40, 244), (40, 316).
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
      x: 16, y: 76 + index * 72, left: 16, top: 76 + index * 72,
      right: 64, bottom: 124 + index * 72, width: 48, height: 48, toJSON: () => ({}),
    })
  })
  return items
}
const flushFrame = (elapsed = 1000 / 60) => act(() => {
  frameTime += elapsed
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(frameTime))
})
const settleFrames = (elapsed = 1000 / 60) => {
  for (let i = 0; i < 240 && frames.size > 0; i++) flushFrame(elapsed)
  expect(frames.size).toBe(0)
}
const movePointer = (clientY: number, pointerType = 'mouse', clientX = 40) => {
  fireEvent.pointerMove(screen.getByRole('navigation', { name: '工具导航' }), { clientX, clientY, pointerType })
}
const changeMotionPreference = (motion: boolean) => act(() => {
  profile.motion = motion
  const event = Object.assign(new Event('change'), { matches: matchesMedia(MOTION_QUERY), media: MOTION_QUERY })
  mediaListeners.get(MOTION_QUERY)?.forEach((listener) => {
    if (typeof listener === 'function') listener(event)
    else listener.handleEvent(event)
  })
})

beforeEach(() => {
  localStorage.clear()
  profile = { desktop: true, hover: true, fine: true, motion: true }
  mediaListeners = new Map()
  frames = new Map()
  nextFrame = 0
  frameTime = 0
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query,
    get matches() { return matchesMedia(query) },
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (!mediaListeners.has(query)) mediaListeners.set(query, new Set())
      mediaListeners.get(query)!.add(listener)
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => mediaListeners.get(query)?.delete(listener),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AppShell Dock navigation', () => {
  it('switches and remembers the selected theme', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAppShell()
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(screen.getByRole('button', { name: '切换到浅色主题' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('dev-tools:theme')).toBe('light')

    unmount()
    renderAppShell()
    expect(screen.getByRole('button', { name: '切换到深色主题' })).toBeInTheDocument()
  })

  it('renders named tool links and updates the accessible current page after navigation', async () => {
    const user = userEvent.setup()
    renderAppShell('/json')
    const items = getDockItems()
    expect(items).toHaveLength(tools.length)
    tools.forEach((tool, index) => {
      expect(items[index]).toHaveAccessibleName(tool.navTitle)
      expect(items[index]).toHaveAttribute('href', tool.path)
      expect(items[index].querySelector('.dock-icon')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'JSON格式化' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '首页' })).not.toHaveAttribute('aria-current')
    await user.click(screen.getByRole('link', { name: '代码对比' }))
    expect(screen.getByTestId('current-route')).toHaveTextContent('/code-diff')
    expect(screen.getByRole('link', { name: '代码对比' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'JSON格式化' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('textbox', { name: '工作区输入' })).toBeInTheDocument()
  })

  it('uses decorative SVG icons by default and lets iconSrc replace the SVG without changing the link name', () => {
    renderAppShell()
    const json = screen.getByRole('link', { name: 'JSON格式化' })
    expect(json.querySelector('.dock-icon svg')).toHaveAttribute('aria-hidden', 'true')
    const codec = screen.getByRole('link', { name: '编解码' })
    const image = codec.querySelector('.dock-icon img')
    expect(image).toHaveAttribute('src', '/icons/codec.svg')
    expect(image).toHaveAttribute('alt', '')
    expect(image).toHaveAttribute('draggable', 'false')
    expect(codec.querySelector('svg')).not.toBeInTheDocument()
    expect(codec).toHaveAccessibleName('编解码')
  })

  it('shows a named tooltip for pointer hover and keyboard focus, and clears it on leave or blur', () => {
    renderAppShell()
    const item = screen.getByRole('link', { name: 'JSON格式化' })
    fireEvent.pointerEnter(item, { pointerType: 'mouse' })
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('JSON格式化')
    expect(item).toHaveAttribute('aria-describedby', tooltip.id)
    fireEvent.pointerLeave(item)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    act(() => item.focus())
    expect(screen.getByRole('tooltip')).toHaveTextContent('JSON格式化')
    act(() => item.blur())
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('does not show hover tooltips for touch events or narrow viewports', () => {
    renderAppShell()
    const item = screen.getByRole('link', { name: 'JSON格式化' })
    fireEvent.pointerEnter(item, { pointerType: 'touch' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    profile.desktop = false
    fireEvent.pointerEnter(item, { pointerType: 'mouse' })
    act(() => item.focus())
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})

describe('AppShell Dock magnification', () => {
  it('magnifies the closest tool to 1.45, scales neighbors less, and leaves distant tools at their original size', () => {
    renderAppShell()
    const items = measureDock()
    movePointer(172)
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
    flushFrame()
    expect(getScale(items[1])).toBeGreaterThan(1)
    expect(getScale(items[1])).toBeLessThan(1.45)
    settleFrames()
    expect(getScale(items[1])).toBeCloseTo(1.45, 4)
    expect(getScale(items[0])).toBeGreaterThan(1)
    expect(getScale(items[0])).toBeLessThan(getScale(items[1]))
    expect(getScale(items[2])).toBeCloseTo(getScale(items[0]), 4)
    expect(getScale(items[3])).toBe(1)
  })

  it('coalesces pointer movement into one frame and uses the latest pointer position', () => {
    renderAppShell()
    const items = measureDock()
    movePointer(100)
    movePointer(172)
    movePointer(244)
    expect(frames.size).toBe(1)
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)
    flushFrame()
    settleFrames()
    expect(getScale(items[2])).toBeCloseTo(1.45, 4)
    expect(getScale(items[0])).toBe(1)
    expect(frames.size).toBe(0)
  })

  it('springs back on pointer leave and can reverse toward a new tool before settling', () => {
    renderAppShell()
    const items = measureDock()
    movePointer(172)
    settleFrames()
    fireEvent.pointerLeave(screen.getByRole('navigation', { name: '工具导航' }))
    flushFrame()
    expect(getScale(items[1])).toBeGreaterThan(1)
    expect(getScale(items[1])).toBeLessThan(1.45)
    movePointer(244)
    settleFrames()
    expect(getScale(items[2])).toBeCloseTo(1.45, 4)
    fireEvent.pointerLeave(screen.getByRole('navigation', { name: '工具导航' }))
    settleFrames()
    expect(items.every((item) => item.style.getPropertyValue('--dock-scale') === '')).toBe(true)
    expect(items.every((item) => item.style.getPropertyValue('--dock-offset') === '')).toBe(true)
  })

  it('uses only vertical distance and nudges neighboring surfaces away without moving link slots', () => {
    renderAppShell()
    const items = measureDock()
    movePointer(172, 'mouse', 5)
    settleFrames()
    expect(getScale(items[1])).toBeCloseTo(1.45, 4)
    expect(parseFloat(items[0].style.getPropertyValue('--dock-offset'))).toBeLessThan(0)
    expect(items[1].style.getPropertyValue('--dock-offset')).toBe('0.0000px')
    expect(parseFloat(items[2].style.getPropertyValue('--dock-offset'))).toBeGreaterThan(0)
    expect(items.every((item) => item.style.transform === '')).toBe(true)
    expect(items[1].getBoundingClientRect()).toMatchObject({ top: 148, height: 48 })
    movePointer(172, 'mouse', 75)
    settleFrames()
    expect(getScale(items[1])).toBeCloseTo(1.45, 4)
  })

  it.each([1000 / 120, 1000 / 30, 1000])('settles within bounds at a %sms frame interval and stops reading layout after target updates', (elapsed) => {
    renderAppShell()
    const items = measureDock()
    movePointer(172)
    flushFrame(elapsed)
    settleFrames(elapsed)
    expect(getScale(items[1])).toBeCloseTo(1.45, 4)
    items.forEach((item) => {
      expect(item.getBoundingClientRect).toHaveBeenCalledTimes(1)
      expect(getScale(item)).toBeGreaterThanOrEqual(1)
      expect(getScale(item)).toBeLessThanOrEqual(1.45)
    })
  })

  it.each(['pointerCancel', 'scroll'] as const)('%s clears scaling and tooltip and cancels queued animation work', (eventName) => {
    renderAppShell()
    const items = measureDock()
    const nav = screen.getByRole('navigation', { name: '工具导航' })
    fireEvent.pointerEnter(items[1], { pointerType: 'mouse' })
    movePointer(172)
    flushFrame()
    settleFrames()
    expect(getScale(items[1])).toBeGreaterThan(1)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    movePointer(244)
    expect(frames.size).toBe(1)
    fireEvent[eventName](nav)
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
    expect(frames.size).toBe(0)
    expect(items.every((item) => item.style.getPropertyValue('--dock-scale') === '')).toBe(true)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    flushFrame()
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
  })

  it.each([
    ['reduced motion', { motion: false }],
    ['coarse pointer', { fine: false }],
    ['no hover', { hover: false }],
    ['narrow viewport', { desktop: false }],
  ] as const)('does not schedule magnification with %s', (_label, settings) => {
    Object.assign(profile, settings)
    renderAppShell()
    const items = measureDock()
    movePointer(172)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
  })

  it('ignores touch pointer movement even on a desktop with mouse support', () => {
    renderAppShell()
    const items = measureDock()
    movePointer(172, 'touch')
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
  })

  it('resets existing magnification when the motion preference changes and resumes when enabled again', () => {
    renderAppShell()
    const items = measureDock()
    movePointer(172)
    flushFrame()
    expect(getScale(items[1])).toBeGreaterThan(1)
    changeMotionPreference(false)
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
    movePointer(172)
    expect(frames.size).toBe(0)
    changeMotionPreference(true)
    movePointer(244)
    flushFrame()
    settleFrames()
    expect(getScale(items[2])).toBeCloseTo(1.45, 4)
  })

  it('cancels pending animation frames and removes media listeners when unmounted', () => {
    const { unmount } = renderAppShell()
    measureDock()
    movePointer(172)
    expect(frames.size).toBe(1)
    expect(mediaListeners.get(MOTION_QUERY)?.size).toBe(1)
    unmount()
    expect(frames.size).toBe(0)
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
    expect(mediaListeners.get(MOTION_QUERY)?.size).toBe(0)
  })

  it('clears magnification on window blur, touch takeover and opening search with the keyboard', () => {
    renderAppShell()
    const items = measureDock()
    movePointer(172)
    settleFrames()
    fireEvent(window, new Event('blur'))
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
    movePointer(172)
    settleFrames()
    movePointer(172, 'touch')
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
    movePointer(172)
    settleFrames()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(items.every((item) => getScale(item) === 1)).toBe(true)
    expect(frames.size).toBe(0)
  })
})

describe('AppShell tool search', () => {
  it('opens an accessible portal dialog, autofocuses its input, and restores the opener on Escape', async () => {
    const user = userEvent.setup()
    const { container } = renderAppShell()
    const opener = screen.getByRole('button', { name: '搜索工具' })
    await user.click(opener)
    const dialog = screen.getByRole('dialog', { name: '切换工具' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(container).not.toContainElement(dialog)
    expect(opener).toHaveAttribute('aria-expanded', 'true')
    expect(within(dialog).getByRole('searchbox', { name: '搜索工具' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(opener).toHaveAttribute('aria-expanded', 'false')
  })

  it('filters by tool names and descriptions without case sensitivity and navigates when a result is clicked', async () => {
    const user = userEvent.setup()
    renderAppShell()
    await user.click(screen.getByRole('button', { name: '搜索工具' }))
    const dialog = screen.getByRole('dialog', { name: '切换工具' })
    const input = within(dialog).getByRole('searchbox', { name: '搜索工具' })
    await user.type(input, 'jSoN')
    expect(within(dialog).getByRole('button', { name: /JSON格式化/ })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /代码对比/ })).not.toBeInTheDocument()
    await user.clear(input)
    await user.type(input, ' bAsE64 ')
    const result = within(dialog).getByRole('button', { name: /编解码/ })
    expect(within(dialog).queryByRole('button', { name: /JSON格式化/ })).not.toBeInTheDocument()
    await user.click(result)
    expect(screen.getByTestId('current-route')).toHaveTextContent('/url-codec')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '编解码' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows an empty status, ignores Enter without results, and recovers selection after changing the query', async () => {
    const user = userEvent.setup()
    renderAppShell()
    await user.click(screen.getByRole('button', { name: '搜索工具' }))
    const dialog = screen.getByRole('dialog', { name: '切换工具' })
    const input = within(dialog).getByRole('searchbox', { name: '搜索工具' })
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.type(input, '不存在的工具')
    expect(within(dialog).getByRole('status')).toHaveTextContent('没有匹配的工具')
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByTestId('current-route').textContent).toBe('/')
    await user.clear(input)
    await user.type(input, 'json')
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('current-route')).toHaveTextContent('/json')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the search input focused while ArrowDown selects a result and Enter opens its route', async () => {
    const user = userEvent.setup()
    renderAppShell()
    await user.click(screen.getByRole('button', { name: '搜索工具' }))
    const dialog = screen.getByRole('dialog', { name: '切换工具' })
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(within(dialog).getByRole('button', { name: /代码对比/ })).toHaveClass('selected')
    expect(within(dialog).getByRole('searchbox', { name: '搜索工具' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('current-route')).toHaveTextContent('/code-diff')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('wraps ArrowUp from the first result to the last result', async () => {
    const user = userEvent.setup()
    renderAppShell()
    await user.click(screen.getByRole('button', { name: '搜索工具' }))
    await user.keyboard('{ArrowUp}')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /编解码/ })).toHaveClass('selected')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('current-route')).toHaveTextContent('/url-codec')
  })

  it.each(['Control', 'Meta'])('%s+K works through editor keydown propagation blocking and restores editor focus', async (modifier) => {
    const user = userEvent.setup()
    renderAppShell()
    const editor = screen.getByRole('textbox', { name: '工作区输入' })
    await user.click(editor)
    await user.keyboard(`{${modifier}>}k{/${modifier}}`)
    expect(screen.getByRole('dialog', { name: '切换工具' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜索工具' })).toHaveFocus()
    await user.keyboard(`{${modifier}>}k{/${modifier}}`)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editor).toHaveFocus()
  })

  it.each(['click', 'Enter'])('moves focus from the old editor to the selected Dock link after %s selection', async (selection) => {
    const user = userEvent.setup()
    renderAppShell('/json')
    const editor = screen.getByRole('textbox', { name: '工作区输入' })
    await user.click(editor)
    await user.keyboard('{Control>}k{/Control}')
    const dialog = screen.getByRole('dialog', { name: '切换工具' })
    await user.type(within(dialog).getByRole('searchbox', { name: '搜索工具' }), '对比')
    if (selection === 'click') await user.click(within(dialog).getByRole('button', { name: /代码对比/ }))
    else await user.keyboard('{Enter}')
    flushFrame()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-route')).toHaveTextContent('/code-diff')
    expect(screen.getByRole('link', { name: '代码对比' })).toHaveFocus()
    expect(editor).not.toHaveFocus()
  })

  it('focuses the current Dock link when search selects the already active route', async () => {
    const user = userEvent.setup()
    renderAppShell('/json')
    await user.click(screen.getByRole('textbox', { name: '工作区输入' }))
    await user.keyboard('{Control>}k{/Control}')
    await user.type(screen.getByRole('searchbox', { name: '搜索工具' }), 'json')
    await user.keyboard('{Enter}')
    flushFrame()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-route')).toHaveTextContent('/json')
    expect(screen.getByRole('link', { name: 'JSON格式化' })).toHaveFocus()
  })

  it('traps Tab and Shift+Tab at both dialog boundaries and restores focus when closed', async () => {
    const user = userEvent.setup()
    renderAppShell()
    const opener = screen.getByRole('button', { name: '搜索工具' })
    await user.click(opener)
    const dialog = screen.getByRole('dialog', { name: '切换工具' })
    const first = within(dialog).getByRole('button', { name: '关闭工具搜索' })
    const last = within(dialog).getByRole('button', { name: /编解码/ })
    act(() => last.focus())
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(opener).toHaveFocus()
  })

  it('keeps focus trapped when filtering leaves no result buttons', async () => {
    const user = userEvent.setup()
    renderAppShell()
    await user.click(screen.getByRole('button', { name: '搜索工具' }))
    const dialog = screen.getByRole('dialog', { name: '切换工具' })
    const input = within(dialog).getByRole('searchbox', { name: '搜索工具' })
    const close = within(dialog).getByRole('button', { name: '关闭工具搜索' })
    await user.type(input, '没有这个工具')
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(input).toHaveFocus()
  })
})
