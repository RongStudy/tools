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
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
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
    showToast(success ? '已复制到剪贴板' : '复制失败', success ? 'success' : 'error')
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

  const toolbar = (
    <div className="url-codec-toolbar">
      <div className="url-codec-mode" aria-label="编码范围">
        <button
          type="button"
          className={mode === 'component' ? 'active' : ''}
          onClick={() => setMode('component')}
        >
          参数值
        </button>
        <button
          type="button"
          className={mode === 'url' ? 'active' : ''}
          onClick={() => setMode('url')}
        >
          完整 URL
        </button>
      </div>
      <div className="url-codec-action-group" aria-label="URL 操作">
        <span>URL</span>
        <button type="button" className="btn btn-primary" aria-label="URL Encode" onClick={encode}>编码</button>
        <button type="button" className="btn btn-secondary" aria-label="URL Decode" onClick={decode}>解码</button>
      </div>
      <div className="url-codec-action-group" aria-label="Base64 操作">
        <span>Base64</span>
        <button type="button" className="btn btn-primary" aria-label="Base64 Encode" onClick={base64Encode}>编码</button>
        <button type="button" className="btn btn-secondary" aria-label="Base64 Decode" onClick={base64Decode}>解码</button>
      </div>
      <div className="url-codec-action-group" aria-label="Unicode 操作">
        <span>Unicode</span>
        <button type="button" className="btn btn-primary" aria-label="Unicode Encode" onClick={encodeUnicode}>编码</button>
        <button type="button" className="btn btn-secondary" aria-label="Unicode Decode" onClick={decodeUnicode}>解码</button>
      </div>
      <div className="url-codec-action-group" aria-label="摘要操作">
        <span>摘要</span>
        <button type="button" className="btn btn-secondary" onClick={() => createDigest('md5')}>MD5</button>
        <button type="button" className="btn btn-secondary" onClick={() => createDigest('sha256')}>SHA-256</button>
      </div>
      <div className="url-codec-utility-group">
        <button type="button" className="btn btn-secondary" onClick={swapOutputToInput} disabled={!output}>结果转输入</button>
        <button type="button" className="btn btn-danger" onClick={clearAll}>清空</button>
      </div>
    </div>
  )

  return (
    <ToolLayout
      className="url-codec"
      title="编解码"
      description="处理 URL、Base64、Unicode 编解码，以及文本的 MD5、SHA-256 摘要"
      actions={toolbar}
      status={error ? <div className="url-codec-error">{error}</div> : null}
    >
      <div
        ref={gridRef}
        className="url-codec-grid"
        style={getSplitPaneGridStyle(splitRatio)}
      >
        <section className="url-codec-panel">
          <div className="url-codec-panel-header">
            <span>输入</span>
            <button type="button" className="btn-small" onClick={() => void writeTextToClipboard(input)} disabled={!input}>
              复制
            </button>
          </div>
          <textarea
            aria-label="编解码输入"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入需要编码、解码或生成摘要的文本..."
            spellCheck={false}
          />
        </section>

        <SplitPaneDivider
          containerRef={gridRef}
          ratio={splitRatio}
          onRatioChange={setSplitRatio}
          label="调整输入输出宽度"
        />

        <section className="url-codec-panel">
          <div className="url-codec-panel-header">
            <span>输出</span>
            <button type="button" className="btn-small" onClick={copyOutput} disabled={!output}>
              复制
            </button>
          </div>
          <textarea
            aria-label="编解码输出"
            value={output}
            readOnly
            placeholder="处理结果会显示在这里"
            spellCheck={false}
          />
        </section>
      </div>
    </ToolLayout>
  )
}

export default UrlCodec
