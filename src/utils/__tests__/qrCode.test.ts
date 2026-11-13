import { afterEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { decodeQrImage, generateUrlQr, getQrHttpUrl, MAX_QR_IMAGE_BYTES } from '../qrCode'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('QR URLs', () => {
  it.each(['https://example.com/docs?a=1&b=2#anchor', 'http://localhost:3000/tools', 'https://example.com/中文?q=✓'])('accepts and preserves %s', (url) => {
    expect(getQrHttpUrl('  ' + url + '  ')).toBe(url)
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', '//example.com', 'https://', 'not a url', 'https://exa mple.com', 'https://example.com/\ntest'])('rejects unsafe or invalid URL %s', async (url) => {
    expect(getQrHttpUrl(url)).toBeNull()
    await expect(generateUrlQr(url, 512)).rejects.toThrow('请输入有效')
  })
  it.each(['https://example.com/docs?q=hello&lang=en#section', 'https://example.com/中文?q=✓'])('round trips the real QR encoder and decoder with %s', (url) => {
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
    const scale = 6, margin = 4, size = (qr.modules.size + margin * 2) * scale
    const data = new Uint8ClampedArray(size * size * 4).fill(255)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin, my = Math.floor(y / scale) - margin
      if (mx >= 0 && my >= 0 && mx < qr.modules.size && my < qr.modules.size && qr.modules.get(my, mx)) {
        const offset = (y * size + x) * 4
        data[offset] = data[offset + 1] = data[offset + 2] = 0
      }
    }
    expect(jsQR(data, size, size)?.data).toBe(url)
  })
  it('rejects invalid files, oversized images and cancelled scans before allocating images', async () => {
    await expect(decodeQrImage(new File(['x'], 'test.svg', { type: 'image/svg+xml' }), new AbortController().signal)).rejects.toThrow('请选择')
    const large = new File(['x'], 'large.png', { type: 'image/png' })
    Object.defineProperty(large, 'size', { value: MAX_QR_IMAGE_BYTES + 1 })
    await expect(decodeQrImage(large, new AbortController().signal)).rejects.toThrow('10 MB')
    const controller = new AbortController(); controller.abort()
    await expect(decodeQrImage(new File([], 'test.png', { type: 'image/png' }), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
