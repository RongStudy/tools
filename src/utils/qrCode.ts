import QRCode from 'qrcode'
import { t } from '../i18n'

export const QR_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']
export const MAX_QR_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_PIXELS = 24_000_000
const MAX_SCAN_SIDE = 2048
export type QrSize = 256 | 512 | 1024

export const getQrHttpUrl = (text: string): string | null => {
  const value = text.trim()
  if (!/^https?:\/\//i.test(value) || Array.from(value).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return null
  try {
    const parsed = new URL(value)
    return parsed.hostname && ['http:', 'https:'].includes(parsed.protocol) ? value : null
  } catch { return null }
}

export const generateUrlQr = async (text: string, size: QrSize): Promise<string> => {
  const value = getQrHttpUrl(text)
  if (!value) throw new Error(t('请输入有效的 HTTP 或 HTTPS URL'))
  try {
    return await QRCode.toDataURL(value, {
      width: size, margin: 4, errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    })
  } catch {
    throw new Error(t('URL 过长，无法生成二维码，请缩短后重试'))
  }
}

const cancelled = () => new DOMException('Cancelled', 'AbortError')
const readQrPixels = (file: File, signal: AbortSignal): Promise<ImageData> => {
  if (signal.aborted) return Promise.reject(cancelled())
  if (!QR_IMAGE_TYPES.includes(file.type)) return Promise.reject(new Error(t('请选择 PNG、JPEG、WebP、GIF 或 BMP 图片')))
  if (file.size > MAX_QR_IMAGE_BYTES) return Promise.reject(new Error(t('图片不能超过 10 MB')))
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', abort)
      URL.revokeObjectURL(url)
    }
    const abort = () => { cleanup(); image.src = ''; reject(cancelled()) }
    signal.addEventListener('abort', abort, { once: true })
    image.onerror = () => { cleanup(); reject(new Error(t('无法读取图片，请选择有效的图片文件'))) }
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
          throw new Error(t('图片尺寸过大，请裁剪二维码区域后重试'))
        }
        const scale = Math.min(1, MAX_SCAN_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error(t('当前浏览器不支持图片解析'))
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(context.getImageData(0, 0, canvas.width, canvas.height))
      } catch (error) { reject(error) }
      finally { cleanup() }
    }
    image.src = url
  })
}

export const decodeQrImage = async (file: File, signal: AbortSignal): Promise<string> => {
  const pixels = await readQrPixels(file, signal)
  if (signal.aborted) throw cancelled()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/qr.worker.ts', import.meta.url), { type: 'module' })
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate() }
    const abort = () => { cleanup(); reject(cancelled()) }
    const timer = setTimeout(() => { cleanup(); reject(new Error(t('解析超时，请裁剪二维码区域后重试'))) }, 15_000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<{ content?: string }>) => {
      cleanup()
      if (event.data.content) resolve(event.data.content)
      else reject(new Error(t('未识别到二维码，请使用清晰、完整的二维码图片')))
    }
    worker.onerror = () => { cleanup(); reject(new Error(t('图片解析失败，请重试'))) }
    worker.postMessage({ data: pixels.data, width: pixels.width, height: pixels.height }, [pixels.data.buffer])
  })
}
