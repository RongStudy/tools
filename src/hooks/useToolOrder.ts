import { useEffect, useMemo, useState } from 'react'
import type { ToolDefinition } from '../tools/registry'
import { t } from '../i18n'
import { moveToolPath, orderMenuTools, persistToolOrder, readToolOrder, TOOL_ORDER_STORAGE_KEY } from '../utils/toolOrder'

export const useToolOrder = (tools: ToolDefinition[]) => {
  const [order, setOrder] = useState<unknown>(readToolOrder)
  const [saveFailed, setSaveFailed] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const orderedTools = useMemo(() => orderMenuTools(tools, order), [tools, order])
  const movableTools = orderedTools.filter((tool) => tool.isTool !== false)

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== null && event.key !== TOOL_ORDER_STORAGE_KEY) return
      if (event.storageArea && event.storageArea !== window.localStorage) return
      setOrder(readToolOrder())
      setSaveFailed(false)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const moveTool = (source: string, target: string) => {
    const paths = movableTools.map((tool) => tool.path)
    const next = moveToolPath(paths, source, target)
    if (next === paths) return
    setOrder(next)
    setSaveFailed(!persistToolOrder(next))
    const tool = movableTools.find((item) => item.path === source)!
    setAnnouncement(t('已将 {tool} 移至第 {position} 位', { tool: t(tool.navTitle), position: next.indexOf(source) + 1 }))
  }

  const resetOrder = () => {
    setOrder(null)
    setSaveFailed(!persistToolOrder(null))
    setAnnouncement(t('已恢复默认菜单顺序'))
  }

  return { orderedTools, movableTools, moveTool, resetOrder, saveFailed, announcement }
}
