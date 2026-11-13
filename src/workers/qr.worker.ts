import jsQR from 'jsqr'

self.onmessage = (event: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number }>) => {
  const { data, width, height } = event.data
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  self.postMessage({ content: result?.data ?? '' })
}
