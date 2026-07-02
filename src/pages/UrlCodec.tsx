import { useState } from 'react'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { writeTextToClipboard } from '../utils/clipboard'
import './UrlCodec.css'
import '../styles/common.css'

type CodecMode = 'component' | 'url'

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

const UrlCodec = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<CodecMode>('component')
  const [error, setError] = useState('')
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
      <div className="url-codec-utility-group">
        <button type="button" className="btn btn-secondary" onClick={swapOutputToInput} disabled={!output}>结果转输入</button>
        <button type="button" className="btn btn-danger" onClick={clearAll}>清空</button>
      </div>
    </div>
  )

  return (
    <ToolLayout
      className="url-codec"
      title="URL / Base64 编码解码"
      description="对 URL 参数值、完整 URL 或文本进行 Base64 encode/decode 处理"
      actions={toolbar}
      status={error ? <div className="url-codec-error">{error}</div> : null}
    >
      <div className="url-codec-grid">
        <section className="url-codec-panel">
          <div className="url-codec-panel-header">
            <span>输入</span>
            <button type="button" className="btn-small" onClick={() => void writeTextToClipboard(input)} disabled={!input}>
              复制
            </button>
          </div>
          <textarea
            aria-label="URL输入"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入需要编码或解码的 URL、参数值、查询字符串..."
            spellCheck={false}
          />
        </section>

        <section className="url-codec-panel">
          <div className="url-codec-panel-header">
            <span>输出</span>
            <button type="button" className="btn-small" onClick={copyOutput} disabled={!output}>
              复制
            </button>
          </div>
          <textarea
            aria-label="URL输出"
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
