import { describe, it, expect } from 'vitest'
import { detectLanguageFromFileName, detectLanguageFromContent } from '../languageDetection'

describe('detectLanguageFromFileName', () => {
  it('应检测 JavaScript 文件扩展名', () => {
    expect(detectLanguageFromFileName('app.js')).toBe('javascript')
    expect(detectLanguageFromFileName('component.jsx')).toBe('javascript')
    expect(detectLanguageFromFileName('module.mjs')).toBe('javascript')
    expect(detectLanguageFromFileName('common.cjs')).toBe('javascript')
  })

  it('应检测 TypeScript 文件扩展名', () => {
    expect(detectLanguageFromFileName('app.ts')).toBe('typescript')
    expect(detectLanguageFromFileName('component.tsx')).toBe('typescript')
  })

  it('应检测 Python 文件扩展名', () => {
    expect(detectLanguageFromFileName('main.py')).toBe('python')
    expect(detectLanguageFromFileName('script.pyw')).toBe('python')
    expect(detectLanguageFromFileName('types.pyi')).toBe('python')
  })

  it('应检测 Java 文件扩展名', () => {
    expect(detectLanguageFromFileName('Main.java')).toBe('java')
  })

  it('应检测 C/C++ 文件扩展名', () => {
    expect(detectLanguageFromFileName('main.c')).toBe('c')
    expect(detectLanguageFromFileName('main.h')).toBe('c')
    expect(detectLanguageFromFileName('app.cpp')).toBe('cpp')
    expect(detectLanguageFromFileName('app.hpp')).toBe('cpp')
    expect(detectLanguageFromFileName('app.cc')).toBe('cpp')
  })

  it('应检测 Go 文件扩展名', () => {
    expect(detectLanguageFromFileName('main.go')).toBe('go')
  })

  it('应检测 Rust 文件扩展名', () => {
    expect(detectLanguageFromFileName('main.rs')).toBe('rust')
  })

  it('应检测 Web 文件扩展名', () => {
    expect(detectLanguageFromFileName('index.html')).toBe('html')
    expect(detectLanguageFromFileName('style.css')).toBe('css')
    expect(detectLanguageFromFileName('style.scss')).toBe('scss')
    expect(detectLanguageFromFileName('style.less')).toBe('less')
  })

  it('应检测数据文件扩展名', () => {
    expect(detectLanguageFromFileName('data.json')).toBe('json')
    expect(detectLanguageFromFileName('config.yaml')).toBe('yaml')
    expect(detectLanguageFromFileName('config.yml')).toBe('yaml')
    expect(detectLanguageFromFileName('data.xml')).toBe('xml')
  })

  it('应检测 Shell 文件扩展名', () => {
    expect(detectLanguageFromFileName('script.sh')).toBe('shell')
    expect(detectLanguageFromFileName('script.bash')).toBe('shell')
    expect(detectLanguageFromFileName('script.zsh')).toBe('shell')
  })

  it('应检测 SQL 文件扩展名', () => {
    expect(detectLanguageFromFileName('query.sql')).toBe('sql')
  })

  it('应对未知扩展名返回 plaintext', () => {
    expect(detectLanguageFromFileName('unknown.xyz')).toBe('plaintext')
    expect(detectLanguageFromFileName('noext')).toBe('plaintext')
  })

  it('应对空文件名返回 plaintext', () => {
    expect(detectLanguageFromFileName('')).toBe('plaintext')
  })

  it('应忽略大小写', () => {
    expect(detectLanguageFromFileName('APP.JS')).toBe('javascript')
    expect(detectLanguageFromFileName('Main.PY')).toBe('python')
  })
})

describe('detectLanguageFromContent', () => {
  it('应检测有效的 JSON 内容', () => {
    expect(detectLanguageFromContent('{"name": "test", "value": 123}')).toBe('json')
    expect(detectLanguageFromContent('[1, 2, 3]')).toBe('json')
  })

  it('应检测 HTML 内容', () => {
    const html = '<!DOCTYPE html><html><head></head><body></body></html>'
    expect(detectLanguageFromContent(html)).toBe('html')
  })

  it('应检测 XML 内容', () => {
    const xml = '<?xml version="1.0"?><root><item>test</item></root>'
    expect(detectLanguageFromContent(xml)).toBe('xml')
  })

  it('应检测 Python 内容', () => {
    const python = `def hello():
    print("Hello, World!")

if __name__ == "__main__":
    hello()`
    expect(detectLanguageFromContent(python)).toBe('python')
  })

  it('应检测 JavaScript 内容', () => {
    const js = `const greeting = "Hello";
function sayHello() {
  console.log(greeting);
}
module.exports = { sayHello };`
    expect(detectLanguageFromContent(js)).toBe('javascript')
  })

  it('应检测 TypeScript 内容', () => {
    const ts = `interface User {
  name: string;
  age: number;
}

type UserRole = "admin" | "user";

const user: User = { name: "test", age: 25 };
const role: UserRole = "admin";
export default user;`
    expect(detectLanguageFromContent(ts)).toBe('typescript')
  })

  it('应检测 Go 内容', () => {
    const go = `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`
    expect(detectLanguageFromContent(go)).toBe('go')
  })

  it('应检测 Rust 内容', () => {
    const rust = `fn main() {
    let x: i32 = 42;
    println!("{}", x.unwrap());
}`
    expect(detectLanguageFromContent(rust)).toBe('rust')
  })

  it('应检测 Shell 内容', () => {
    const shell = `#!/bin/bash
echo "Hello, World!"
export PATH=$PATH:/usr/local/bin`
    expect(detectLanguageFromContent(shell)).toBe('shell')
  })

  it('应检测 SQL 内容', () => {
    const sql = `SELECT * FROM users
WHERE age > 18
ORDER BY name;`
    expect(detectLanguageFromContent(sql)).toBe('sql')
  })

  it('应检测 Java 内容', () => {
    const java = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}`
    expect(detectLanguageFromContent(java)).toBe('java')
  })

  it('应检测 CSS 内容', () => {
    const css = `@media (max-width: 768px) {
  .container {
    display: flex;
  }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}`
    expect(detectLanguageFromContent(css)).toBe('css')
  })

  it('应对空内容返回回退语言', () => {
    expect(detectLanguageFromContent('')).toBe('plaintext')
    expect(detectLanguageFromContent('   ')).toBe('plaintext')
  })

  it('应使用自定义回退语言', () => {
    expect(detectLanguageFromContent('', 'javascript')).toBe('javascript')
  })

  it('应对无法识别的内容返回回退语言', () => {
    expect(detectLanguageFromContent('just some random text here', 'plaintext')).toBe('plaintext')
  })

  it('应检测 PHP 内容', () => {
    const php = `<?php
function greet($name) {
    echo "Hello, " . $name;
}
?>`
    expect(detectLanguageFromContent(php)).toBe('php')
  })

  it('应检测 Ruby 内容', () => {
    const ruby = `def greet(name)
  puts "Hello, #{name}"
end

names = ["Alice", "Bob"]
names.each { |name| puts name }
names.map { |name| name.upcase }`
    expect(detectLanguageFromContent(ruby)).toBe('ruby')
  })

  it('应检测 C/C++ 内容', () => {
    const cpp = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello" << endl;
    return 0;
}`
    expect(detectLanguageFromContent(cpp)).toBe('cpp')
  })

  it('应检测 YAML 内容', () => {
    const yaml = `---
name: test
version: 1.0
dependencies:
  - react
  - typescript
...`
    expect(detectLanguageFromContent(yaml)).toBe('yaml')
  })

  it('应检测 Markdown 内容', () => {
    const md = `# Title

Some text with [a link](https://example.com).

- Item 1
- Item 2

\`\`\`javascript
console.log("hello");
\`\`\``
    expect(detectLanguageFromContent(md)).toBe('markdown')
  })
})
