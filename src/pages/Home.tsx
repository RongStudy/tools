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
  { path: '/json', title: 'JSON 格式化', description: '让数据结构一目了然', meta: '格式化 · 压缩 · 转义', icon: jsonIcon, preview: 'json' },
  { path: '/code-diff', title: '代码对比', description: '快速定位每一处改动', meta: '分栏对比 · 统一视图', icon: diffIcon, preview: 'diff' },
  { path: '/regex', title: '正则表达式', description: '验证匹配，查看捕获结果', meta: '匹配 · 替换 · 分割', icon: regexIcon, preview: 'regex' },
  { path: '/url-codec', title: '编解码', description: '在文本与编码之间转换', meta: 'URL · Base64 · Unicode', icon: codecIcon, preview: 'codec' },
  { path: '/timestamp', title: '时间戳转换', description: '把数字还原为具体时间', meta: '秒 · 毫秒 · 日期时间', icon: clockIcon, preview: 'timestamp' },
  { path: '/mermaid', title: 'Mermaid / Markdown', description: '把文字变成图表和文档', meta: '流程图 · 文档 · 公式', icon: diagramIcon, preview: 'diagram' },
  { path: '/scratch-pad', title: '临时文本', description: '随手记录，继续你的思路', meta: '多标签 · 分栏 · 自动识别', icon: noteIcon, preview: 'note' },
  { path: '/lottie', title: 'Lottie 动画', description: '加载 JSON，预览动画效果', meta: 'URL · JSON · 播放控制', icon: lottieIcon, preview: 'lottie' },
]

const ToolPreview = ({ type }: { type: string }) => {
  switch (type) {
    case 'json':
      return <div className="home-preview-code"><span className="home-preview-line"><i>1</i>{'{'}</span><span className="home-preview-line"><i>2</i><span>&nbsp; <b>"name"</b>: <em>"Forge"</em>,</span></span><span className="home-preview-line"><i>3</i><span>&nbsp; <b>"ready"</b>: <strong>true</strong></span></span><span className="home-preview-line"><i>4</i>{'}'}</span></div>
    case 'diff':
      return <div className="home-preview-diff"><span className="home-diff-removed"><i>−</i><span>const timeout = <b>1000</b>;</span></span><span className="home-diff-added"><i>+</i><span>const timeout = <b>3000</b>;</span></span><span className="home-diff-context"><i> </i>await connect(timeout);</span></div>
    case 'regex':
      return <div className="home-preview-regex"><code><span>/</span>{'[a-z]+@[a-z]+\\.[a-z]+'}<span>/g</span></code><p>联系 <mark>hello@forge.dev</mark></p></div>
    case 'codec':
      return <div className="home-preview-conversion"><code>Hello, Forge!</code><span className="home-conversion-arrow">↓ <small>Base64</small></span><code>SGVsbG8sIEZvcmdlIQ==</code></div>
    case 'timestamp':
      return <div className="home-preview-conversion"><code>1700000000000 <small>ms</small></code><span className="home-conversion-arrow">↓ <small>UTC</small></span><code>2023-11-14 22:13:20</code></div>
    case 'diagram':
      return <div className="home-preview-diagram"><span>开始</span><i>⟶</i><span className="home-diagram-process">处理</span><i>⟶</i><span>完成</span></div>
    case 'lottie':
      return <div className="home-preview-lottie"><span className="home-lottie-ring"><i>▶</i></span><span className="home-lottie-bars"><b /><b /><b /></span><small>JSON → animation</small></div>
    default:
      return <div className="home-preview-code home-preview-note"><span className="home-preview-line"><i>1</i><b># 今日笔记</b></span><span className="home-preview-line"><i>2</i>整理接口参数</span><span className="home-preview-line"><i>3</i><span>记录调试思路<span className="home-note-caret" /></span></span></div>
  }
}

const Home = () => (
  <section className="home-page" aria-labelledby="home-title">
    <header className="home-header">
      <div className="home-copy">
        <p className="home-kicker">FORGE <span>/ WORKSPACE</span></p>
        <h2 id="home-title">开发工作台</h2>
        <p className="home-description">常用工具，就在手边。</p>
      </div>
      <div className="home-shortcut"><span>快速切换工具</span><kbd>⌘ / Ctrl</kbd><kbd>K</kbd></div>
    </header>
    <div className="home-tool-grid" aria-label="常用工具">
      {toolLinks.map((tool, index) => (
        <Link key={tool.path} to={tool.path} className={`home-tool-card home-tool-${tool.preview}`} aria-label={tool.title}>
          <div className="home-card-heading">
            <span className="home-tool-icon"><ToolIcon src={tool.icon} /></span>
            <div className="home-card-copy"><h3>{tool.title}</h3><p>{tool.description}</p></div>
            <span className="home-tool-arrow" aria-hidden="true">↗</span>
          </div>
          <div className="home-tool-preview" aria-hidden="true"><ToolPreview type={tool.preview} /></div>
          <div className="home-card-footer"><span>{tool.meta}</span><span className="home-card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span></div>
        </Link>
      ))}
    </div>
    <footer className="home-footer"><span>格式化、对比、记录，一处完成。</span><span>8 个工具 · 随时开始</span></footer>
  </section>
)

export default Home
