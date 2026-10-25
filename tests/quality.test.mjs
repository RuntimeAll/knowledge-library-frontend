import assert from 'node:assert/strict'
import test from 'node:test'
import { ESLint } from 'eslint'
import { compareWithBaseline, mapUnchangedLine, parseHunks } from '../quality/lint-baseline.mjs'
import { apiDocsLinks, normalizeApiPrefix } from '../src/utils/api-docs.js'

test('文档及规范始终位于当前部署的相同前缀', () => {
  for (const prefix of ['/dev-api', '/stage-api', '/prod-api', '/nested/api', '/']) {
    const value = normalizeApiPrefix(prefix)
    assert.deepEqual(apiDocsLinks(prefix), { prefix: value, ui: `${value}/swagger-ui/index.html`, schema: `${value}/v3/api-docs/core` })
  }
  for (const invalid of ['https://other.test/api', '//other.test', '/api?target=x', '/api#x', '/api/../other']) {
    assert.throws(() => apiDocsLinks(invalid))
  }
})

test('新增行可移动历史位置，改动历史违规行必须重新修复', () => {
  const hunks = parseHunks('@@ -2,0 +3,2 @@\n+new\n+new\n@@ -7,2 +9,1 @@\n-old\n-old\n+change')
  assert.equal(mapUnchangedLine(2, hunks), 2)
  assert.equal(mapUnchangedLine(3, hunks), 5)
  assert.equal(mapUnchangedLine(7, hunks), null)
  assert.equal(mapUnchangedLine(8, hunks), null)
  assert.equal(mapUnchangedLine(9, hunks), 10)
})

test('基线精确匹配，不能豁免同文件新增规则或复制历史违规', () => {
  const issue = { file: 'src/a.js', ruleId: 'no-undef', message: "'missing' is not defined.", line: 3, column: 1, endLine: 3, endColumn: 8 }
  const baseline = { entries: [issue] }
  assert.equal(compareWithBaseline([issue], baseline, new Map()).violations.length, 0)
  const copy = { ...issue, line: 5, endLine: 5 }
  assert.equal(compareWithBaseline([issue, copy], baseline, new Map()).violations.length, 1)
  assert.equal(compareWithBaseline([issue], baseline, new Map([['src/a.js', '@@ -3 +3 @@\n-old\n+new']])).violations.length, 1)
  assert.equal(compareWithBaseline([{ ...issue, file: 'src/new.js' }], baseline, new Map()).violations.length, 1)
})

test('实际ESLint配置识别JS错误、Vue错误和真实自动导入变量', async () => {
  const eslint = new ESLint()
  const [valid] = await eslint.lintText('export const count = ref(0)\n', { filePath: 'src/lint-fixture.js' })
  assert.equal(valid.errorCount, 0)
  const [invalid] = await eslint.lintText('missingCall()\n', { filePath: 'src/lint-fixture.js' })
  assert.ok(invalid.messages.some(item => item.ruleId === 'no-undef'))
  const [vue] = await eslint.lintText('<template><div v-for="item in items">{{ item }}</div></template><script setup>const items = [1]</script>', { filePath: 'src/LintFixture.vue' })
  assert.ok(vue.messages.some(item => item.ruleId === 'vue/require-v-for-key'))
})

test('多行Vue违规内部发生等长修改也不能继续使用历史豁免', async () => {
  const file = 'src/MultilineBaselineFixture.vue'
  const source = `<script setup>
defineProps({
  config: {
    type: Object,
    default: {
      title: 'before',
      color: 'red'
    }
  }
})
</script>`
  const eslint = new ESLint()
  const diagnose = async text => {
    const [result] = await eslint.lintText(text, { filePath: file })
    return result.messages.map(message => ({ file, ...message }))
  }
  const entries = await diagnose(source)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].ruleId, 'vue/require-valid-default-prop')
  assert.ok(entries[0].line < 6 && entries[0].endLine > 6)

  const changed = await diagnose(source.replace("title: 'before'", "title: 'after'"))
  const edited = compareWithBaseline(changed, { entries }, new Map([
    [file, "@@ -6 +6 @@\n-      title: 'before',\n+      title: 'after',"]
  ]))
  assert.equal(edited.violations.length, 1)
  assert.equal(edited.legacy, 0)

  const moved = await diagnose(`\n${source}`)
  const untouched = compareWithBaseline(moved, { entries }, new Map([[file, '@@ -0,0 +1 @@\n+']]))
  assert.equal(untouched.violations.length, 0)
  assert.equal(untouched.legacy, 1)
})

test('多行范围内增删相抵仍算触达，范围外改动可保留历史位置', () => {
  const issue = { file: 'src/a.js', ruleId: 'no-empty', message: 'Empty block statement.', line: 4, column: 1, endLine: 8, endColumn: 2 }
  const baseline = { entries: [issue] }
  const balanced = '@@ -5 +4,0 @@\n-old\n@@ -7,0 +7 @@\n+new'
  assert.equal(compareWithBaseline([issue], baseline, new Map([[issue.file, balanced]])).violations.length, 1)
  const outside = '@@ -2 +2 @@\n-old\n+new\n@@ -10 +10 @@\n-old\n+new'
  assert.equal(compareWithBaseline([issue], baseline, new Map([[issue.file, outside]])).violations.length, 0)
})
