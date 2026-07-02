import { describe, it, expect } from 'vitest'
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

describe('UrlCodec', () => {
  it('默认按参数值模式进行 URL Encode 和 Decode', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('URL输入'), {
      target: { value: '中文 & value=1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'URL Encode' }))

    expect(screen.getByLabelText('URL输出')).toHaveValue('%E4%B8%AD%E6%96%87%20%26%20value%3D1')

    fireEvent.click(screen.getByRole('button', { name: '结果转输入' }))
    fireEvent.click(screen.getByRole('button', { name: 'URL Decode' }))

    expect(screen.getByLabelText('URL输出')).toHaveValue('中文 & value=1')
  })

  it('完整 URL 模式应保留 URL 结构字符', () => {
    renderUrlCodec()

    fireEvent.click(screen.getByRole('button', { name: '完整 URL' }))
    fireEvent.change(screen.getByLabelText('URL输入'), {
      target: { value: 'https://example.com/search?q=中文&sort=a b' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'URL Encode' }))

    expect(screen.getByLabelText('URL输出')).toHaveValue('https://example.com/search?q=%E4%B8%AD%E6%96%87&sort=a%20b')
  })

  it('支持 UTF-8 文本的 Base64 Encode 和 Decode', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('URL输入'), {
      target: { value: '中文 & value=1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Base64 Encode' }))

    expect(screen.getByLabelText('URL输出')).toHaveValue('5Lit5paHICYgdmFsdWU9MQ==')

    fireEvent.click(screen.getByRole('button', { name: '结果转输入' }))
    fireEvent.click(screen.getByRole('button', { name: 'Base64 Decode' }))

    expect(screen.getByLabelText('URL输出')).toHaveValue('中文 & value=1')
  })

  it('Base64 Decode 输入非法内容时显示错误并清空输出', () => {
    renderUrlCodec()

    fireEvent.change(screen.getByLabelText('URL输入'), {
      target: { value: 'not base64%' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Base64 Decode' }))

    expect(screen.getByLabelText('URL输出')).toHaveValue('')
    expect(screen.getByText(/invalid/i)).toBeInTheDocument()
  })
})
