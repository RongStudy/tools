import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDetectedLanguages, type LanguageInput } from '../useDetectedLanguages'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const php = '<?php echo $name;'
const java = 'public class Main { public static void main(String[] args) {} }'
const go = 'package main\nfunc main() { value := 1 }'
const input = (id: string, content: string, language = 'auto'): LanguageInput => ({ id, content, language })
const settle = () => act(() => vi.advanceTimersByTime(400))

describe('continuous language detection', () => {
  it('debounces edits and keeps detecting PHP, Java and Go without changing automatic mode', () => {
    const { result, rerender } = renderHook(useDetectedLanguages, { initialProps: [input('a', php)] })
    act(() => vi.advanceTimersByTime(399))
    expect(result.current.a).toBe('plaintext')
    settle()
    expect(result.current.a).toBe('php')
    rerender([input('a', java)])
    act(() => vi.advanceTimersByTime(200))
    rerender([input('a', go)])
    act(() => vi.advanceTimersByTime(200))
    expect(result.current.a).toBe('php')
    settle()
    expect(result.current.a).toBe('go')
    rerender([input('a', java)])
    settle()
    expect(result.current.a).toBe('java')
    rerender([input('a', 'ordinary notes')])
    settle()
    expect(result.current.a).toBe('plaintext')
  })
  it('respects manual overrides, restores automatic detection and clears empty input immediately', () => {
    const { result, rerender, unmount } = renderHook(useDetectedLanguages, { initialProps: [input('a', php)] })
    rerender([input('a', go, 'java')])
    expect(result.current.a).toBe('java')
    settle()
    expect(result.current.a).toBe('java')
    rerender([input('a', go)])
    settle()
    expect(result.current.a).toBe('go')
    rerender([input('a', '')])
    expect(result.current.a).toBe('plaintext')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('isolates sides and documents; content overrides a filename while inconclusive content uses it', () => {
    const { result, rerender } = renderHook(useDetectedLanguages, { initialProps: [
      { ...input('a/left', php), filename: 'old.java' }, input('a/right', go),
    ] })
    settle()
    expect(result.current).toEqual({ 'a/left': 'php', 'a/right': 'go' })
    rerender([{ ...input('b/left', 'hello'), filename: 'Main.java' }, input('b/right', '')])
    expect(result.current['b/left']).toBe('plaintext')
    settle()
    expect(result.current).toEqual({ 'b/left': 'java', 'b/right': 'plaintext' })
  })
})
