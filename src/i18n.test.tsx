import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import AppShell from './components/AppShell'
import ToolLayout from './components/ToolLayout'
import { getLocale, LOCALE_STORAGE_KEY, setLocale, t, useLocale } from './i18n'
import { tools } from './tools/registry'

afterEach(() => { cleanup(); vi.restoreAllMocks(); setLocale('zh') })

const Workspace = () => {
  useLocale()
  const [text, setText] = useState('用户输入 / user content')
  return <ToolLayout title={t('JSON格式化')}><textarea aria-label="draft" value={text} onChange={(event) => setText(event.target.value)} /></ToolLayout>
}

describe('interface language', () => {
  it('defaults to English with empty, invalid or unavailable storage and restores Chinese', async () => {
    localStorage.removeItem(LOCALE_STORAGE_KEY)
    vi.resetModules()
    expect((await import('./i18n')).getLocale()).toBe('en')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'invalid')
    vi.resetModules()
    expect((await import('./i18n')).getLocale()).toBe('en')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh')
    vi.resetModules()
    expect((await import('./i18n')).getLocale()).toBe('zh')
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('storage blocked') })
    vi.resetModules()
    expect((await import('./i18n')).getLocale()).toBe('en')
  })

  it('switches titles, navigation and dialogs immediately, persists selection and preserves drafts', () => {
    setLocale('en')
    render(<MemoryRouter><AppShell tools={tools}><Workspace /></AppShell></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'JSON Format' })).toBeInTheDocument()
    expect(document.querySelector('.tool-layout-title p')).toBeNull()
    expect(screen.getByRole('link', { name: 'Scratch Pad' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'draft' }), { target: { value: '订单编号 ABC-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /中文/ }))
    expect(screen.getByRole('heading', { name: 'JSON格式化' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '临时文本' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument()
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(screen.getByRole('textbox', { name: 'draft' })).toHaveValue('订单编号 ABC-123')
    fireEvent.click(screen.getByRole('button', { name: /English/ }))
    expect(screen.getByRole('heading', { name: 'JSON Format' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(screen.getByRole('textbox', { name: 'draft' })).toHaveValue('订单编号 ABC-123')
  })

  it('finds tools by English and Chinese names in English mode', () => {
    setLocale('en')
    render(<MemoryRouter><AppShell tools={tools}><Workspace /></AppShell></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Search tools' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Code Diff' } })
    expect(screen.getByRole('button', { name: /Code Diff/ })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '代码对比' } })
    expect(screen.getByRole('button', { name: /Code Diff/ })).toBeInTheDocument()
  })

  it('interpolates parameters literally and switches even when persistence is blocked', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage blocked') })
    setLocale('en')
    expect(getLocale()).toBe('en')
    expect(t('关闭 {value0}', { value0: '$& {value0} 订单' })).toBe('Close $& {value0} 订单')
    expect(t('a user-supplied value')).toBe('a user-supplied value')
    setLocale('zh')
    expect(t('关闭 {value0}', { value0: '订单' })).toBe('关闭 订单')
  })
})
