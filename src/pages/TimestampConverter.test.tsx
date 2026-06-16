import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TimestampConverter from './TimestampConverter'
import { ToastProvider } from '../components/Toast'

function renderTimestampConverter() {
  return render(
    <ToastProvider>
      <TimestampConverter />
    </ToastProvider>
  )
}

describe('TimestampConverter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-12T08:38:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('显示当前秒级时间戳并支持切换到毫秒', () => {
    renderTimestampConverter()

    expect(screen.getByText('1781253480')).toBeInTheDocument()
    expect(screen.getByText('秒')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '切换单位' }))

    expect(screen.getByText('1781253480000')).toBeInTheDocument()
    expect(screen.getByText('毫秒')).toBeInTheDocument()
  })

  it('支持毫秒时间戳转 Asia/Shanghai 日期时间', () => {
    renderTimestampConverter()

    fireEvent.change(screen.getByLabelText('时间戳'), {
      target: { value: '1781253480000' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: '转换' })[0])

    expect(screen.getByLabelText('时间戳转换结果')).toHaveValue('2026-06-12 16:38:00')
  })

  it('支持 Asia/Shanghai 日期时间转秒级时间戳', () => {
    renderTimestampConverter()

    fireEvent.change(screen.getByLabelText('日期时间'), {
      target: { value: '2026-06-12 16:38:00' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: '转换' })[1])

    expect(screen.getByLabelText('日期时间转换结果')).toHaveValue('1781253480')
  })

  it('时间戳输入非法时显示错误', () => {
    renderTimestampConverter()

    fireEvent.change(screen.getByLabelText('时间戳'), {
      target: { value: 'abc' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: '转换' })[0])

    expect(screen.getByText('时间戳格式不正确')).toBeInTheDocument()
  })

  it('支持批量时间戳转日期时间并逐行展示结果', () => {
    renderTimestampConverter()

    fireEvent.click(screen.getByRole('button', { name: '批量转换' }))
    fireEvent.change(screen.getByLabelText('批量时间戳列表'), {
      target: { value: '1781253480\nbad-value' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: '转换' })[0])

    expect(screen.getByText('2026-06-12 16:38:00')).toBeInTheDocument()
    expect(screen.getByText('错误: 时间戳格式不正确')).toBeInTheDocument()
  })

  it('支持批量日期时间转时间戳并逐行展示结果', () => {
    renderTimestampConverter()

    fireEvent.click(screen.getByRole('button', { name: '批量转换' }))
    fireEvent.change(screen.getByLabelText('批量日期时间列表'), {
      target: { value: '2026-06-12 16:38:00\n2026-06-12 16:39:00' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: '转换' })[1])

    expect(screen.getByTitle('1781253480')).toBeInTheDocument()
    expect(screen.getByTitle('1781253540')).toBeInTheDocument()
  })
})
