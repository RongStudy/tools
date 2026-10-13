import { javascriptDefaults, typescriptDefaults, ModuleKind, ScriptTarget } from 'monaco-editor/languages/features/typescript/register'
import { cssDefaults, scssDefaults, lessDefaults } from 'monaco-editor/languages/features/css/register'
import { htmlDefaults } from 'monaco-editor/languages/features/html/register'
import { jsonDefaults } from 'monaco-editor/languages/features/json/register'

/** Configure local workers before any model requests its language service. */
export const configureBuiltinLanguageServices = () => {
  for (const defaults of [typescriptDefaults, javascriptDefaults]) {
    defaults.setCompilerOptions({
      ...defaults.getCompilerOptions(),
      target: ScriptTarget.ESNext,
      module: ModuleKind.ESNext,
      allowNonTsExtensions: true,
      // TypeScript's ModuleDetectionKind.Force: independent snippets are modules,
      // so declarations in another tab or the opposite diff side cannot leak in.
      moduleDetection: 3,
      ...(defaults === javascriptDefaults ? { allowJs: true, checkJs: true } : {}),
    })
    defaults.setDiagnosticsOptions({
      ...defaults.getDiagnosticsOptions(),
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      onlyVisible: true,
    })
  }
  for (const defaults of [cssDefaults, scssDefaults, lessDefaults]) {
    defaults.setOptions({ ...defaults.options, validate: true })
  }
  htmlDefaults.setOptions({ ...htmlDefaults.options, data: { ...htmlDefaults.options.data, useDefaultDataProvider: true } })
  jsonDefaults.setDiagnosticsOptions({ ...jsonDefaults.diagnosticsOptions, validate: true, enableSchemaRequest: false })
}
