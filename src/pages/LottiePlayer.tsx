import { t, useLocale } from '../i18n'
import EditorStatusBar from '../components/EditorStatusBar'
import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import lottie from 'lottie-web/build/player/lottie_light'
import type { AnimationItem } from 'lottie-web'
import SplitPaneDivider from '../components/SplitPaneDivider'
import ToolLayout from '../components/ToolLayout'
import ToolOptions from '../components/ToolOptions'
import { getSplitPaneGridStyle, usePersistentSplitRatio } from '../hooks/useSplitPane'
import { languageEditorOptions } from '../monaco/languageCapabilities'
import { useToast } from '../components/toastContext'
import { useAppTheme } from '../themeContext'
import { writeTextToClipboard } from '../utils/clipboard'
import { parseAnimationUrl, parseLottieJson, prepareLottieData, validateLottieData, type LottieData } from '../utils/lottie'
import pulse from '../assets/lottie/pulse.json'
import orbit from '../assets/lottie/orbit.json'
import bars from '../assets/lottie/bars.json'
import './LottiePlayer.css'

const samples = [
  { name: '脉冲', data: pulse },
  { name: '轨道', data: orbit },
  { name: '加载条', data: bars },
]
const initialData = validateLottieData(pulse)
const getError = (error: unknown) => error instanceof Error ? error.message : t("动画加载失败，请检查 JSON。")
type AnimationSource = { data: LottieData; baseUrl: string; autoplay: boolean }
type PlaybackStatus = 'loading' | 'playing' | 'paused' | 'empty' | 'error'

const LottiePlayer = () => {
  useLocale()
  const { monacoTheme } = useAppTheme()
  const [json, setJson] = useState(() => JSON.stringify(pulse, null, 2))
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loop, setLoop] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [status, setStatus] = useState<PlaybackStatus>('loading')
  const [animation, setAnimation] = useState<AnimationSource | null>(() => ({
    data: initialData,
    baseUrl: window.location.href,
    autoplay: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  }))
  const [splitRatio, setSplitRatio] = usePersistentSplitRatio('dev-tools:lottie:split-ratio')
  const gridRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<AnimationItem | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const sourceUrlRef = useRef(window.location.href)
  const optionsRef = useRef({ loop, speed })
  const { showToast } = useToast()
  optionsRef.current = { loop, speed }

  useEffect(() => {
    if (!animation || !previewRef.current) return
    let player: AnimationItem | undefined
    let active = true
    setStatus('loading')
    try {
      player = lottie.loadAnimation({
        container: previewRef.current,
        renderer: 'svg',
        loop: optionsRef.current.loop,
        autoplay: animation.autoplay,
        animationData: prepareLottieData(animation.data, animation.baseUrl),
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      })
      playerRef.current = player
      player.setSpeed(optionsRef.current.speed)
      const ready = () => { if (active) setStatus(animation.autoplay ? 'playing' : 'paused') }
      player.addEventListener('DOMLoaded', ready)
      player.addEventListener('complete', () => { if (active) setStatus('paused') })
      player.addEventListener('data_failed', () => {
        if (!active) return
        setError(t("动画资源加载失败，请检查图片链接及其跨域配置。"))
        setStatus('error')
      })
      player.addEventListener('error', () => {
        if (!active) return
        player?.pause()
        setError(t("动画渲染失败，请检查图层和资源数据。"))
        setStatus('error')
      })
      if (player.isLoaded) ready()
    } catch (cause) {
      setError(getError(cause))
      setStatus('error')
    }
    return () => {
      active = false
      player?.destroy()
      playerRef.current = null
    }
  }, [animation])

  useEffect(() => { playerRef.current?.setLoop(loop) }, [loop])
  useEffect(() => { playerRef.current?.setSpeed(speed) }, [speed])
  useEffect(() => () => { requestRef.current?.abort() }, [])

  const cancelRequest = () => {
    requestRef.current?.abort()
    requestRef.current = null
    setLoading(false)
  }

  const playJson = () => {
    cancelRequest()
    try {
      const data = parseLottieJson(json)
      prepareLottieData(data, sourceUrlRef.current)
      setError('')
      setAnimation({ data, baseUrl: sourceUrlRef.current, autoplay: true })
    } catch (cause) { setError(getError(cause)) }
  }

  const loadUrl = async (target = url) => {
    cancelRequest()
    let parsed: URL
    try { parsed = parseAnimationUrl(target) } catch (cause) { setError(getError(cause)); return }
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')
    const timeout = window.setTimeout(() => {
      if (requestRef.current !== controller) return
      controller.abort()
      requestRef.current = null
      setLoading(false)
      setError(t("加载超时，请检查链接或稍后重试。"))
    }, 20000)
    try {
      const response = await fetch(parsed.href, { signal: controller.signal, credentials: 'omit' })
      if (!response.ok) throw new Error(t("加载失败：HTTP {value0}", { value0: response.status }))
      const text = await response.text()
      if (controller.signal.aborted || requestRef.current !== controller) return
      const data = parseLottieJson(text)
      const baseUrl = response.url || parsed.href
      // Always show the fetched JSON, even when an unsupported resource prevents playback.
      setJson(JSON.stringify(data, null, 2))
      sourceUrlRef.current = baseUrl
      setAnimation({ data, baseUrl, autoplay: true })
    } catch (cause) {
      if (controller.signal.aborted || requestRef.current !== controller) return
      setError(cause instanceof TypeError
        ? t("无法读取动画链接，请检查网络和 CORS 配置。也可将 JSON 粘贴到左侧播放。")
        : getError(cause))
    } finally {
      window.clearTimeout(timeout)
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }

  const changeJson = (value: string | undefined) => {
    cancelRequest()
    setJson(value ?? '')
    setError('')
  }
  const clear = () => {
    cancelRequest()
    setJson('')
    setUrl('')
    setAnimation(null)
    setStatus('empty')
    setError('')
    sourceUrlRef.current = window.location.href
  }
  const format = () => {
    try { setJson(JSON.stringify(JSON.parse(json), null, 2)); setError('') }
    catch { setError(t("JSON 格式错误，请检查后重新格式化。")) }
  }
  const copy = async () => {
    const success = await writeTextToClipboard(json)
    showToast(success ? t("已复制 JSON") : t("复制失败"), success ? 'success' : 'error')
  }
  const togglePlayback = () => {
    if (!playerRef.current) return
    if (status === 'playing') { playerRef.current.pause(); setStatus('paused') }
    else { playerRef.current.play(); setStatus('playing') }
  }
  const canControl = status === 'playing' || status === 'paused'

  return (
    <ToolLayout
      className="lottie-player"
      title={t("Lottie 动画")}
      actions={<ToolOptions label={t('示例动画')} closeOnAction>

          {samples.map((sample) => <button key={t(sample.name)} type="button" className="btn-small" onClick={() => {
            cancelRequest()
            setUrl('')
            setJson(JSON.stringify(sample.data, null, 2))
            setError('')
            sourceUrlRef.current = window.location.href
            setAnimation({ data: validateLottieData(sample.data), baseUrl: window.location.href, autoplay: true })
          }}>{t(sample.name)}</button>)}
        </ToolOptions>}
    >
      <div className="lottie-source">
        <form className="lottie-url-form" onSubmit={(event) => { event.preventDefault(); void loadUrl() }}>
          <label htmlFor="lottie-url">{t("动画 URL")}</label>
          <input id="lottie-url" type="text" value={url} onChange={(event) => { cancelRequest(); setUrl(event.target.value) }} placeholder="https://example.com/animation.json" spellCheck={false} />
          <button type="submit" className="btn btn-primary">{loading ? t("重新加载") : t("加载并播放")}</button>
        </form>

      </div>
      <div ref={gridRef} className="lottie-workspace" style={getSplitPaneGridStyle(splitRatio)}>
        <section className="editor-panel lottie-editor-panel">
          <div className="panel-header">
            <span>JSON</span>
            <div className="panel-actions">
              <button type="button" className="btn-small" onClick={() => void copy()} disabled={!json}>{t("复制")}</button>
              <button type="button" className="btn-small btn-primary" onClick={playJson} disabled={!json.trim()}>{t("播放 JSON")}</button>
              <ToolOptions compact closeOnAction>
                <button type="button" className="btn-small" onClick={format} disabled={!json}>{t("格式化")}</button>
                <button type="button" className="btn-small" onClick={clear}>{t("清空")}</button>
              </ToolOptions>
            </div>
          </div>
          <div className="lottie-editor">
            <Editor height="100%" language="json" value={json} onChange={changeJson}
              loading={<div className="monaco-loading">{t("编辑器加载中")}</div>} theme={monacoTheme}
              path="inmemory://dev-tools/lottie/animation.json"
              options={{ ...languageEditorOptions, minimap: { enabled: false }, fontSize: 14,
                wordWrap: 'on', automaticLayout: true, fixedOverflowWidgets: true,
                scrollBeyondLastLine: false, ariaLabel: 'Lottie JSON', padding: { top: 12 } }} />
          </div>
          <EditorStatusBar text={json} label={t("动画 JSON")} error={error}>
            {!error && <span role="status">{loading ? t("正在加载动画 JSON…") : t("点击“播放 JSON”更新预览")}</span>}
          </EditorStatusBar>
        </section>
        <SplitPaneDivider containerRef={gridRef} ratio={splitRatio} onRatioChange={setSplitRatio} label={t("调整 JSON 与预览宽度")} />
        <section className="editor-panel lottie-preview-panel">
          <div className="panel-header">
            <span>{t("预览")}</span>
            <div className="panel-actions">
              <button type="button" className="btn-small" disabled={!canControl} onClick={togglePlayback}>{status === 'playing' ? t("暂停") : t("播放")}</button>
              <button type="button" className="btn-small" disabled={!canControl} onClick={() => { playerRef.current?.goToAndPlay(0, true); setStatus('playing') }}>{t("重播")}</button>
              <ToolOptions label={t('播放选项')} compact>
              <label className="lottie-toggle"><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />{t("循环")}</label>
              <label className="lottie-speed">{t("速度")}<select aria-label={t("播放速度")} value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                {[0.5, 1, 1.5, 2].map((value) => <option key={value} value={value}>{value}×</option>)}
              </select></label>
              </ToolOptions>
            </div>
          </div>
          <div className="lottie-preview-stage">
            <div ref={previewRef} className="lottie-canvas" aria-label={t("Lottie 动画预览")} role="img" />
            {(status === 'empty' || status === 'error' || status === 'loading') && <div className="lottie-empty">{status === 'loading' ? t("正在准备动画…") : status === 'error' ? t("无法渲染此动画，请检查提示") : t("输入 JSON 或加载链接以播放")}</div>}
          </div>
          <div className="lottie-metadata" aria-live="polite">
            <span>{status === 'playing' ? t("播放中") : status === 'paused' ? t("已暂停") : status === 'loading' ? t("加载中") : status === 'error' ? t("渲染失败") : t("等待动画")}</span>
            {animation && <span>{animation.data.w} × {animation.data.h} · {animation.data.fr} fps · {((animation.data.op - animation.data.ip) / animation.data.fr).toFixed(2)} {t("秒")}</span>}
          </div>
        </section>
      </div>
    </ToolLayout>
  )
}

export default LottiePlayer
