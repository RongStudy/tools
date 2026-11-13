import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import ToolLayout from '../components/ToolLayout'
import ToolIcon from '../components/ToolIcon'
import EditorStatusBar from '../components/EditorStatusBar'
import { useToast } from '../components/toastContext'
import { t, useLocale } from '../i18n'
import { writeTextToClipboard } from '../utils/clipboard'
import { decodeQrImage, generateUrlQr, getQrHttpUrl, QR_IMAGE_TYPES, MAX_QR_IMAGE_BYTES, type QrSize } from '../utils/qrCode'
import './QrCode.css'
import '../styles/common.css'

export default function QrCode() {
  useLocale()
  const [url, setUrl] = useState('')
  const [size, setSize] = useState<QrSize>(512)
  const [generated, setGenerated] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [decoded, setDecoded] = useState('')
  const [decodeError, setDecodeError] = useState('')
  const [decoding, setDecoding] = useState(false)
  const [image, setImage] = useState<{ url: string; name: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const decodeController = useRef<AbortController | null>(null)
  const generateSequence = useRef(0)
  const { showToast } = useToast()
  const decodedUrl = getQrHttpUrl(decoded)

  useEffect(() => () => { decodeController.current?.abort(); generateSequence.current++ }, [])
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])

  const resetGenerated = () => { generateSequence.current++; setGenerated(''); setGenerateError(''); setGenerating(false) }
  const generate = async () => {
    const sequence = ++generateSequence.current
    setGenerating(true)
    setGenerated('')
    setGenerateError('')
    try {
      const result = await generateUrlQr(url, size)
      if (sequence === generateSequence.current) setGenerated(result)
    } catch (error) {
      if (sequence === generateSequence.current) setGenerateError(error instanceof Error ? error.message : t('二维码生成失败'))
    } finally { if (sequence === generateSequence.current) setGenerating(false) }
  }

  const scan = async (file: File) => {
    decodeController.current?.abort()
    const controller = new AbortController()
    decodeController.current = controller
    setDecoded('')
    setDecodeError('')
    setDecoding(true)
    setImage(QR_IMAGE_TYPES.includes(file.type) && file.size <= MAX_QR_IMAGE_BYTES
      ? { url: URL.createObjectURL(file), name: file.name } : null)
    try {
      const content = await decodeQrImage(file, controller.signal)
      if (!controller.signal.aborted) setDecoded(content)
    } catch (error) {
      if (!controller.signal.aborted) setDecodeError(error instanceof Error ? error.message : t('图片解析失败，请重试'))
    } finally { if (!controller.signal.aborted) setDecoding(false) }
  }

  const pasteImage = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error()
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((candidate) => QR_IMAGE_TYPES.includes(candidate))
        if (type) { void scan(new File([await item.getType(type)], 'clipboard.png', { type })); return }
      }
      setDecodeError(t('剪贴板中没有图片，请复制二维码图片后重试'))
    } catch { setDecodeError(t('无法读取剪贴板，请上传图片或在图片区域粘贴')) }
  }
  const onPaste = (event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
    if (file) { event.preventDefault(); void scan(file) }
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void scan(file)
  }
  const clearScan = () => {
    decodeController.current?.abort()
    setDecoding(false); setDecoded(''); setDecodeError(''); setImage(null)
  }
  const copyDecoded = async () => {
    const success = await writeTextToClipboard(decoded)
    showToast(t(success ? '已复制到剪贴板' : '复制失败'), success ? 'success' : 'error')
  }

  return <ToolLayout title={t('二维码')} className="qr-tool">
    <div className="qr-grid">
      <section className="editor-panel qr-panel" aria-label={t('URL 生成二维码')}>
        <div className="panel-header">
          <span>{t('URL 生成二维码')}</span>
          <div className="panel-actions">
            <button type="button" className="btn-small" onClick={() => { resetGenerated(); setUrl('https://example.com/docs?source=qr') }}>{t('示例')}</button>
            <button type="button" className="btn-small" onClick={() => { resetGenerated(); setUrl('') }}>{t('清空')}</button>
          </div>
        </div>
        <form className="qr-form" onSubmit={(event) => { event.preventDefault(); void generate() }}>
          <label className="qr-field">
            <span>URL</span>
            <textarea aria-label={t('二维码 URL')} placeholder="https://example.com" value={url} onChange={(event) => { resetGenerated(); setUrl(event.target.value) }} spellCheck={false} />
          </label>
          <div className="qr-generate-actions">
            <label className="qr-size"><span>{t('图片尺寸')}</span><select aria-label={t('图片尺寸')} value={size} onChange={(event) => { resetGenerated(); setSize(Number(event.target.value) as QrSize) }}>
              {[256, 512, 1024].map((value) => <option key={value} value={value}>{value} × {value}</option>)}
            </select></label>
            <button type="submit" className="btn btn-primary" disabled={generating || !url.trim()}>{t(generating ? '生成中…' : '生成二维码')}</button>
          </div>
        </form>
        <div className="qr-generated" aria-busy={generating}>
          {generated ? <img src={generated} alt={t('生成的二维码')} /> : <div className="qr-placeholder"><ToolIcon name="qr" /><span>{t('输入 URL，生成二维码')}</span></div>}
        </div>
        <div className="qr-export">
          {generated ? <a className="btn btn-secondary" href={generated} download="qr-code.png">{t('下载 PNG')}</a> : <button type="button" className="btn btn-secondary" disabled>{t('下载 PNG')}</button>}
        </div>
        <EditorStatusBar text={url} label={t('二维码生成')} error={generateError}>{generated && !generateError && <span>{t('二维码已生成')}</span>}</EditorStatusBar>
      </section>
      <section className={'editor-panel qr-panel' + (dragging ? ' qr-dragging' : '')} aria-label={t('解析二维码')} onPaste={onPaste}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={onDrop}>
        <div className="panel-header">
          <span>{t('解析二维码')}</span>
          <div className="panel-actions">
            <button type="button" className="btn-small" onClick={() => inputRef.current?.click()}>{t('上传图片')}</button>
            <button type="button" className="btn-small" onClick={() => void pasteImage()}>{t('粘贴图片')}</button>
            <button type="button" className="btn-small" onClick={clearScan}>{t('清空')}</button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept={QR_IMAGE_TYPES.join(',')} aria-label={t('二维码图片')} hidden onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ''; if (file) void scan(file)
        }} />
        <button type="button" className="qr-upload" onClick={() => inputRef.current?.click()} aria-label={t('选择或粘贴二维码图片')} aria-busy={decoding}>
          {image ? <img src={image.url} alt={t('待解析的二维码图片')} /> : <ToolIcon name="qr" />}
          <span>{t(decoding ? '正在解析二维码…' : '拖入图片，或点击上传')}</span>
          <small>{t('支持粘贴截图 · PNG / JPEG / WebP / GIF / BMP · 最大 10 MB')}</small>
          {image && <small className="qr-filename">{image.name}</small>}
        </button>
        <div className="qr-result-heading"><label htmlFor="qr-decoded">{t('解析结果')}</label>
          <div className="panel-actions">
            <button type="button" className="btn-small" disabled={!decoded} onClick={() => void copyDecoded()}>{t('复制')}</button>
            {decodedUrl && <a className="btn-small" href={decodedUrl} target="_blank" rel="noopener noreferrer">{t('打开 URL')}</a>}
          </div>
        </div>
        <textarea id="qr-decoded" className="qr-decoded" value={decoded} readOnly placeholder={t('识别到的 URL 或文本将显示在这里')} spellCheck={false} />
        <EditorStatusBar text={decoded} label={t('二维码解析')} error={decodeError}>
          {!decodeError && <span>{t(decoded ? (decodedUrl ? '已识别 URL' : '二维码内容不是 HTTP / HTTPS URL') : '图片仅在本地解析')}</span>}
        </EditorStatusBar>
      </section>
    </div>
  </ToolLayout>
}
