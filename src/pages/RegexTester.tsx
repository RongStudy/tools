import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { writeTextToClipboard } from '../utils/clipboard'
import {
  REGEX_FLAG_ORDER,
  normalizeRegexFlags,
  type RegexFlag,
  type RegexMatch,
  type RegexTaskResult,
} from '../utils/regex'
import { runRegexTask } from '../utils/regexRunner'
import './RegexTester.css'
import '../styles/common.css'

type ResultTab = 'matches' | 'replace' | 'split' | 'reference'

type RegexExample = {
  name: string
  pattern: string
  flags: string
  text: string
  replacement: string
}

const FLAG_DETAILS: Record<RegexFlag, string> = {
  d: '返回匹配索引',
  g: '全局匹配',
  i: '忽略大小写',
  m: '多行模式',
  s: '点号匹配换行',
  u: 'Unicode 模式',
  v: 'Unicode 集合模式',
  y: '粘连匹配',
}

const EXAMPLES: RegexExample[] = [
  {
    name: '日期命名分组',
    pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})',
    flags: 'dg',
    text: '发布日期：2026-08-11\n下次更新：2026-09-01',
    replacement: '$<day>/$<month>/$<year>',
  },
  {
    name: '电子邮箱',
    pattern: '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+',
    flags: 'gi',
    text: '联系人：dev@example.com、Support@tools.dev\n无效：hello@localhost',
    replacement: '[email]',
  },
  {
    name: 'URL 提取',
    pattern: 'https?:\\/\\/[^\\s<>()]+',
    flags: 'gi',
    text: '文档：https://example.com/docs?q=regex\n镜像：http://localhost:5173/tools/regex',
    replacement: '<$&>',
  },
  {
    name: '日志字段',
    pattern: '^\\[(?<level>INFO|WARN|ERROR)]\\s+(?<time>\\d{2}:\\d{2}:\\d{2})\\s+(?<message>.+)$',
    flags: 'dgm',
    text: '[INFO] 09:10:11 service started\n[WARN] 09:10:18 retrying request\n[ERROR] 09:10:24 timeout',
    replacement: '$<time> [$<level>] $<message>',
  },
  {
    name: '连续空白',
    pattern: '\\s+',
    flags: 'g',
    text: 'alpha   beta\n\ngamma\tdelta',
    replacement: ' ',
  },
]

const REFERENCE_GROUPS = [
  {
    title: '字符',
    items: [
      ['.', '除换行外任意字符'], ['\\d / \\D', '数字 / 非数字'], ['\\w / \\W', '单词字符 / 非单词字符'],
      ['\\s / \\S', '空白 / 非空白'], ['[abc]', '字符集合'], ['[^abc]', '排除字符集合'],
    ],
  },
  {
    title: '数量',
    items: [
      ['*', '0 次或更多'], ['+', '1 次或更多'], ['?', '0 次或 1 次'],
      ['{n}', '恰好 n 次'], ['{n,}', '至少 n 次'], ['{n,m}', 'n 到 m 次'], ['*? +? ??', '懒惰量词'],
    ],
  },
  {
    title: '边界与逻辑',
    items: [
      ['^ / $', '行或文本开头 / 结尾'], ['\\b / \\B', '单词边界 / 非边界'], ['a|b', 'a 或 b'],
      ['(?=a)', '正向先行断言'], ['(?!a)', '负向先行断言'], ['(?<=a)', '正向后行断言'], ['(?<!a)', '负向后行断言'],
    ],
  },
  {
    title: '分组与替换',
    items: [
      ['(abc)', '捕获组'], ['(?:abc)', '非捕获组'], ['(?<name>abc)', '命名捕获组'], ['\\1 / \\k<name>', '反向引用'],
      ['$&', '整个匹配'], ['$1 / $<name>', '捕获组替换'], ["$` / $'", '匹配前 / 匹配后文本'], ['$$', '字面量 $'],
    ],
  },
]

const formatDuration = (durationMs: number) => {
  if (durationMs < 0.1) return '< 0.1 ms'
  return `${durationMs.toFixed(durationMs < 10 ? 2 : 1)} ms`
}

const getLineColumn = (text: string, index: number) => {
  const prefix = text.slice(0, index)
  const lines = prefix.split('\n')
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 }
}

const ResultPlaceholder = ({ children }: { children: ReactNode }) => (
  <div className="regex-empty">{children}</div>
)

const HighlightedText = ({ text, matches }: { text: string; matches: RegexMatch[] }) => {
  if (!text) return <ResultPlaceholder>输入测试文本后，这里会显示匹配高亮。</ResultPlaceholder>
  if (matches.length === 0) return <div className="regex-highlight-text">{text}</div>

  const content: ReactNode[] = []
  let cursor = 0

  matches.forEach((match, index) => {
    if (match.index < cursor) return
    content.push(text.slice(cursor, match.index))
    if (match.value) {
      content.push(<mark key={`match-${index}`}>{match.value}</mark>)
      cursor = match.end
    } else {
      content.push(<span className="regex-zero-match" key={`match-${index}`} title="空匹配" />)
      cursor = match.index
    }
  })
  content.push(text.slice(cursor))

  return <div className="regex-highlight-text">{content}</div>
}

const MatchDetails = ({ match, number, text }: { match: RegexMatch; number: number; text: string }) => {
  const position = getLineColumn(text, match.index)
  const hasGroups = match.groups.length > 0 || Object.keys(match.namedGroups).length > 0

  return (
    <details className="regex-match-item" open={number <= 3}>
      <summary>
        <span className="regex-match-number">#{number}</span>
        <code>{match.value || '(空匹配)'}</code>
        <span className="regex-match-position">
          {match.index}-{match.end} · {position.line}:{position.column}
        </span>
      </summary>
      {hasGroups ? (
        <div className="regex-groups">
          {match.groups.map((value, index) => (
            <div className="regex-group-row" key={`group-${index}`}>
              <span>${index + 1}</span>
              <code>{value ?? '(未参与)'}</code>
              {match.groupIndices[index] && (
                <small>{match.groupIndices[index]?.join('-')}</small>
              )}
            </div>
          ))}
          {Object.entries(match.namedGroups).map(([name, value]) => (
            <div className="regex-group-row named" key={name}>
              <span>{name}</span>
              <code>{value ?? '(未参与)'}</code>
              {match.namedGroupIndices[name] && (
                <small>{match.namedGroupIndices[name]?.join('-')}</small>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="regex-no-groups">此匹配没有捕获组</div>
      )}
    </details>
  )
}

const RegexTester = () => {
  const initialExample = EXAMPLES[0]
  const [pattern, setPattern] = useState(initialExample.pattern)
  const [flags, setFlags] = useState(initialExample.flags)
  const [text, setText] = useState(initialExample.text)
  const [replacement, setReplacement] = useState(initialExample.replacement)
  const [splitLimit, setSplitLimit] = useState(100)
  const [activeTab, setActiveTab] = useState<ResultTab>('matches')
  const [selectedExample, setSelectedExample] = useState(initialExample.name)
  const [isLive, setIsLive] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<RegexTaskResult | null>(null)
  const [error, setError] = useState('')
  const executionId = useRef(0)
  const { showToast } = useToast()

  const execute = useCallback(async () => {
    const currentId = ++executionId.current
    if (!pattern) {
      setResult(null)
      setError('')
      setIsRunning(false)
      return
    }

    setIsRunning(true)
    try {
      const nextResult = await runRegexTask({
        pattern,
        flags,
        text,
        replacement,
        splitLimit,
        maxMatches: 1000,
      })
      if (currentId !== executionId.current) return
      setResult(nextResult)
      setError('')
    } catch (caughtError) {
      if (currentId !== executionId.current) return
      setResult(null)
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError))
    } finally {
      if (currentId === executionId.current) setIsRunning(false)
    }
  }, [flags, pattern, replacement, splitLimit, text])

  useEffect(() => {
    if (!isLive) return
    const timeout = window.setTimeout(() => void execute(), 180)
    return () => window.clearTimeout(timeout)
  }, [execute, isLive])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void execute()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      executionId.current += 1
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [execute])

  const toggleFlag = (flag: RegexFlag) => {
    const nextFlags = new Set(flags)
    if (nextFlags.has(flag)) {
      nextFlags.delete(flag)
    } else {
      nextFlags.add(flag)
      if (flag === 'u') nextFlags.delete('v')
      if (flag === 'v') nextFlags.delete('u')
    }
    setFlags(normalizeRegexFlags(nextFlags))
  }

  const loadExample = (name: string) => {
    const example = EXAMPLES.find((item) => item.name === name)
    if (!example) return
    setSelectedExample(name)
    setPattern(example.pattern)
    setFlags(example.flags)
    setText(example.text)
    setReplacement(example.replacement)
    setActiveTab('matches')
  }

  const clearAll = () => {
    setPattern('')
    setText('')
    setReplacement('')
    setResult(null)
    setError('')
  }

  const copyValue = async (value: string, successMessage: string) => {
    const copied = await writeTextToClipboard(value)
    showToast(copied ? successMessage : '复制失败', copied ? 'success' : 'error')
  }

  const matchText = useMemo(() => result?.matches.map((match) => match.value).join('\n') ?? '', [result])

  const actions = (
    <div className="regex-page-actions">
      <label>
        <span className="sr-only">示例</span>
        <select value={selectedExample} onChange={(event) => loadExample(event.target.value)} aria-label="正则示例">
          {EXAMPLES.map((example) => <option key={example.name}>{example.name}</option>)}
        </select>
      </label>
      <button type="button" className="btn btn-secondary" onClick={() => void copyValue(`/${pattern}/${flags}`, '表达式已复制')} disabled={!pattern}>
        复制表达式
      </button>
      <button type="button" className="btn btn-danger" onClick={clearAll}>清空</button>
    </div>
  )

  return (
    <ToolLayout
      className="regex-tester"
      title="正则表达式"
      description="测试匹配与捕获组，预览替换和分割结果"
      actions={actions}
    >
      <section className="regex-builder" aria-label="正则表达式配置">
        <div className="regex-pattern-row">
          <label className="regex-pattern-field">
            <span>表达式</span>
            <div className={error ? 'regex-pattern-input invalid' : 'regex-pattern-input'}>
              <i>/</i>
              <input
                aria-label="正则表达式"
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                placeholder="例如 (?<name>\\w+)"
                spellCheck={false}
              />
              <i>/{flags}</i>
            </div>
          </label>
          <div className="regex-run-controls">
            <label className="regex-live-toggle">
              <input type="checkbox" checked={isLive} onChange={(event) => setIsLive(event.target.checked)} />
              <span>实时</span>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void execute()} disabled={isRunning || !pattern}>
              {isRunning ? '执行中' : '运行'}
            </button>
          </div>
        </div>

        <div className="regex-flags" aria-label="正则标志">
          <span className="regex-flags-label">Flags</span>
          {REGEX_FLAG_ORDER.map((flag) => (
            <label key={flag} title={FLAG_DETAILS[flag]} className={flags.includes(flag) ? 'active' : ''}>
              <input
                type="checkbox"
                checked={flags.includes(flag)}
                onChange={() => toggleFlag(flag)}
                aria-label={`${flag}：${FLAG_DETAILS[flag]}`}
              />
              <code>{flag}</code>
              <span>{FLAG_DETAILS[flag]}</span>
            </label>
          ))}
        </div>

        <div className="regex-status" aria-live="polite">
          {error ? (
            <span className="error">{error}</span>
          ) : result ? (
            <>
              <span className="valid">表达式有效</span>
              <span>{result.matches.length}{result.truncated ? '+' : ''} 个匹配</span>
              <span>{formatDuration(result.durationMs)}</span>
              {result.truncated && <span>仅显示前 1000 项</span>}
            </>
          ) : (
            <span>{pattern ? '等待执行' : '输入表达式开始测试'}</span>
          )}
        </div>
      </section>

      <div className="regex-workspace">
        <section className="editor-panel regex-input-panel">
          <div className="panel-header">
            <span>测试文本</span>
            <div className="panel-actions">
              <small>{text.length.toLocaleString()} 字符</small>
              <button type="button" className="btn-small" onClick={() => void copyValue(text, '测试文本已复制')} disabled={!text}>复制</button>
            </div>
          </div>
          <textarea
            aria-label="测试文本"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="输入需要测试的文本..."
            spellCheck={false}
          />
        </section>

        <section className="editor-panel regex-result-panel">
          <div className="regex-result-tabs" role="tablist" aria-label="结果类型">
            <button type="button" role="tab" aria-selected={activeTab === 'matches'} className={activeTab === 'matches' ? 'active' : ''} onClick={() => setActiveTab('matches')}>
              匹配 <span>{result?.matches.length ?? 0}</span>
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'replace'} className={activeTab === 'replace' ? 'active' : ''} onClick={() => setActiveTab('replace')}>替换</button>
            <button type="button" role="tab" aria-selected={activeTab === 'split'} className={activeTab === 'split' ? 'active' : ''} onClick={() => setActiveTab('split')}>分割</button>
            <button type="button" role="tab" aria-selected={activeTab === 'reference'} className={activeTab === 'reference' ? 'active' : ''} onClick={() => setActiveTab('reference')}>速查</button>
          </div>

          <div className="regex-result-body">
            {activeTab === 'matches' && (
              <div className="regex-match-view" role="tabpanel">
                <div className="regex-result-toolbar">
                  <span>匹配高亮与捕获组</span>
                  <button type="button" className="btn-small" onClick={() => void copyValue(matchText, '匹配结果已复制')} disabled={!matchText}>复制匹配</button>
                </div>
                <div className="regex-highlight-preview">
                  <HighlightedText text={text} matches={result?.matches ?? []} />
                </div>
                <div className="regex-match-list">
                  {!result ? (
                    <ResultPlaceholder>{error ? '修正表达式后可查看匹配。' : '运行后可查看匹配详情。'}</ResultPlaceholder>
                  ) : result.matches.length === 0 ? (
                    <ResultPlaceholder>没有找到匹配。</ResultPlaceholder>
                  ) : result.matches.map((match, index) => (
                    <MatchDetails key={`${match.index}-${index}`} match={match} number={index + 1} text={text} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'replace' && (
              <div className="regex-operation-view" role="tabpanel">
                <label className="regex-operation-field">
                  <span>替换为</span>
                  <input
                    aria-label="替换内容"
                    value={replacement}
                    onChange={(event) => setReplacement(event.target.value)}
                    placeholder="支持 $&, $1, $<name> 等替换标记"
                    spellCheck={false}
                  />
                </label>
                <div className="regex-output-heading">
                  <span>替换结果</span>
                  <button type="button" className="btn-small" onClick={() => void copyValue(result?.replacement ?? '', '替换结果已复制')} disabled={!result}>复制</button>
                </div>
                <pre className="regex-text-output">{result?.replacement || <span>运行后显示替换结果</span>}</pre>
              </div>
            )}

            {activeTab === 'split' && (
              <div className="regex-operation-view" role="tabpanel">
                <label className="regex-operation-field regex-limit-field">
                  <span>最多返回</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={splitLimit}
                    onChange={(event) => setSplitLimit(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))}
                    aria-label="分割结果上限"
                  />
                  <small>项</small>
                </label>
                <div className="regex-output-heading">
                  <span>分割结果 · {result?.splitItems.length ?? 0} 项</span>
                  <button type="button" className="btn-small" onClick={() => void copyValue(result?.splitItems.join('\n') ?? '', '分割结果已复制')} disabled={!result}>复制</button>
                </div>
                <div className="regex-split-list">
                  {!result ? (
                    <ResultPlaceholder>运行后显示分割结果。</ResultPlaceholder>
                  ) : result.splitItems.length === 0 ? (
                    <ResultPlaceholder>结果为空。</ResultPlaceholder>
                  ) : result.splitItems.map((item, index) => (
                    <div className="regex-split-item" key={index}>
                      <span>{index}</span>
                      <code>{item || '(空字符串)'}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reference' && (
              <div className="regex-reference" role="tabpanel">
                {REFERENCE_GROUPS.map((group) => (
                  <section key={group.title}>
                    <h3>{group.title}</h3>
                    {group.items.map(([token, description]) => (
                      <div className="regex-reference-row" key={token}>
                        <code>{token}</code>
                        <span>{description}</span>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </ToolLayout>
  )
}

export default RegexTester
