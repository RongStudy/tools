import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFullscreen } from '../useFullscreen'

// Mock Fullscreen API
const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined)
const mockExitFullscreen = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.clearAllMocks()
  
  // 重置 document.fullscreenElement
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    writable: true,
    configurable: true,
  })

  // Mock Element.prototype.requestFullscreen
  Element.prototype.requestFullscreen = mockRequestFullscreen

  // Mock document.exitFullscreen
  document.exitFullscreen = mockExitFullscreen
})

describe('useFullscreen', () => {
  it('初始状态应为非全屏', () => {
    const { result } = renderHook(() => useFullscreen({ current: document.createElement('div') }))
    expect(result.current[0]).toBe(false)
  })

  it('调用 toggleFullscreen 应调用 requestFullscreen', async () => {
    const element = document.createElement('div')
    const { result } = renderHook(() => useFullscreen({ current: element }))

    await act(async () => {
      await result.current[1]()
    })

    expect(mockRequestFullscreen).toHaveBeenCalledOnce()
  })

  it('当 ref.current 为 null 时不应报错', async () => {
    const { result } = renderHook(() => useFullscreen({ current: null }))

    await act(async () => {
      await result.current[1]()
    })

    expect(mockRequestFullscreen).not.toHaveBeenCalled()
  })

  it('退出全屏时应调用 document.exitFullscreen', async () => {
    const element = document.createElement('div')
    const { result } = renderHook(() => useFullscreen({ current: element }))

    // 先进入全屏
    await act(async () => {
      await result.current[1]()
    })

    // 模拟全屏状态
    Object.defineProperty(document, 'fullscreenElement', {
      value: element,
      writable: true,
      configurable: true,
    })

    // 触发 fullscreenchange 事件
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    // 退出全屏
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    })

    await act(async () => {
      await result.current[1]()
    })

    expect(mockExitFullscreen).toHaveBeenCalledOnce()
  })

  it('应监听 fullscreenchange 事件', async () => {
    const element = document.createElement('div')
    renderHook(() => useFullscreen({ current: element }))

    // 模拟浏览器进入全屏（如用户按 F11）
    Object.defineProperty(document, 'fullscreenElement', {
      value: element,
      writable: true,
      configurable: true,
    })

    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    // 模拟退出全屏
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    })

    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
  })

  it('requestFullscreen 失败时不应抛出异常', async () => {
    const element = document.createElement('div')
    mockRequestFullscreen.mockRejectedValueOnce(new Error('Not allowed'))

    const { result } = renderHook(() => useFullscreen({ current: element }))

    // 不应抛出异常
    await act(async () => {
      await result.current[1]()
    })

    expect(result.current[0]).toBe(false)
  })
})
