import { t, useLocale } from '../i18n'
import { Link } from 'react-router-dom'
import ToolIcon from '../components/ToolIcon'
import jsonIcon from '../assets/tool-icons/json.png'
import diffIcon from '../assets/tool-icons/diff.png'
import regexIcon from '../assets/tool-icons/regex.png'
import codecIcon from '../assets/tool-icons/codec.png'
import clockIcon from '../assets/tool-icons/clock.png'
import diagramIcon from '../assets/tool-icons/diagram.png'
import noteIcon from '../assets/tool-icons/note.png'
import lottieIcon from '../assets/tool-icons/lottie.png'
import './Home.css'

const toolLinks = [
  { path: '/json', title: 'JSON 格式化', meta: '格式化 · 压缩 · 转义', icon: jsonIcon, preview: 'json' },
  { path: '/scratch-pad', title: '临时文本', meta: '多标签 · 分栏 · 自动识别', icon: noteIcon, preview: 'note' },
  { path: '/code-diff', title: '代码对比', meta: '分栏对比 · 统一视图', icon: diffIcon, preview: 'diff' },
  { path: '/url-codec', title: '编解码', meta: 'URL · Base64 · Unicode', icon: codecIcon, preview: 'codec' },
  { path: '/qr-code', title: '二维码', meta: '生成 · 下载 · 图片解析', icon: undefined, preview: 'qr' },
  { path: '/timestamp', title: '时间戳转换', meta: '秒 · 毫秒 · 日期时间', icon: clockIcon, preview: 'timestamp' },
  { path: '/mermaid', title: 'Mermaid / Markdown', meta: '流程图 · 文档 · 公式', icon: diagramIcon, preview: 'diagram' },
  { path: '/regex', title: '正则表达式', meta: '匹配 · 替换 · 分割', icon: regexIcon, preview: 'regex' },
  { path: '/lottie', title: 'Lottie 动画', meta: 'URL · JSON · 播放控制', icon: lottieIcon, preview: 'lottie' },
]

const ToolPreview = ({ type }: { type: string }) => {
  useLocale()
  switch (type) {
    case 'json':
      return <div className="home-preview-code"><span className="home-preview-line"><i>1</i>{'{'}</span><span className="home-preview-line"><i>2</i><span>&nbsp; <b>"name"</b>: <em>"Forge"</em>,</span></span><span className="home-preview-line"><i>3</i><span>&nbsp; <b>"ready"</b>: <strong>true</strong></span></span><span className="home-preview-line"><i>4</i>{'}'}</span></div>
    case 'diff':
      return <div className="home-preview-diff"><span className="home-diff-removed"><i>−</i><span>const timeout = <b>1000</b>;</span></span><span className="home-diff-added"><i>+</i><span>const timeout = <b>3000</b>;</span></span><span className="home-diff-context"><i> </i>await connect(timeout);</span></div>
    case 'regex':
      return <div className="home-preview-regex"><code><span>/</span>{'[a-z]+@[a-z]+\\.[a-z]+'}<span>/g</span></code><p>{"Contact"}<mark>hello@forge.dev</mark></p></div>
    case 'codec':
      return <div className="home-preview-conversion"><code>Hello, Forge!</code><span className="home-conversion-arrow">↓ <small>Base64</small></span><code>SGVsbG8sIEZvcmdlIQ==</code></div>
    case 'qr':
      return <div className="home-preview-conversion"><ToolIcon name="qr" /><code>https://example.com</code></div>
    case 'timestamp':
      return <div className="home-preview-conversion"><code>1700000000000 <small>ms</small></code><span className="home-conversion-arrow">↓ <small>UTC</small></span><code>2023-11-14 22:13:20</code></div>
    case 'diagram':
      return <div className="home-preview-diagram"><span>{"Start"}</span><i>⟶</i><span className="home-diagram-process">{"Process"}</span><i>⟶</i><span>{"Done"}</span></div>
    case 'lottie':
      return <div className="home-preview-lottie"><span className="home-lottie-ring"><i>▶</i></span><span className="home-lottie-bars"><b /><b /><b /></span><small>JSON → animation</small></div>
    default:
      return <div className="home-preview-code home-preview-note"><span className="home-preview-line"><i>1</i><b>{"# Today’s notes"}</b></span><span className="home-preview-line"><i>2</i>{"Organize API parameters"}</span><span className="home-preview-line"><i>3</i><span>{"Record debugging ideas"}<span className="home-note-caret" /></span></span></div>
  }
}

const Home = () => {
  useLocale()
  return (
  <section className="home-page" aria-labelledby="home-title">
    <header className="home-header">
      <h2 id="home-title">{t("开发工作台")}</h2>
      <div className="home-shortcut"><span>{t("快速切换工具")}</span><kbd>⌘ / Ctrl</kbd><kbd>K</kbd></div>
    </header>
    <div className="home-tool-grid" aria-label={t("常用工具")}>
      {toolLinks.map((tool) => (
        <Link key={tool.path} to={tool.path} className={`home-tool-card home-tool-${tool.preview}`} aria-label={t(tool.title)}>
          <div className="home-card-heading">
            <span className="home-tool-icon"><ToolIcon name={tool.preview === 'qr' ? 'qr' : undefined} src={tool.icon} /></span>
            <div className="home-card-copy"><h3>{t(tool.title)}</h3><p>{t(tool.meta)}</p></div>
            <span className="home-tool-arrow" aria-hidden="true">›</span>
          </div>
          <div className="home-tool-preview" aria-hidden="true"><ToolPreview type={tool.preview} /></div>
        </Link>
      ))}
    </div>
  </section>
  )
}

export default Home
