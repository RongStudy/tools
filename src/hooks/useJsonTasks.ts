import { useCallback, useEffect, useRef, useState } from 'react'
import { transformJson, type JsonOperation } from '../utils/jsonText'
import { LARGE_JSON_THRESHOLD, runJsonTask } from '../utils/jsonRunner'

type Result = { output: string; error: string }
type Job = { controller: AbortController; timer?: ReturnType<typeof setTimeout> }

export const useJsonTasks = () => {
  const jobs = useRef(new Map<string, Job>())
  const [busyIds, setBusyIds] = useState<string[]>([])
  const cancel = useCallback((id: string) => {
    const job = jobs.current.get(id)
    if (job) { clearTimeout(job.timer); job.controller.abort(); jobs.current.delete(id) }
    setBusyIds((ids) => ids.filter((busyId) => busyId !== id))
  }, [])
  useEffect(() => {
    const currentJobs = jobs.current
    return () => { currentJobs.forEach((job) => { clearTimeout(job.timer); job.controller.abort() }); currentJobs.clear() }
  }, [])
  const process = useCallback((id: string, text: string, operation: JsonOperation, indent: number, onResult: (result: Result) => void, debounce = false) => {
    cancel(id)
    const failure = (error: unknown): Result => ({ output: '', error: `${operation === 'format' || operation === 'compress' ? '格式' : '处理'}错误: ${error instanceof Error ? error.message : String(error)}` })
    if (text.length < LARGE_JSON_THRESHOLD) {
      try { onResult({ output: transformJson(text, operation, indent), error: '' }) }
      catch (error) { onResult(failure(error)) }
      return
    }
    const job: Job = { controller: new AbortController() }
    jobs.current.set(id, job)
    setBusyIds((ids) => [...ids.filter((busyId) => busyId !== id), id])
    job.timer = setTimeout(() => {
      void runJsonTask(text, operation, indent, job.controller.signal).then((output) => {
        if (!job.controller.signal.aborted) onResult({ output, error: '' })
      }).catch((error: unknown) => {
        if (!job.controller.signal.aborted) onResult(failure(error))
      }).finally(() => { if (jobs.current.get(id) === job) cancel(id) })
    }, debounce ? 300 : 0)
  }, [cancel])
  return { process, cancel, busyIds }
}
