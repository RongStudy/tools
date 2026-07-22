import { describe, expect, it } from 'vitest'
import { md5, sha256 } from '../hash'

describe('hash', () => {
  it.each([
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['中文', 'a7bac2239fcdcb3a067903d8077c4a07'],
  ])('generates the MD5 digest for %j', (input, expected) => {
    expect(md5(input)).toBe(expected)
  })

  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['中文', '72726d8818f693066ceb69afa364218b692e62ea92b385782363780f47529c21'],
  ])('generates the SHA-256 digest for %j', (input, expected) => {
    expect(sha256(input)).toBe(expected)
  })
})
