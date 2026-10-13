import type * as Monaco from 'monaco-editor/editor'

const snippets = [
  { label: 'flowchart', detail: '流程图', text: 'flowchart ${1:LR}\n  ${2:A}[${3:开始}] --> ${4:B}[${5:结束}]' },
  { label: 'sequenceDiagram', detail: '时序图', text: 'sequenceDiagram\n  participant ${1:A}\n  participant ${2:B}\n  $1->>$2: ${3:请求}\n  $2-->>$1: ${4:响应}' },
  { label: 'classDiagram', detail: '类图', text: 'classDiagram\n  class ${1:Example} {\n    +${2:String} ${3:name}\n    +${4:run}()\n  }' },
  { label: 'stateDiagram-v2', detail: '状态图', text: 'stateDiagram-v2\n  [*] --> ${1:Idle}\n  $1 --> ${2:Done}\n  $2 --> [*]' },
  { label: 'subgraph', detail: '子图', text: 'subgraph ${1:Group}[${2:分组}]\n  ${3:A --> B}\nend' },
]

export const registerMermaidLanguage = (monaco: typeof Monaco) => {
  if (monaco.languages.getLanguages().some(({ id }) => id === 'mermaid')) return
  monaco.languages.register({ id: 'mermaid', extensions: ['.mmd', '.mermaid'], aliases: ['Mermaid'] })
  monaco.languages.setLanguageConfiguration('mermaid', {
    comments: { lineComment: '%%' },
    brackets: [['[', ']'], ['(', ')'], ['{', '}']],
    autoClosingPairs: [{ open: '[', close: ']' }, { open: '(', close: ')' }, { open: '{', close: '}' }, { open: '"', close: '"' }],
  })
  monaco.languages.setMonarchTokensProvider('mermaid', {
    tokenizer: {
      root: [
        [/%%.*$/, 'comment'],
        [/"[^"\n]*"/, 'string'],
        [/\b(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|gantt|pie|mindmap|timeline|subgraph|end|participant|actor|loop|alt|else|opt|par|and|rect|Note|activate|deactivate|classDef|class|style|click|direction)\b/, 'keyword'],
        [/--?>?>?|==>|-\.->|<-->|---|--|==/, 'operator'],
        [/\b(?:LR|RL|TB|TD|BT)\b/, 'type'],
        [/\b\d+(?:\.\d+)?\b/, 'number'],
        [/[[\](){}]/, '@brackets'],
      ],
    },
  })
  monaco.languages.registerCompletionItemProvider('mermaid', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
      return {
        suggestions: snippets.map(({ label, detail, text }) => ({
          label, detail, range,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: text,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        })),
      }
    },
  })
}
