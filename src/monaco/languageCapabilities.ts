import type * as Monaco from 'monaco-editor'

const supportedLanguages = new Set(['javascript', 'typescript', 'json', 'css', 'scss', 'less', 'html'])

export const hasBuiltinLanguageService = (language: string) => supportedLanguages.has(language)
// Monaco's HTML service provides completions and formatting, but no HTML validator.
export const hasBuiltinDiagnostics = (language: string) => hasBuiltinLanguageService(language) && language !== 'html'

export const languageEditorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  quickSuggestions: { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  parameterHints: { enabled: true },
  hover: { enabled: 'on' },
  tabCompletion: 'on',
  renderValidationDecorations: 'on',
}
