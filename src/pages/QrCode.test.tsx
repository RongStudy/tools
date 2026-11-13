import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { setLocale } from '../i18n'
import QrCode from './QrCode'
import { decodeQrImage, generateUrlQr } from '../utils/qrCode'

vi.mock('../utils/qrCode', async (original) => ({ ...await original<typeof import('../utils/qrCode')>(), generateUrlQr: vi.fn(), decodeQrImage: vi.fn() }))
const imageData = 'data:image/png;base64,test'
const file = () => new File(['QR'], 'code.png', { type: 'image/png' })
const upload = () => fireEvent.change(screen.getByLabelText('QR code image', { exact: true }), { target: { files: [file()] } })
beforeEach(() => {
  setLocale('en')
  vi.mocked(generateUrlQr).mockReset().mockResolvedValue(imageData)
  vi.mocked(decodeQrImage).mockReset().mockResolvedValue('https://example.com/docs?source=qr')
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const show = () => render(<ToastProvider><QrCode /></ToastProvider>)

describe('QR Code tool', () => {
  it('generates a QR code, enables PNG download and invalidates stale previews after editing', async () => {
    show()
    expect(screen.getByRole('button', { name: 'Generate QR Code' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Example' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate QR Code' }))
    expect(await screen.findByRole('img', { name: 'Generated QR code' })).toHaveAttribute('src', imageData)
    expect(generateUrlQr).toHaveBeenCalledWith('https://example.com/docs?source=qr', 512)
    expect(screen.getByRole('link', { name: 'Download PNG' })).toHaveAttribute('download', 'qr-code.png')
    fireEvent.change(screen.getByLabelText('QR code URL'), { target: { value: 'https://other.example' } })
    expect(screen.queryByRole('img', { name: 'Generated QR code' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Download PNG' })).not.toBeInTheDocument()
  })
  it('decodes an uploaded image and exposes safe URL actions', async () => {
    show(); upload()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Decoded content' })).toHaveValue('https://example.com/docs?source=qr'))
    expect(screen.getByRole('link', { name: 'Open URL' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
  })
  it('shows non-URL QR contents as text without creating an executable link', async () => {
    vi.mocked(decodeQrImage).mockResolvedValue('javascript:alert(1)')
    show(); upload()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Decoded content' })).toHaveValue('javascript:alert(1)'))
    expect(screen.queryByRole('link', { name: 'Open URL' })).not.toBeInTheDocument()
    expect(screen.getByText('QR code contains text, not an HTTP / HTTPS URL')).toBeInTheDocument()
  })
  it('drops images, shows decode failures and keeps status space reserved', async () => {
    vi.mocked(decodeQrImage).mockRejectedValue(new Error('No QR code found'))
    show()
    fireEvent.drop(screen.getByRole('region', { name: 'Decode QR Code' }), { dataTransfer: { files: [file()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('No QR code found')
    expect(screen.getByLabelText('QR code decoding status bar')).toBeInTheDocument()
  })
  it('discards a pending decode when cleared', async () => {
    let resolve!: (value: string) => void
    vi.mocked(decodeQrImage).mockImplementation(() => new Promise((done) => { resolve = done }))
    show(); upload()
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[1])
    await act(async () => resolve('https://stale.example'))
    expect(screen.getByRole('textbox', { name: 'Decoded content' })).toHaveValue('')
    expect(screen.queryByRole('link', { name: 'Open URL' })).not.toBeInTheDocument()
  })
  it('preserves URL input when switching language', () => {
    show()
    fireEvent.change(screen.getByLabelText('QR code URL'), { target: { value: 'https://example.com/中文' } })
    act(() => setLocale('zh'))
    expect(screen.getByRole('heading', { name: '二维码' })).toBeInTheDocument()
    expect(screen.getByLabelText('二维码 URL')).toHaveValue('https://example.com/中文')
  })
})
