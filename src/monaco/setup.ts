import type { MonacoSetup } from './types'

let initialization: ReturnType<MonacoSetup> | undefined

/** Both targets load the same local ESM runtime before any editor mounts. */
export const setupMonaco: MonacoSetup = () => {
  initialization ??= import('./runtime').then(({ initializeMonaco }) => initializeMonaco()).catch((error: unknown) => {
    initialization = undefined
    throw error
  })
  return initialization
}
