import { useState, useEffect, useCallback, type RefObject } from 'react'

/**
 * 全屏功能 Hook
 * 封装浏览器 Fullscreen API，提供统一的全屏切换接口
 * @param elementRef 需要全屏的 DOM 元素引用
 * @returns [isFullscreen, toggleFullscreen] 当前全屏状态和切换函数
 */
export function useFullscreen(elementRef: RefObject<HTMLElement | null>): [boolean, () => Promise<void>] {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(async () => {
    const element = elementRef.current
    if (!element) return

    try {
      if (!isFullscreen) {
        // 进入全屏
        if (element.requestFullscreen) {
          await element.requestFullscreen()
        }
        setIsFullscreen(true)
      } else {
        // 退出全屏
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('全屏操作失败:', err)
    }
  }, [isFullscreen, elementRef])

  // 监听全屏状态变化（处理用户按 Esc 退出等场景）
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  return [isFullscreen, toggleFullscreen]
}
