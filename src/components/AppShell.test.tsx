import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppShell from './AppShell'
import type { ToolDefinition } from '../tools/registry'

const tools: ToolDefinition[] = [
  {
    path: '/',
    title: '首页',
    navTitle: '首页',
    description: '工具总览',
    category: '总览',
    component: () => null,
    isTool: false,
  },
  {
    path: '/json',
    title: 'JSON格式化工具',
    navTitle: 'JSON格式化',
    description: '格式化 JSON',
    category: '编码处理',
    component: () => null,
  },
]

const renderAppShell = () => render(
  <MemoryRouter>
    <AppShell tools={tools}>
      <div>工作区</div>
    </AppShell>
  </MemoryRouter>
)

describe('AppShell', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('默认折叠侧栏，悬浮时临时展开，移开后自动收起', () => {
    vi.useFakeTimers()
    const { container } = renderAppShell()
    const shell = container.querySelector('.app-shell')
    const sidebar = container.querySelector('.app-sidebar')

    expect(shell).toHaveClass('sidebar-collapsed')
    expect(screen.getByRole('button', { name: '展开侧边栏' })).toBeInTheDocument()

    fireEvent.mouseEnter(sidebar!)
    expect(shell).toHaveClass('sidebar-hover-expanded')

    fireEvent.mouseLeave(sidebar!)
    expect(shell).toHaveClass('sidebar-hover-expanded')
    expect(shell).toHaveClass('sidebar-preview-closing')

    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(shell).toHaveClass('sidebar-collapsed')
    expect(shell).not.toHaveClass('sidebar-hover-expanded')
  })

  it('展开与收起按钮可以固定切换侧栏状态', () => {
    vi.useFakeTimers()
    const { container } = renderAppShell()
    const shell = container.querySelector('.app-shell')

    fireEvent.click(screen.getByRole('button', { name: '展开侧边栏' }))
    expect(shell).not.toHaveClass('sidebar-collapsed')
    expect(shell).toHaveClass('sidebar-manual-opening')
    expect(screen.getByRole('button', { name: '收起侧边栏' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(shell).not.toHaveClass('sidebar-manual-opening')

    fireEvent.click(screen.getByRole('button', { name: '收起侧边栏' }))
    expect(shell).toHaveClass('sidebar-collapsed')
    expect(shell).toHaveClass('sidebar-manual-collapsing')

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(shell).not.toHaveClass('sidebar-manual-collapsing')
  })

  it('手动收起后先离开再进入侧栏，才恢复悬浮预览', () => {
    vi.useFakeTimers()
    const { container } = renderAppShell()
    const shell = container.querySelector('.app-shell')
    const sidebar = container.querySelector('.app-sidebar')

    fireEvent.click(screen.getByRole('button', { name: '展开侧边栏' }))
    fireEvent.click(screen.getByRole('button', { name: '收起侧边栏' }))

    expect(shell).toHaveClass('sidebar-manual-collapsing')
    expect(shell).not.toHaveClass('sidebar-hover-expanded')

    act(() => {
      vi.advanceTimersByTime(220)
    })
    fireEvent.mouseLeave(sidebar!)
    fireEvent.mouseEnter(sidebar!)

    expect(shell).toHaveClass('sidebar-hover-expanded')
  })
})
