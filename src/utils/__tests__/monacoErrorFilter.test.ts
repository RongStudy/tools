import { afterEach, describe, expect, it, vi } from 'vitest'
import { suppressMonacoCancellationErrorLogs } from '../monacoErrorFilter'

const originalConsoleError = console.error

afterEach(() => {
  console.error = originalConsoleError
  vi.restoreAllMocks()
})

describe('suppressMonacoCancellationErrorLogs', () => {
  it('filters Monaco cancellation noise', () => {
    const consoleError = vi.fn()
    console.error = consoleError
    const restore = suppressMonacoCancellationErrorLogs()
    const error = new Error('Canceled')
    error.name = 'Canceled'
    error.stack = 'Error: Canceled\n    at of.cancel (editor.api-CalNCsUg.js:7:14851)'

    console.error('ERR', error)

    expect(consoleError).not.toHaveBeenCalled()
    restore()
  })

  it('keeps unrelated errors visible', () => {
    const consoleError = vi.fn()
    console.error = consoleError
    const restore = suppressMonacoCancellationErrorLogs()
    const error = new Error('Something broke')

    console.error('ERR', error)

    expect(consoleError).toHaveBeenCalledWith('ERR', error)
    restore()
  })
})
