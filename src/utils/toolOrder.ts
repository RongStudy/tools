export const TOOL_ORDER_STORAGE_KEY = 'dev-tools:tool-order'

type MenuEntry = { path: string; isTool?: boolean }

export const normalizeToolOrder = (value: unknown, paths: string[]): string[] => {
  const saved = Array.isArray(value) ? value.filter((path): path is string => typeof path === 'string' && paths.includes(path)) : []
  return [...new Set([...saved, ...paths])]
}

export const readToolOrder = (): unknown => {
  try { return JSON.parse(window.localStorage.getItem(TOOL_ORDER_STORAGE_KEY) ?? 'null') }
  catch { return null }
}

export const orderMenuTools = <T extends MenuEntry>(tools: T[], order: unknown): T[] => {
  const movable = tools.filter((tool) => tool.isTool !== false)
  const byPath = new Map(movable.map((tool) => [tool.path, tool]))
  return [
    ...tools.filter((tool) => tool.isTool === false),
    ...normalizeToolOrder(order, movable.map((tool) => tool.path)).map((path) => byPath.get(path)!),
  ]
}

export const moveToolPath = (paths: string[], source: string, target: string): string[] => {
  const from = paths.indexOf(source)
  const to = paths.indexOf(target)
  if (from < 0 || to < 0 || from === to) return paths
  const next = [...paths]
  next.splice(from, 1)
  next.splice(to, 0, source)
  return next
}

export const persistToolOrder = (order: string[] | null): boolean => {
  try {
    if (order === null) window.localStorage.removeItem(TOOL_ORDER_STORAGE_KEY)
    else window.localStorage.setItem(TOOL_ORDER_STORAGE_KEY, JSON.stringify(order))
    return true
  } catch { return false }
}
