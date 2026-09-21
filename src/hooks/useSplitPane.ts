import { useEffect, useState, type CSSProperties } from 'react'
import { readExpiringStorage, TWO_DAYS_IN_MS, writeExpiringStorage } from '../utils/expiringStorage'

export const DEFAULT_SPLIT_RATIO = 30
export const MIN_SPLIT_RATIO = 20
export const MAX_SPLIT_RATIO = 80

export const clampSplitRatio = (value: number) => (
  Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value))
)

export const getSplitPaneGridStyle = (ratio: number) => ({
  '--split-pane-start-ratio': `${ratio}fr`,
  '--split-pane-end-ratio': `${100 - ratio}fr`,
}) as CSSProperties

export const usePersistentSplitRatio = (storageKey: string) => {
  const [ratio, setRatio] = useState(() => {
    const savedRatio = readExpiringStorage<unknown>(storageKey)
    return typeof savedRatio === 'number' && Number.isFinite(savedRatio)
      ? clampSplitRatio(savedRatio)
      : DEFAULT_SPLIT_RATIO
  })

  useEffect(() => {
    writeExpiringStorage(storageKey, ratio, TWO_DAYS_IN_MS)
  }, [ratio, storageKey])

  return [ratio, setRatio] as const
}
