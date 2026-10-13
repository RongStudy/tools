import type { jsonDefaults as JsonDefaults } from 'monaco-editor/languages/features/json/register'

export type JsonSchema = Record<string, unknown> | boolean

export const parseJsonSchema = (source: string): JsonSchema | undefined => {
  if (!source.trim()) return undefined
  const schema: unknown = JSON.parse(source)
  if (typeof schema !== 'boolean' && (!schema || typeof schema !== 'object' || Array.isArray(schema))) {
    throw new Error('Schema 必须是 JSON 对象或布尔值')
  }
  return schema as JsonSchema
}

/** Explicit local associations only; external $ref requests remain disabled. */
export const configureJsonSchemas = (jsonDefaults: typeof JsonDefaults, documents: Array<{ path: string; schema: string }>) => {
  const schemas = documents.flatMap(({ path, schema }) => {
    try {
      const parsed = parseJsonSchema(schema)
      return parsed === undefined ? [] : [{ uri: `${path}.schema`, fileMatch: [path], schema: parsed }]
    } catch {
      return []
    }
  })
  jsonDefaults.setDiagnosticsOptions({
    ...jsonDefaults.diagnosticsOptions,
    validate: true,
    enableSchemaRequest: false,
    schemaValidation: 'error',
    schemas,
  })
}
