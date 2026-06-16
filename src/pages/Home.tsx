import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

const toolLinks = [
  {
    path: '/json',
    title: 'JSON格式化',
    meta: 'Format / Compress / Escape',
    accent: '#2563eb',
  },
  {
    path: '/code-diff',
    title: '代码对比',
    meta: 'Side by side diff',
    accent: '#0e7490',
  },
  {
    path: '/url-codec',
    title: 'URL 编解码',
    meta: 'Encode / Decode',
    accent: '#7c3aed',
  },
  {
    path: '/timestamp',
    title: '时间戳转换',
    meta: 'Timestamp / Date time',
    accent: '#15803d',
  },
]

const Home = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let frameId = 0
    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawRoundedRect = (
      x: number,
      y: number,
      rectWidth: number,
      rectHeight: number,
      radius: number
    ) => {
      context.beginPath()
      context.moveTo(x + radius, y)
      context.lineTo(x + rectWidth - radius, y)
      context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius)
      context.lineTo(x + rectWidth, y + rectHeight - radius)
      context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight)
      context.lineTo(x + radius, y + rectHeight)
      context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius)
      context.lineTo(x, y + radius)
      context.quadraticCurveTo(x, y, x + radius, y)
    }

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#f8fafc'
      context.fillRect(0, 0, width, height)

      const gridSize = 34
      context.strokeStyle = '#e2e8f0'
      context.lineWidth = 1
      for (let x = (time / 80) % gridSize; x < width; x += gridSize) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      for (let y = 0; y < height; y += gridSize) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
      }

      const centerX = width * 0.52
      const centerY = height * 0.48
      const nodes = [
        { x: centerX - 210, y: centerY - 80, color: '#2563eb', label: '{}' },
        { x: centerX + 160, y: centerY - 120, color: '#0e7490', label: '<>' },
        { x: centerX - 20, y: centerY + 105, color: '#15803d', label: 'ms' },
      ]

      context.lineWidth = 2
      nodes.forEach((node, index) => {
        const next = nodes[(index + 1) % nodes.length]
        const progress = (Math.sin(time / 700 + index) + 1) / 2
        context.strokeStyle = '#cbd5e1'
        context.beginPath()
        context.moveTo(node.x, node.y)
        context.lineTo(next.x, next.y)
        context.stroke()

        context.strokeStyle = node.color
        context.beginPath()
        context.moveTo(node.x, node.y)
        context.lineTo(node.x + (next.x - node.x) * progress, node.y + (next.y - node.y) * progress)
        context.stroke()
      })

      nodes.forEach((node) => {
        drawRoundedRect(node.x - 46, node.y - 32, 92, 64, 8)
        context.fillStyle = '#ffffff'
        context.fill()
        context.strokeStyle = '#cbd5e1'
        context.stroke()

        context.fillStyle = node.color
        context.font = '700 20px ui-monospace, SFMono-Regular, Menlo, monospace'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(node.label, node.x, node.y)
      })

      drawRoundedRect(centerX - 72, centerY - 44, 144, 88, 8)
      context.fillStyle = '#17202a'
      context.fill()
      context.fillStyle = '#ffffff'
      context.font = '700 17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('Tool Console', centerX, centerY - 7)
      context.fillStyle = '#93c5fd'
      context.font = '500 12px ui-monospace, SFMono-Regular, Menlo, monospace'
      context.fillText('ready', centerX, centerY + 20)

      frameId = window.requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    frameId = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <section className="home-page">
      <canvas ref={canvasRef} className="home-canvas" aria-hidden="true" />
      <div className="home-content">
        <div className="home-copy">
          <p className="home-kicker">Developer Tools</p>
          <h2>开发工具台</h2>
          <p>把常用的格式化、对比和时间转换放在一个清爽工作区。</p>
        </div>

        <div className="home-tool-grid" aria-label="常用工具">
          {toolLinks.map((tool) => (
            <Link
              key={tool.path}
              to={tool.path}
              className="home-tool-card"
              style={{ '--tool-accent': tool.accent } as React.CSSProperties}
            >
              <span className="home-tool-mark"></span>
              <span className="home-tool-title">{tool.title}</span>
              <small>{tool.meta}</small>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Home
