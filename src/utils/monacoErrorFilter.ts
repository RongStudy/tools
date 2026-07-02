const MONACO_CANCELLATION_ERROR_NAME = 'Canceled'

const isMonacoCancellationError = (value: unknown) => {
  if (!(value instanceof Error)) return false

  const stack = value.stack ?? ''
  return (
    value.name === MONACO_CANCELLATION_ERROR_NAME &&
    value.message === MONACO_CANCELLATION_ERROR_NAME &&
    stack.includes('editor.api')
  )
}

export const suppressMonacoCancellationErrorLogs = () => {
  const originalConsoleError = console.error

  console.error = (...args: unknown[]) => {
    if (args.some(isMonacoCancellationError)) return
    originalConsoleError(...args)
  }

  return () => {
    console.error = originalConsoleError
  }
}
