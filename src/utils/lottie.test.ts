import { describe, expect, it } from 'vitest'
import pulse from '../assets/lottie/pulse.json'
import { parseAnimationUrl, parseLottieJson, prepareLottieData, validateLottieData } from './lottie'

describe('Lottie input and resources', () => {
  it('rejects invalid JSON and nonanimation objects', () => {
    expect(() => parseLottieJson('{')).toThrow('JSON 格式错误')
    for (const data of [{}, { ...pulse, fr: 0 }, { ...pulse, op: 0 }, { ...pulse, w: Infinity }, { ...pulse, assets: {} }]) {
      expect(() => validateLottieData(data)).toThrow()
    }
  })

  it('only accepts HTTP(S) URLs without credentials', () => {
    expect(parseAnimationUrl(' https://example.com/a.json?q=1 ').href).toBe('https://example.com/a.json?q=1')
    for (const url of ['javascript:alert(1)', 'file:///tmp/a.json', 'data:application/json,{}', '/a.json', 'https://user:password@example.com/a.json']) {
      expect(() => parseAnimationUrl(url)).toThrow()
    }
  })

  it('resolves image paths against the final response URL without mutating the original JSON', () => {
    const data = { ...pulse, assets: [
      { id: 'a', u: '../images/', p: 'image.png' },
      { id: 'b', u: 'ignored/', p: 'https://cdn.example.com/b.png', e: 1 },
      { id: 'c', p: 'data:image/png;base64,AA==', e: 1 },
    ] }
    const clone = prepareLottieData(data, 'https://example.com/redirected/animations/a.json?x=1')
    expect(clone.assets).toEqual([
      { id: 'a', u: '', p: 'https://example.com/redirected/images/image.png', e: 0 },
      { id: 'b', u: '', p: 'https://cdn.example.com/b.png', e: 0 },
      { id: 'c', p: 'data:image/png;base64,AA==', e: 1 },
    ])
    expect(data.assets[0].p).toBe('image.png')
    expect(clone.layers).not.toBe(data.layers)
  })

  it('rejects executable URLs and font paths interpolated into player CSS', () => {
    expect(() => prepareLottieData({ ...pulse, assets: [{ p: 'javascript:alert(1)', e: 1 }] }, 'https://example.com/a.json')).toThrow()
    expect(() => prepareLottieData({ ...pulse, fonts: { list: [{ fPath: "x');}body{display:none}" }] } }, 'https://example.com/a.json')).toThrow('外部字体')
  })
})
