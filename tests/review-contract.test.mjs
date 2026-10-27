import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { detailContentHash, sourceLocator, sourceRecord, withQuestionDetail } from './review-fixtures.mjs'

const backendFile = path => readFile(new URL(`../../backend/ruoyi-knowledge/src/main/java/com/ruoyi/knowledge/${path}`, import.meta.url), 'utf8')
test('候选来源定位fixture只使用实际SourceLocator DTO字段，原件身份来自KbSource.assetIds', async () => {
  const [candidate, source] = await Promise.all([backendFile('review/KbCandidateProxy.java'), backendFile('domain/KbSource.java')])
  const components = candidate.match(/record SourceLocator\(([^)]*)\)/)?.[1].split(',').map(item => item.trim().split(/\s+/).at(-1))
  assert.ok(components)
  for (const field of Object.keys(sourceLocator)) assert.ok(components.includes(field), `SourceLocator 不存在字段 ${field}`)
  assert.equal(components.includes('assetId'), false)
  assert.match(source, /List<Long> getAssetIds\(\)/)
  assert.ok(sourceRecord.assetIds.every(id => typeof id === 'string'))
})
test('详情完整哈希fixture绑定真实只读DTO和详情赋值，列表fixture不伪造哈希', async () => {
  const [question, service, review] = await Promise.all([backendFile('domain/KbQuestion.java'), backendFile('service/impl/KbQuestionServiceImpl.java'), backendFile('review/KbReviewService.java')])
  assert.match(question, /JsonProperty\(access\s*=\s*com\.fasterxml\.jackson\.annotation\.JsonProperty\.Access\.READ_ONLY\)(?:\s+@[^\n]+)*\s+public String getContentHash\(\)/)
  const detail = service.match(/public KbQuestion get\(Long id\)\s*\{([\s\S]*?)\n {4}\}/)?.[1]
  assert.match(detail || '', /setContentHash\(reviews\.contentHash\(data\)\)/)
  assert.match(review, /String contentHash\(KbQuestion question\)\s*\{\s*return proofs\.basis\(question\)/)
  const row = { id: '90071992547409931', rowVersion: '7', stemHash: 'a'.repeat(64) }
  assert.equal(Object.hasOwn(row, 'contentHash'), false)
  assert.equal(withQuestionDetail(row).contentHash, detailContentHash)
  assert.notEqual(withQuestionDetail(row).contentHash, row.stemHash)
})
