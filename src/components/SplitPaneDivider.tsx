import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import {
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
} from '../hooks/useSplitPane'
import './SplitPaneDivider.css'

const SPLIT_KEYBOARD_STEP = 2

type SplitPaneDividerProps = {
  containerRef: RefObject<HTMLElement>
  ratio: number
  onRatioChange: (ratio: number) => void
  label?: string
}

const SplitPaneDivider = ({
  containerRef,
  ratio,
  onRatioChange,
  label = '调整两侧宽度',
}: SplitPaneDividerProps) => {
  const activePointerIdRef = useRef<number | null>(null)

  const updateRatioFromPointer = (clientX: number) => {
    const container = containerRef.current
    if (!container) return

    const bounds = container.getBoundingClientRect()
    if (bounds.width <= 0) return

    const nextRatio = ((clientX - bounds.left) / bounds.width) * 100
    onRatioChange(clampSplitRatio(nextRatio))
  }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    activePointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateRatioFromPointer(event.clientX)
    event.preventDefault()
  }

  const moveDivider = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    updateRatioFromPointer(event.clientX)
    event.preventDefault()
  }

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    activePointerIdRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextRatio = ratio

    if (event.key === 'ArrowLeft') nextRatio -= SPLIT_KEYBOARD_STEP
    else if (event.key === 'ArrowRight') nextRatio += SPLIT_KEYBOARD_STEP
    else if (event.key === 'Home') nextRatio = MIN_SPLIT_RATIO
    else if (event.key === 'End') nextRatio = MAX_SPLIT_RATIO
    else return

    event.preventDefault()
    onRatioChange(clampSplitRatio(nextRatio))
  }

  return (
    <div
      className="split-pane-divider"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={MIN_SPLIT_RATIO}
      aria-valuemax={MAX_SPLIT_RATIO}
      aria-valuenow={Math.round(ratio)}
      tabIndex={0}
      title="拖动调整两侧宽度，双击重置"
      onPointerDown={startDrag}
      onPointerMove={moveDivider}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onRatioChange(DEFAULT_SPLIT_RATIO)}
    >
      <span aria-hidden="true" />
    </div>
  )
}

export default SplitPaneDivider
