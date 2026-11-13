import { beforeEach, describe, expect, it, vi } from 'vitest'
import { moveToolPath, normalizeToolOrder, orderMenuTools, persistToolOrder, readToolOrder, TOOL_ORDER_STORAGE_KEY } from '../toolOrder'

beforeEach(() => localStorage.clear())

describe('tool menu order', () => {
  it('deduplicates saved paths, ignores removed entries and appends new tools', () => {
    expect(normalizeToolOrder(['/b', '/removed', '/b', 42, '/a'], ['/a', '/b', '/new'])).toEqual(['/b', '/a', '/new'])
    expect(normalizeToolOrder({ path: '/b' }, ['/a', '/b'])).toEqual(['/a', '/b'])
  })

  it('keeps Home first even when saved data attempts to move it', () => {
    const tools = [{ path: '/', isTool: false }, { path: '/a' }, { path: '/b' }]
    expect(orderMenuTools(tools, ['/b', '/', '/a']).map((tool) => tool.path)).toEqual(['/', '/b', '/a'])
  })

  it('moves in both directions and ignores invalid or identical targets', () => {
    const paths = ['/a', '/b', '/c']
    expect(moveToolPath(paths, '/a', '/c')).toEqual(['/b', '/c', '/a'])
    expect(moveToolPath(paths, '/c', '/a')).toEqual(['/c', '/a', '/b'])
    expect(moveToolPath(paths, '/invalid', '/a')).toBe(paths)
    expect(moveToolPath(paths, '/a', '/a')).toBe(paths)
    expect(paths).toEqual(['/a', '/b', '/c'])
  })

  it('restores stored order, tolerates malformed JSON and removes only its own preference on reset', () => {
    expect(readToolOrder()).toBeNull()
    localStorage.setItem(TOOL_ORDER_STORAGE_KEY, '{invalid')
    expect(readToolOrder()).toBeNull()
    localStorage.setItem('draft', 'keep')
    expect(persistToolOrder(['/b', '/a'])).toBe(true)
    expect(readToolOrder()).toEqual(['/b', '/a'])
    expect(persistToolOrder(null)).toBe(true)
    expect(readToolOrder()).toBeNull()
    expect(localStorage.getItem('draft')).toBe('keep')
  })

  it('reports persistence failure without throwing', () => {
    const target = Object.hasOwn(localStorage, 'setItem') ? localStorage : Storage.prototype
    const spy = vi.spyOn(target, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(persistToolOrder(['/a'])).toBe(false)
    spy.mockRestore()
  })
})
