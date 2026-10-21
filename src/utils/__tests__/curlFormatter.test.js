// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { formatCurl, isCurlCommand } from '../curlFormatter'

// Trusted fixtures only: replace curl with an argv recorder; never send requests.
const argv = (source) => execFileSync('/bin/bash', ['--noprofile', '--norc', '-c',
  `curl() { printf '%s\\0' "$@"; }\n${source}`,
], { env: { PATH: '/usr/bin:/bin', TOKEN: 'token with spaces' } })

const commands = [
  `curl 'https://example.com/api?a=1&b=2' -X POST -H 'Content-Type: application/json' --data-raw '{"name":"demo","enabled":true}'`,
  `curl --unknown-future-option value -abc -ovalue --flag=value -- --dash-prefixed-url`,
  `curl -H 'X-Order: first' -H 'X-Order: second' --url https://example.com/1 --next -G --url https://example.com/2`,
  `curl --data '' --data-binary 'line one\nline two\r\n' --json '{ "big": 12345678901234567890, "big": 2 }'`,
  `curl -H "Authorization: Bearer $TOKEN" -H "X-Token: \${TOKEN}" --data a\\ b --url 'https://example.com/{a,b}'`,
  `curl --data $'one\\ntwo\\'three' --url https://example.com --data 'a'"b"c`,
  `curl \\\n    -X POST \\\n    -H 'X-Test: a b' \\\n    --data-raw '{"text":"a  b"}' \\\n    https://example.com`,
  `curl --hea\\\nder value --url https://example.com`,
  `# Request example\n#!/bin/bash\ncurl https://example.com -I # Keep this comment\n# And this one\n`,
  `curl -F 'file=@sample.txt;type=text/plain' --upload-file @input --config config.txt --proxy '' --resolve 'example.com:443:127.0.0.1'`,
  `curl --url https://example.com -H '-header-value' --data --dash-value --no-progress-meter`,
  `curl --url https://example.com --data "literal \\$(text) and \\` + '`' + `text\\` + '`' + `"`,
  `curl --url https://example.com --data '$LINENO \${LINENO} $(literal) \`literal\`'`,
  `curl --url https://example.com --data $'$LINENO \\n $(literal)'`,
]

describe('curl formatting', () => {
  it('places options on separate lines without reordering them', () => {
    expect(formatCurl(commands[0])).toBe([
      `curl 'https://example.com/api?a=1&b=2' \\`,
      `  -X POST \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  --data-raw '{"name":"demo","enabled":true}'`,
    ].join('\n'))
  })

  it.each(commands)('preserves the actual ordered Bash argv, including exact bytes: %s', (command) => {
    const formatted = formatCurl(command)
    expect(argv(formatted)).toEqual(argv(command))
    expect(formatCurl(formatted)).toBe(formatted)
  })

  it('accepts arbitrary option names and values without depending on option arity', () => {
    const words = Array.from({ length: 250 }, (_, index) => `--future-option-${index} 'value ${index}'`)
    const command = `curl ${words.join(' ')} --url https://example.com`
    expect(argv(formatCurl(command))).toEqual(argv(command))
  })

  it.each([
    `curl --data 'unterminated`,
    'curl --data "unterminated',
    'curl --data trailing\\',
    'curl https://example.com; echo next',
    'curl https://example.com | cat',
    'curl https://example.com > output',
    'curl --data @- <<EOF\nbody\nEOF',
    'curl https://example.com\ncurl https://example.com/2',
    'curl https://example.com # comment\necho next',
    'curl --data "$(printf payload)"',
    'curl --data $[LINENO]',
    'curl --data `printf payload`',
    'curl --data ${TOKEN:-fallback}',
    'curl --data "$LINENO"',
    'curl --data ${LINENO}',
    'curl --data "$BASH_COMMAND"',
    'curl --data "\0"',
  ])('rejects input that cannot safely be reflowed: %s', (command) => {
    expect(() => formatCurl(command)).toThrow(/已保留原文/)
  })

  it('only recognizes a curl command at the start, allowing leading comments', () => {
    expect(isCurlCommand('  # example\n\ncurl --help')).toBe(true)
    expect(isCurlCommand('curl')).toBe(true)
    expect(isCurlCommand('curlish --help')).toBe(false)
    expect(isCurlCommand('const command = "curl --help"')).toBe(false)
    expect(isCurlCommand('echo hi\ncurl --help')).toBe(false)
    expect(() => formatCurl('echo curl')).toThrow('当前内容不是 curl 命令')
  })
})
