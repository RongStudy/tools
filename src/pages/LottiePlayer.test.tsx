import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import LottiePlayer from './LottiePlayer'
import pulse from '../assets/lottie/pulse.json'
import orbit from '../assets/lottie/orbit.json'

const { loadAnimation, players } = vi.hoisted(() => ({
  loadAnimation: vi.fn(),
  players: [] as Array<{
    isLoaded: boolean
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    goToAndPlay: ReturnType<typeof vi.fn>
    setSpeed: ReturnType<typeof vi.fn>
    setLoop: ReturnType<typeof vi.fn>
    addEventListener: ReturnType<typeof vi.fn>
  }>,
}))
vi.mock('lottie-web/build/player/lottie_light', () => ({ default: { loadAnimation } }))
vi.mock('@monaco-editor/react', () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <textarea aria-label="Lottie JSON" value={value} onChange={(event) => onChange(event.target.value)} />
) }))
const renderPlayer = () => render(<ToastProvider><LottiePlayer /></ToastProvider>)
const response = (data: unknown, url = 'https://example.com/final/animation.json') => ({
  ok: true, url, text: async () => JSON.stringify(data),
}) as Response
const load = (url = 'https://example.com/a.json') => {
  fireEvent.change(screen.getByLabelText('动画 URL'), { target: { value: url } })
  fireEvent.click(screen.getByRole('button', { name: '加载并播放' }))
}

beforeEach(() => {
  localStorage.clear()
  players.length = 0
  loadAnimation.mockReset()
  loadAnimation.mockImplementation(() => {
    const player = { isLoaded: true, play: vi.fn(), pause: vi.fn(), destroy: vi.fn(), goToAndPlay: vi.fn(), setSpeed: vi.fn(), setLoop: vi.fn(), addEventListener: vi.fn() }
    players.push(player)
    return player
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('LottiePlayer', () => {
  it('plays edited JSON and controls pause, replay, loop, speed; destroys replaced and unmounted instances', () => {
    const { unmount } = renderPlayer()
    expect(screen.getByText('播放中')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Lottie JSON'), { target: { value: JSON.stringify(orbit) } })
    fireEvent.click(screen.getByRole('button', { name: '播放 JSON' }))
    expect(loadAnimation.mock.lastCall?.[0].animationData.nm).toBe('Orbit')
    expect(players[0].destroy).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    expect(players[1].pause).toHaveBeenCalledOnce()
    expect(screen.getByText('已暂停')).toBeInTheDocument()
    expect(screen.queryByText('输入 JSON 或加载链接以播放')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '播放' }))
    expect(players[1].play).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '重播' }))
    expect(players[1].goToAndPlay).toHaveBeenCalledWith(0, true)
    fireEvent.click(screen.getByRole('checkbox', { name: '循环' }))
    expect(players[1].setLoop).toHaveBeenLastCalledWith(false)
    fireEvent.change(screen.getByLabelText('播放速度'), { target: { value: '2' } })
    expect(players[1].setSpeed).toHaveBeenLastCalledWith(2)
    unmount()
    expect(players[1].destroy).toHaveBeenCalledOnce()
  })

  it('loads a URL, reflects original JSON, resolves relative assets and retains that base when replaying edited JSON', async () => {
    const data = { ...pulse, assets: [{ id: 'image', u: '../images/', p: 'a.png' }] }
    const fetchMock = vi.fn().mockResolvedValue(response(data))
    vi.stubGlobal('fetch', fetchMock)
    renderPlayer()
    load()
    await waitFor(() => expect(screen.getByLabelText('Lottie JSON')).toHaveValue(JSON.stringify(data, null, 2)))
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/a.json', expect.objectContaining({ credentials: 'omit', signal: expect.any(AbortSignal) }))
    expect(loadAnimation.mock.lastCall?.[0].animationData.assets[0].p).toBe('https://example.com/images/a.png')
    fireEvent.change(screen.getByLabelText('Lottie JSON'), { target: { value: JSON.stringify({ ...data, nm: 'edited' }) } })
    fireEvent.click(screen.getByRole('button', { name: '播放 JSON' }))
    expect(loadAnimation.mock.lastCall?.[0].animationData.assets[0].p).toBe('https://example.com/images/a.png')
  })

  it('offers three self contained samples without network access', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderPlayer()
    for (const name of ['脉冲', '轨道', '加载条']) {
      fireEvent.click(screen.getByRole('button', { name }))
      expect(loadAnimation.mock.lastCall?.[0].animationData.layers.length).toBeGreaterThan(0)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows validation, HTTP and network/CORS errors while retaining editable content', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fetchMock)
    renderPlayer()
    fireEvent.change(screen.getByLabelText('Lottie JSON'), { target: { value: '{' } })
    fireEvent.click(screen.getByRole('button', { name: '播放 JSON' }))
    expect(screen.getByRole('alert')).toHaveTextContent('JSON 格式错误')
    fireEvent.click(screen.getByRole('button', { name: '格式化' }))
    expect(screen.getByRole('alert')).toHaveTextContent('JSON 格式错误')
    load('javascript:alert(1)')
    expect(fetchMock).not.toHaveBeenCalled()
    load()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('CORS'))
    expect(screen.getByLabelText('Lottie JSON')).toHaveValue('{')
    load()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('HTTP 404'))
  })

  it('aborts and ignores stale requests after editing, clearing, a new request or unmounting', async () => {
    const pending: Array<(response: Response) => void> = []
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { pending.push(resolve) }))
    vi.stubGlobal('fetch', fetchMock)
    const { unmount } = renderPlayer()
    load()
    fireEvent.change(screen.getByLabelText('Lottie JSON'), { target: { value: 'my edits' } })
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => pending[0](response(pulse)))
    expect(screen.getByLabelText('Lottie JSON')).toHaveValue('my edits')
    load()
    load('https://example.com/new.json')
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true)
    await act(async () => pending[2](response(orbit)))
    await act(async () => pending[1](response(pulse)))
    expect(screen.getByLabelText('Lottie JSON')).toHaveValue(JSON.stringify(orbit, null, 2))
    load()
    fireEvent.click(screen.getByRole('button', { name: '清空' }))
    await act(async () => pending[3](response(pulse)))
    expect(screen.getByLabelText('Lottie JSON')).toHaveValue('')
    expect(screen.getByText('等待动画')).toBeInTheDocument()
    load()
    unmount()
    expect(fetchMock.mock.lastCall?.[1].signal.aborted).toBe(true)
  })

  it('reports timeouts and ignores responses arriving afterward', async () => {
    vi.useFakeTimers()
    let resolve: (value: Response) => void = () => undefined
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done })))
    renderPlayer()
    load()
    act(() => vi.advanceTimersByTime(20000))
    expect(screen.getByRole('alert')).toHaveTextContent('加载超时')
    await act(async () => resolve(response(orbit)))
    expect(screen.getByLabelText('Lottie JSON')).toHaveValue(JSON.stringify(pulse, null, 2))
  })

  it('keeps the loaded JSON visible when rendering is unsupported and respects reduced motion initially', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...pulse, fonts: { list: [{ fPath: 'https://example.com/a.woff' }] } })))
    renderPlayer()
    expect(loadAnimation.mock.lastCall?.[0].autoplay).toBe(false)
    expect(screen.getByText('已暂停')).toBeInTheDocument()
    load()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('外部字体'))
    expect(screen.getByLabelText('Lottie JSON')).toHaveValue(JSON.stringify({ ...pulse, fonts: { list: [{ fPath: 'https://example.com/a.woff' }] } }, null, 2))
    expect(screen.getByText('渲染失败')).toBeInTheDocument()
  })
})
