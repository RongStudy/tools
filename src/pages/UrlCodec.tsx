import { t, useLocale } from '../i18n'
import EditorStatusBar from '../components/EditorStatusBar'
import { useRef, useState } from 'react'
import SplitPaneDivider from '../components/SplitPaneDivider'
import {
  getSplitPaneGridStyle,
  usePersistentSplitRatio,
} from '../hooks/useSplitPane'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { writeTextToClipboard } from '../utils/clipboard'
import { md5, sha256 } from '../utils/hash'
import './UrlCodec.css'
import '../styles/common.css'

type CodecMode = 'component' | 'url'

const URL_CODEC_SPLIT_RATIO_KEY = 'dev-tools:url-codec:split-ratio'

const textToBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize))
  }

  return btoa(binary)
}

const base64ToText = (value: string) => {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

const unicodeEncode = (value: string) => Array.from(value)
  .map((character) => {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined) return character
    if (codePoint <= 0xffff) return `\\u${codePoint.toString(16).padStart(4, '0')}`

    const adjustedCodePoint = codePoint - 0x10000
    const highSurrogate = 0xd800 + (adjustedCodePoint >> 10)
    const lowSurrogate = 0xdc00 + (adjustedCodePoint & 0x3ff)
    return `\\u${highSurrogate.toString(16)}\\u${lowSurrogate.toString(16)}`
  })
  .join('')

const unicodeDecode = (value: string) => value.replace(
  /\\u\{([\da-fA-F]{1,6})\}|\\u([\da-fA-F]{4})/g,
  (match, codePointValue?: string, codeUnitValue?: string) => {
    const hexValue = codePointValue ?? codeUnitValue
    if (!hexValue) return match
    const codePoint = Number.parseInt(hexValue, 16)
    return Number.isNaN(codePoint) || codePoint > 0x10ffff ? match : String.fromCodePoint(codePoint)
  }
)

const UrlCodec = () => {
  useLocale()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [method, setMethod] = useState<'url' | 'base64' | 'unicode' | 'digest'>('url')
  const [mode, setMode] = useState<CodecMode>('component')
  const [error, setError] = useState('')
  const [splitRatio, setSplitRatio] = usePersistentSplitRatio(URL_CODEC_SPLIT_RATIO_KEY)
  const gridRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  const encode = () => {
    try {
      setError('')
      setOutput(mode === 'component' ? encodeURIComponent(input) : encodeURI(input))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const decode = () => {
    try {
      setError('')
      setOutput(mode === 'component' ? decodeURIComponent(input) : decodeURI(input))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const base64Encode = () => {
    try {
      setError('')
      setOutput(textToBase64(input))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const base64Decode = () => {
    try {
      setError('')
      setOutput(base64ToText(input))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const encodeUnicode = () => {
    setError('')
    setOutput(unicodeEncode(input))
  }

  const decodeUnicode = () => {
    try {
      setError('')
      setOutput(unicodeDecode(input))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const createDigest = (algorithm: 'md5' | 'sha256') => {
    setError('')
    setOutput(algorithm === 'md5' ? md5(input) : sha256(input))
  }

  const copyOutput = async () => {
    const success = await writeTextToClipboard(output)
    showToast(success ? t("已复制到剪贴板") : t("复制失败"), success ? 'success' : 'error')
  }

  const swapOutputToInput = () => {
    setInput(output)
    setOutput('')
    setError('')
  }

  const clearAll = () => {
    setInput('')
    setOutput('')
    setError('')
  }

  const toolbar = <>
    <button type="button" className="btn btn-danger" onClick={clearAll}>{t('清空')}</button>
  </>

  const workflow = <div className="tool-workflow">
    <div className="tool-workflow-tabs" role="tablist" aria-label={t('处理类型')} onKeyDown={(event) => {
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
      if (next < 0) return
      event.preventDefault()
      tabs[next].focus()
      tabs[next].click()
    }}>
      {(['url', 'base64', 'unicode', 'digest'] as const).map((value) => <button key={value} type="button" role="tab" tabIndex={method === value ? 0 : -1} aria-selected={method === value} onClick={() => { setMethod(value); setError('') }}>{value === 'url' ? 'URL' : value === 'base64' ? 'Base64' : value === 'unicode' ? 'Unicode' : t('摘要')}</button>)}
    </div>
    <div className="tool-workflow-actions">
      {method === 'url' && <select className="codec-scope" aria-label={t('编码范围')} value={mode} onChange={(event) => setMode(event.target.value as CodecMode)}>
        <option value="component">{t('参数值')}</option><option value="url">{t('完整 URL')}</option>
      </select>}
      {method === 'digest' ? <>
        <button type="button" className="btn btn-primary" onClick={() => createDigest('md5')}>MD5</button>
        <button type="button" className="btn btn-secondary" onClick={() => createDigest('sha256')}>SHA-256</button>
      </> : <>
        <button type="button" className="btn btn-primary" aria-label={(method === 'url' ? 'URL' : method === 'base64' ? 'Base64' : 'Unicode') + ' Encode'} onClick={method === 'url' ? encode : method === 'base64' ? base64Encode : encodeUnicode}>{t('编码')}</button>
        <button type="button" className="btn btn-secondary" aria-label={(method === 'url' ? 'URL' : method === 'base64' ? 'Base64' : 'Unicode') + ' Decode'} onClick={method === 'url' ? decode : method === 'base64' ? base64Decode : decodeUnicode}>{t('解码')}</button>
      </>}
    </div>
  </div>

  return (
    <ToolLayout
      className="url-codec"
      title={t("编解码")}
      actions={toolbar}
      controls={workflow}
    >
      <div
        ref={gridRef}
        className="url-codec-grid"
        style={getSplitPaneGridStyle(splitRatio)}
      >
        <section className="url-codec-panel">
          <div className="panel-header">
            <span>{t("输入")}</span>
            <button type="button" className="btn-small" onClick={() => void writeTextToClipboard(input)} disabled={!input}>
              {t("复制")}</button>
          </div>
          <textarea
            aria-label={t("编解码输入")}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("输入需要编码、解码或生成摘要的文本...")}
            spellCheck={false}
          />
          <EditorStatusBar text={input} label={t("编解码输入")} />
        </section>

        <SplitPaneDivider
          containerRef={gridRef}
          ratio={splitRatio}
          onRatioChange={setSplitRatio}
          label={t("调整输入输出宽度")}
        />

        <section className="url-codec-panel">
          <div className="panel-header">
            <span>{t("输出")}</span>
            <div className="panel-actions">
              <button type="button" className="btn-small" onClick={swapOutputToInput} disabled={!output}>{t('结果转输入')}</button>
              <button type="button" className="btn-small" onClick={copyOutput} disabled={!output}>{t('复制')}</button>
            </div>
          </div>
          <textarea
            aria-label={t("编解码输出")}
            value={output}
            readOnly
            placeholder={t("处理结果会显示在这里")}
            spellCheck={false}
          />
          <EditorStatusBar text={output} label={t("编解码输出")} error={error} />
        </section>
      </div>
    </ToolLayout>
  )
}

export default UrlCodec
