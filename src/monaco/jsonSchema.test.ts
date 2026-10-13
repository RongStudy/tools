import { describe, expect, it, vi } from 'vitest'
import type { jsonDefaults as JsonDefaults } from 'monaco-editor/languages/features/json/register'
import { configureJsonSchemas, parseJsonSchema } from './jsonSchema'

describe('JSON Schema configuration', () => {
  it('accepts object and boolean schemas, removes blank schemas, and rejects invalid values', () => {
    expect(parseJsonSchema(' ')).toBeUndefined()
    expect(parseJsonSchema('false')).toBe(false)
    expect(parseJsonSchema('{"type":"object"}')).toEqual({ type: 'object' })
    for (const source of ['null', '[]', '42', '"object"', '{']) {
      expect(() => parseJsonSchema(source)).toThrow()
    }
  })

  it('isolates associations by document, replaces removed schemas and disables remote references', () => {
    const defaults = {
      diagnosticsOptions: { enableSchemaRequest: true, schemas: [{ uri: 'old' }] },
      setDiagnosticsOptions: vi.fn(),
    }
    configureJsonSchemas(defaults as unknown as typeof JsonDefaults, [
      { path: 'inmemory://dev-tools/json/one/input.json', schema: '{"type":"object","$ref":"https://example.com/schema"}' },
      { path: 'inmemory://dev-tools/json/two/input.json', schema: 'false' },
      { path: 'inmemory://dev-tools/json/three/input.json', schema: '[' },
    ])
    const options = defaults.setDiagnosticsOptions.mock.calls[0][0]
    expect(options.enableSchemaRequest).toBe(false)
    expect(options.schemas.map((schema: { fileMatch: string[] }) => schema.fileMatch)).toEqual([
      ['inmemory://dev-tools/json/one/input.json'], ['inmemory://dev-tools/json/two/input.json'],
    ])
    expect(options.schemas[1].schema).toBe(false)
    configureJsonSchemas(defaults as unknown as typeof JsonDefaults, [])
    expect(defaults.setDiagnosticsOptions.mock.calls[1][0].schemas).toEqual([])
  })
})
