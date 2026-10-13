import { useCallback, useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor'

export const modelPath = (tool: string, ...parts: string[]) => (
  `inmemory://dev-tools/${tool}/${parts.map(encodeURIComponent).join('/')}`
)

/** Keep tab models alive, and release closed documents after React detaches their editors. */
export const useMonacoModels = (paths: string[]) => {
  const monacoRef = useRef<typeof Monaco | null>(null)
  const ownedPathsRef = useRef(new Set<string>())
  const livePathsRef = useRef(new Set(paths))
  const cleanupTimerRef = useRef<number>()
  const pathsKey = paths.join('\n')
  livePathsRef.current = new Set(paths)

  const releaseUnused = useCallback((all = false) => {
    const monaco = monacoRef.current
    if (!monaco) return
    for (const path of ownedPathsRef.current) {
      if (!all && livePathsRef.current.has(path)) continue
      const model = monaco.editor.getModel(monaco.Uri.parse(path))
      if (model && !monaco.editor.getEditors().some((editor) => editor.getModel() === model)) model.dispose()
      ownedPathsRef.current.delete(path)
    }
  }, [])

  const registerMonaco = useCallback((monaco: typeof Monaco) => {
    monacoRef.current = monaco
    for (const path of livePathsRef.current) ownedPathsRef.current.add(path)
  }, [])

  useEffect(() => {
    for (const path of livePathsRef.current) ownedPathsRef.current.add(path)
    const timer = window.setTimeout(() => releaseUnused(), 0)
    return () => window.clearTimeout(timer)
  }, [pathsKey, releaseUnused])

  useEffect(() => {
    window.clearTimeout(cleanupTimerRef.current)
    return () => {
      cleanupTimerRef.current = window.setTimeout(() => releaseUnused(true), 0)
    }
  }, [releaseUnused])

  return registerMonaco
}
