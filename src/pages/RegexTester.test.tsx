import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/Toast'
import RegexTester from './RegexTester'

const renderRegexTester = () => render(
  <ToastProvider>
    <RegexTester />
  </ToastProvider>
)

describe('RegexTester', () => {
  it('实时显示默认示例的匹配和命名捕获组', async () => {
    renderRegexTester()

    await waitFor(() => expect(screen.getByText('2 个匹配')).toBeInTheDocument())
    expect(screen.getAllByText('year').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2026-08-11')).toHaveLength(2)
  })

  it('支持切换替换与分割结果', async () => {
    renderRegexTester()
    await waitFor(() => expect(screen.getByText('2 个匹配')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: '替换' }))
    expect(screen.getByText(/11\/08\/2026/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '分割' }))
    expect(screen.getByText(/^分割结果 ·/)).toBeInTheDocument()
  })

  it('表达式无效时显示错误状态', async () => {
    renderRegexTester()
    fireEvent.change(screen.getByLabelText('正则表达式'), { target: { value: '(' } })

    await waitFor(() => expect(screen.getByText(/Invalid regular expression/i)).toBeInTheDocument())
  })

  it('u 与 v 标志互斥', () => {
    renderRegexTester()

    const unicode = screen.getByLabelText('u：Unicode 模式')
    const unicodeSets = screen.getByLabelText('v：Unicode 集合模式')
    fireEvent.click(unicode)
    expect(unicode).toBeChecked()
    fireEvent.click(unicodeSets)
    expect(unicodeSets).toBeChecked()
    expect(unicode).not.toBeChecked()
  })
})
