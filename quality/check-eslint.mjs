import { ESLint } from 'eslint'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { compareWithBaseline } from './lint-baseline.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const baseline = JSON.parse(await readFile(new URL('./eslint-baseline.json', import.meta.url), 'utf8'))
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
if (!/^[a-f0-9]{40}$/.test(baseline.baseCommit)) throw new Error('无效的历史基线提交')
const diffs = new Map()
for (const file of new Set(baseline.entries.map(item => item.file))) {
  const original = git(['show', `${baseline.baseCommit}:${file}`])
  const hash = createHash('sha256').update(original).digest('hex')
  if (hash !== baseline.sourceHashes[file]) throw new Error(`历史来源不一致：${file}`)
  diffs.set(file, git(['diff', '--no-ext-diff', '--no-color', '--unified=0', baseline.baseCommit, '--', file]))
}
const eslint = new ESLint({ cwd: root })
const results = await eslint.lintFiles(['src/**/*.{js,vue}', 'vite/**/*.js', 'vite.config.js', 'eslint.config.js', 'quality/**/*.mjs', 'tests/**/*.mjs'])
const diagnostics = results.flatMap(result => result.messages.map(message => ({
  file: path.relative(root, result.filePath).split(path.sep).join('/'), ...message
})))
const report = compareWithBaseline(diagnostics, baseline, diffs)
for (const item of report.violations) {
  console.error(`${item.file}:${item.line}:${item.column} ${item.ruleId || 'parse-error'} ${item.message}`)
}
console.log(`ESLint：${results.length} 个文件，${report.violations.length} 项新增违规，${report.legacy} 项原位置历史问题，${report.resolved} 项历史问题已消失或发生变更。`)
if (report.violations.length) process.exitCode = 1
