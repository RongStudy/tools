import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const { setupMonaco } = vi.hoisted(() => ({ setupMonaco: vi.fn() }))
vi.mock('@monaco-setup', () => ({ setupMonaco }))
vi.mock('@platform', async () => {
  const { MemoryRouter } = await import('react-router-dom')
  return { PlatformRouter: ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter> }
})
vi.mock('./components/AppShell', async () => {
  const { Link } = await import('react-router-dom')
  return { default: ({ children }: { children: ReactNode }) => <><Link to="/">首页</Link><Link to="/json">JSON</Link><Link to="/timestamp">时间</Link>{children}</> }
})
vi.mock('./tools/registry', () => ({ tools: [
  { path: '/', component: () => <div>home page</div> },
  { path: '/json', component: () => <div>json page</div> },
  { path: '/timestamp', component: () => <div>timestamp page</div> },
] }))
beforeEach(() => { setupMonaco.mockReset(); setupMonaco.mockResolvedValue(undefined) })

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
