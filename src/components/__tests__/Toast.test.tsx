import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider } from '../Toast'
import { useToast } from '../toastContext'

/** 测试用子组件，用于触发 toast */
function TestComponent() {
  const { showToast } = useToast()
  return (
    <div>
      <button onClick={() => showToast('成功消息', 'success')}>成功</button>
      <button onClick={() => showToast('错误消息', 'error')}>错误</button>
      <button onClick={() => showToast('信息消息', 'info')}>信息</button>
      <button onClick={() => showToast('默认消息')}>默认</button>
    </div>
  )
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('应在 ToastProvider 外使用 useToast 时抛出错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      renderHookOutsideProvider()
    }).toThrow('useToast must be used within a ToastProvider')
    
    spy.mockRestore()
  })

  it('应显示成功类型的 toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('成功'))

    expect(screen.getByText('成功消息')).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('应显示错误类型的 toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('错误'))

    expect(screen.getByText('错误消息')).toBeInTheDocument()
    expect(screen.getByText('✗')).toBeInTheDocument()
  })

  it('应显示信息类型的 toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('信息'))

    expect(screen.getByText('信息消息')).toBeInTheDocument()
    expect(screen.getByText('ℹ')).toBeInTheDocument()
  })

  it('默认类型应为 success', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('默认'))

    expect(screen.getByText('默认消息')).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('点击 toast 应关闭它', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('成功'))
    expect(screen.getByText('成功消息')).toBeInTheDocument()

    fireEvent.click(screen.getByText('成功消息'))
    expect(screen.queryByText('成功消息')).not.toBeInTheDocument()
  })

  it('应在2秒后自动关闭', () => {
    vi.useFakeTimers()

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('成功'))
    expect(screen.getByText('成功消息')).toBeInTheDocument()

    // 快进2秒
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.queryByText('成功消息')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('应支持同时显示多个 toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('成功'))
    fireEvent.click(screen.getByText('错误'))

    expect(screen.getByText('成功消息')).toBeInTheDocument()
    expect(screen.getByText('错误消息')).toBeInTheDocument()
  })
})

/** 辅助函数：在 ToastProvider 外部使用 useToast */
function renderHookOutsideProvider() {
  function BadComponent() {
    useToast()
    return null
  }
  render(<BadComponent />)
}
