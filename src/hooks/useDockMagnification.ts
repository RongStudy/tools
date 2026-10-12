import { useCallback, useEffect, useRef, type PointerEvent } from 'react'

const MOTION_QUERY = '(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const REACH = 130
const MAX_GROWTH = 0.45
const NUDGE = 6
// Build UI's spring (mass 0.1, stiffness 170, damping 12), normalized by mass.
const STIFFNESS = 1700
const DAMPING = 120
type Spring = { value: number; velocity: number; target: number }
type ItemMotion = { scale: Spring; offset: Spring }

const advance = (spring: Spring, elapsed: number) => {
  // Small integration steps keep the spring stable on slow/high-refresh displays.
  const steps = Math.ceil(elapsed / (1 / 240))
  const dt = elapsed / steps
  for (let i = 0; i < steps; i++) {
    spring.velocity += (STIFFNESS * (spring.target - spring.value) - DAMPING * spring.velocity) * dt
    spring.value += spring.velocity * dt
  }
  if (Math.abs(spring.target - spring.value) < 0.0001 && Math.abs(spring.velocity) < 0.001) {
    spring.value = spring.target
    spring.velocity = 0
  }
  return spring.value !== spring.target || spring.velocity !== 0
}

export const useDockMagnification = () => {
  const navRef = useRef<HTMLElement>(null)
  const pointer = useRef<number | null>(null)
  const frame = useRef<number | null>(null)
  const enabled = useRef(false)
  const motions = useRef(new Map<HTMLElement, ItemMotion>())
  const dirty = useRef(false)
  const previousTime = useRef<number | null>(null)

  const reset = useCallback(() => {
    pointer.current = null
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    previousTime.current = null
    dirty.current = false
    motions.current.clear()
    navRef.current?.querySelectorAll<HTMLElement>('.dock-item').forEach((item) => {
      item.style.removeProperty('--dock-scale')
      item.style.removeProperty('--dock-offset')
    })
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.(MOTION_QUERY)
    const sync = () => {
      enabled.current = media?.matches ?? false
      reset()
    }
    sync()
    media?.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('blur', reset)
    return () => {
      media?.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('blur', reset)
      reset()
    }
  }, [reset])

  const schedule = () => {
    if (frame.current !== null) return
    const animate = (time: number) => {
      frame.current = null
      if (dirty.current) {
        // Read every stable slot before writing styles; transformed surfaces never
        // feed back into distance calculations or move the link's hit target.
        const targets = Array.from(navRef.current?.querySelectorAll<HTMLElement>('.dock-item') ?? []).map((item) => {
          const rect = item.getBoundingClientRect()
          const distance = pointer.current === null ? Infinity : pointer.current - rect.top - rect.height / 2
          const proximity = Math.max(0, 1 - Math.abs(distance) / REACH)
          return {
            item,
            scale: 1 + MAX_GROWTH * (1 - Math.cos(Math.PI * proximity)) / 2,
            offset: proximity === 0 ? 0 : -Math.sign(distance) * NUDGE * Math.sin(Math.PI * proximity),
          }
        })
        targets.forEach(({ item, scale, offset }) => {
          let motion = motions.current.get(item)
          if (!motion) {
            motion = { scale: { value: 1, velocity: 0, target: 1 }, offset: { value: 0, velocity: 0, target: 0 } }
            motions.current.set(item, motion)
          }
          motion.scale.target = scale
          motion.offset.target = offset
        })
        dirty.current = false
      }
      const elapsed = previousTime.current === null ? 1 / 60 : Math.min(Math.max((time - previousTime.current) / 1000, 0), 0.032)
      previousTime.current = time
      let moving = false
      motions.current.forEach(({ scale, offset }, item) => {
        const scaling = advance(scale, elapsed)
        const shifting = advance(offset, elapsed)
        moving = moving || scaling || shifting
        item.style.setProperty('--dock-scale', scale.value.toFixed(4))
        item.style.setProperty('--dock-offset', `${offset.value.toFixed(4)}px`)
      })
      if (moving) frame.current = window.requestAnimationFrame(animate)
      else {
        previousTime.current = null
        if (pointer.current === null) reset()
      }
    }
    frame.current = window.requestAnimationFrame(animate)
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!enabled.current || event.pointerType === 'touch') {
      reset()
      return
    }
    pointer.current = event.clientY
    dirty.current = true
    schedule()
  }

  const onPointerLeave = () => {
    pointer.current = null
    dirty.current = true
    if (motions.current.size > 0) schedule()
    else reset()
  }

  return { navRef, onPointerMove, onPointerLeave, reset }
}
