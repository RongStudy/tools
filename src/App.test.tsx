import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const { setupMonaco, routerState } = vi.hoisted(() => ({ setupMonaco: vi.fn(), routerState: { path: '/' } }))
vi.mock('@monaco-setup', () => ({ setupMonaco }))
vi.mock('@platform', async () => {
  const { MemoryRouter } = await import('react-router-dom')
  return { PlatformRouter: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[routerState.path]}>{children}</MemoryRouter> }
})
vi.mock('./components/AppShell', async () => {
  const { Link } = await import('react-router-dom')
  return { default: ({ children }: { children: ReactNode }) => <><Link to="/">首页</Link><Link to="/json">JSON</Link><Link to="/timestamp">时间</Link>{children}</> }
})
vi.mock('./tools/registry', () => ({ tools: [
  { path: '/', component: () => <div>home page</div> },
  { path: '/json', component: () => <div>json page</div> },
  { path: '/timestamp', component: () => <div>timestamp page</div> },
  { path: '/lottie', component: () => <div>lottie page</div> },
] }))
beforeEach(() => { setupMonaco.mockReset(); setupMonaco.mockResolvedValue(undefined); routerState.path = '/' })
afterEach(() => vi.unstubAllGlobals())

describe('route based Monaco initialization', () => {
  it('skips homepage and noneditor tools and initializes only on first editor navigation', async () => {
    render(<App />)
    expect(screen.getByText('home page')).toBeInTheDocument()
    fireEvent.click(screen.getByText('时间'))
    expect(screen.getByText('timestamp page')).toBeInTheDocument()
    expect(setupMonaco).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('JSON'))
    await screen.findByText('json page')
    expect(setupMonaco).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('首页'))
    fireEvent.click(screen.getByText('JSON'))
    expect(screen.getByText('json page')).toBeInTheDocument()
    expect(setupMonaco).toHaveBeenCalledTimes(1)
  })
  it('initializes Monaco when directly opening the Lottie page', async () => {
    routerState.path = '/lottie'
    render(<App />)
    await screen.findByText('lottie page')
    expect(setupMonaco).toHaveBeenCalledOnce()
  })

  it('keeps editor pages gated after a loading failure and allows retry', async () => {
    setupMonaco.mockRejectedValueOnce(new Error('network failure'))
    render(<App />)
    fireEvent.click(screen.getByText('JSON'))
    await screen.findByRole('alert')
    expect(screen.queryByText('json page')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByText('json page')
    await waitFor(() => expect(setupMonaco).toHaveBeenCalledTimes(2))
  })
})

describe('mobile access', () => {
  const device = (userAgent: string, width: number, platform = '', maxTouchPoints = 0, mobile = false) => {
    vi.stubGlobal('navigator', { userAgent, platform, maxTouchPoints, userAgentData: { mobile } })
    vi.stubGlobal('innerWidth', width)
  }

  it.each([
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148', false],
    ['Android phone', 'Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36', false],
    ['client hints phone', 'Mozilla/5.0', true],
  ])('blocks %s even with a large viewport and skips editor initialization on direct links', (_, userAgent, mobile) => {
    device(userAgent, 1200, '', 5, mobile)
    routerState.path = '/json'
    render(<App />)
    expect(screen.getByRole('heading', { name: '请使用 PC 访问' })).toBeInTheDocument()
    expect(screen.queryByText('json page')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(setupMonaco).not.toHaveBeenCalled()
  })

  it.each([
    ['iPad', 'Mozilla/5.0 (iPad; CPU OS 18_0)', 'iPad'],
    ['iPad desktop mode', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel'],
    ['Android tablet', 'Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Safari/537.36', 'Linux armv8l'],
  ])('allows %s above the desktop layout breakpoint and updates when rotated', async (_, userAgent, platform) => {
    device(userAgent, 900, platform, 5)
    routerState.path = '/json'
    render(<App />)
    expect(screen.getByText('当前屏幕宽度不足，请尝试横屏或使用电脑打开。')).toBeInTheDocument()
    expect(setupMonaco).not.toHaveBeenCalled()
    vi.stubGlobal('innerWidth', 901)
    fireEvent(window, new Event('resize'))
    await screen.findByText('json page')
    expect(setupMonaco).toHaveBeenCalledTimes(1)
    vi.stubGlobal('innerWidth', 834)
    fireEvent(window, new Event('resize'))
    expect(screen.getByRole('heading', { name: '请使用 PC 访问' })).toBeInTheDocument()
    expect(screen.queryByText('json page')).not.toBeInTheDocument()
  })

  it('keeps a desktop browser usable in a narrow window, including touch enabled PCs', () => {
    device('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', 390, 'Win32', 10)
    render(<App />)
    expect(screen.getByText('home page')).toBeInTheDocument()
    expect(screen.queryByText('请使用 PC 访问')).not.toBeInTheDocument()
  })
})
