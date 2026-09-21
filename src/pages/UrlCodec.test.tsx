import { beforeEach, describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UrlCodec from './UrlCodec'
import { ToastProvider } from '../components/Toast'

function renderUrlCodec() {
  return render(
    <ToastProvider>
      <UrlCodec />
    </ToastProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('UrlCodec', () => {
  it('默认按参数值模式进行 URL Encode 和 Decode', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('编解码输入'), {
      target: { value: '中文 & value=1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'URL Encode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('%E4%B8%AD%E6%96%87%20%26%20value%3D1')

    fireEvent.click(screen.getByRole('button', { name: '结果转输入' }))
    fireEvent.click(screen.getByRole('button', { name: 'URL Decode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('中文 & value=1')
  })

  it('完整 URL 模式应保留 URL 结构字符', () => {
    renderUrlCodec()

    fireEvent.click(screen.getByRole('button', { name: '完整 URL' }))
    fireEvent.change(screen.getByLabelText('编解码输入'), {
      target: { value: 'https://example.com/search?q=中文&sort=a b' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'URL Encode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('https://example.com/search?q=%E4%B8%AD%E6%96%87&sort=a%20b')
  })

  it('支持 UTF-8 文本的 Base64 Encode 和 Decode', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('编解码输入'), {
      target: { value: '中文 & value=1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Base64 Encode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('5Lit5paHICYgdmFsdWU9MQ==')

    fireEvent.click(screen.getByRole('button', { name: '结果转输入' }))
    fireEvent.click(screen.getByRole('button', { name: 'Base64 Decode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('中文 & value=1')
  })

  it('支持 Unicode Encode 和 Decode，包括扩展字符', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('编解码输入'), {
      target: { value: '中文 😀' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Unicode Encode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('\\u4e2d\\u6587\\u0020\\ud83d\\ude00')

    fireEvent.click(screen.getByRole('button', { name: '结果转输入' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unicode Decode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('中文 😀')
  })

  it('Base64 Decode 输入非法内容时显示错误并清空输出', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('编解码输入'), {
      target: { value: 'not base64%' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Base64 Decode' }))

    expect(screen.getByLabelText('编解码输出')).toHaveValue('')
    expect(screen.getByText(/invalid/i)).toBeInTheDocument()
  })

  it('支持生成 UTF-8 文本的 MD5 和 SHA-256 摘要', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('编解码输入'), {
      target: { value: '中文' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'MD5' }))
    expect(screen.getByLabelText('编解码输出')).toHaveValue('a7bac2239fcdcb3a067903d8077c4a07')

    fireEvent.click(screen.getByRole('button', { name: 'SHA-256' }))
    expect(screen.getByLabelText('编解码输出')).toHaveValue(
      '72726d8818f693066ceb69afa364218b692e62ea92b385782363780f47529c21'
    )
  })

  it('应保存输入输出的分割比例', () => {
    const { unmount } = renderUrlCodec()

    const divider = screen.getByRole('separator', { name: '调整输入输出宽度' })
    expect(divider).toHaveAttribute('aria-valuenow', '30')
    fireEvent.keyDown(divider, { key: 'ArrowLeft' })
    expect(divider).toHaveAttribute('aria-valuenow', '28')

    unmount()
    renderUrlCodec()

    expect(screen.getByRole('separator', { name: '调整输入输出宽度' })).toHaveAttribute('aria-valuenow', '28')
  })
})
