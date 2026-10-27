import assert from 'node:assert/strict'
import test from 'node:test'
import { businessError } from '../src/utils/business-error.js'
import { createRequestGeneration } from '../src/utils/request-generation.js'
import { actionPayload, batchItems, knownReviewRejection, mergeApprovalResults, pendingReviewKey, readPendingReview, unresolvedApprovalItems } from '../src/views/knowledge/components/reviewState.js'
import { calculationPreflight, derivePreflight } from '../src/views/knowledge/components/importReview.js'
import { materialQuestions } from '../src/views/knowledge/components/materialSelection.js'
import { candidateContent, candidateReviewable } from '../src/views/knowledge/components/candidateContent.js'

test('审批保持大整数ID与版本字符串，并拒绝已可能损失精度的数字输入', () => {
  const row = { id: '9007199254740993123', rowVersion: '9007199254740993124' }
  const [item] = batchItems([row], '已核对完整题面与来源')
  assert.equal(item.questionId, row.id)
  assert.equal(item.expectedRowVersion, row.rowVersion)
  assert.equal(item.contentReviewed, true)
  assert.throws(() => actionPayload({ id: 9007199254740992, rowVersion: '0' }, '理由'), /精度/)
  assert.throws(() => batchItems([row, row], '理由'), /重复/)
  assert.throws(() => batchItems(Array.from({ length: 51 }, (_, index) => ({ id: String(index + 1), rowVersion: '0' })), '理由'), /50/)
})

test('部分成功恢复只重试未确认操作，保留成功回执和冲突，不自动换版本', () => {
  const items = batchItems(['11', '12', '13'].map(id => ({ id, rowVersion: '7' })), '审核通过')
  const first = items.map((item, index) => ({ questionId: item.questionId, operationId: item.operationId, outcome: ['SUCCESS', 'CONFLICT', 'PENDING'][index] }))
  assert.deepEqual(unresolvedApprovalItems(items, first), [items[2]])
  const final = mergeApprovalResults(first, [{ ...first[2], outcome: 'SUCCESS' }])
  assert.equal(final.length, 3)
  assert.equal(final[1].outcome, 'CONFLICT')
  assert.deepEqual(unresolvedApprovalItems(items, final), [])
  assert.equal(items[1].expectedRowVersion, '7')
  assert.throws(() => mergeApprovalResults(first, [{ ...first[0], questionId: 'other' }], items), /身份/)
  assert.throws(() => mergeApprovalResults(first, [first[0], first[0]], items), /身份/)
  assert.deepEqual(unresolvedApprovalItems(items, [{ ...first[0], outcome: 'UNKNOWN' }]), items)
})

test('业务失败保留结构化检查及回执，过滤凭据，503和网络未知结果可按原身份恢复', () => {
  const error = businessError({ code: 409, msg: '版本冲突', data: { currentRowVersion: '8', checks: [{ code: 'Q07', message: '版本已变化', passed: false }], accessToken: 'private', nested: { authorization: 'private', operationId: 'stable-1' } } })
  assert.equal(error.businessCode, 409)
  assert.equal(error.details.currentRowVersion, '8')
  assert.equal(error.details.nested.operationId, 'stable-1')
  assert.ok(!JSON.stringify(error.details).includes('private'))
  assert.equal(knownReviewRejection(error), true)
  assert.equal(knownReviewRejection(businessError({ code: 503, msg: '待对账' })), false)
  assert.equal(knownReviewRejection(new Error('timeout')), false)
  assert.equal(businessError({ code: 500, msg: '失败' }).businessCode, 500)
})

test('不同账号和题目的未确认操作隔离，恢复保留完整请求身份', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) }
  const key = pendingReviewKey('teacher-a', 'question:15')
  const pending = { action: 'approve', payload: { operationId: 'stable-15', expectedRowVersion: '3', reason: '核对完成', contentReviewed: true } }
  values.set(key, JSON.stringify(pending))
  assert.deepEqual(readPendingReview(storage, key), pending)
  assert.equal(readPendingReview(storage, pendingReviewKey('teacher-b', 'question:15')), null)
  assert.equal(readPendingReview(storage, pendingReviewKey('teacher-a', 'question:16')), null)
})

test('A慢B快和页面关闭不会让旧响应写回数据或清掉新loading', async () => {
  const requests = createRequestGeneration()
  let resolveA, resolveB, state = '', loading = false
  async function load(wait) {
    const ticket = requests.start(); loading = true
    try { const value = await wait; if (requests.current(ticket)) state = value }
    finally { if (requests.current(ticket)) loading = false }
  }
  const a = load(new Promise(resolve => { resolveA = resolve }))
  const b = load(new Promise(resolve => { resolveB = resolve }))
  resolveA('old'); await a
  assert.equal(state, ''); assert.equal(loading, true)
  resolveB('new'); await b
  assert.equal(state, 'new'); assert.equal(loading, false)
  const ticket = requests.start(); requests.invalidate()
  assert.equal(requests.current(ticket), false)
})

test('计算三项与合法旧题维护分开，数量例外仍交服务端验证', () => {
  const meta = { questionType: 'CALCULATION', unitKind: 'GROUP' }
  assert.ok(calculationPreflight(meta, 'create', 2, ''))
  assert.equal(calculationPreflight(meta, 'create', 3, ''), '')
  assert.equal(calculationPreflight(meta, 'update', 2, ''), '')
  assert.equal(calculationPreflight(meta, 'derive', 2, 'server-exception-id'), '')
  assert.equal(calculationPreflight({ questionType: 'INQUIRY', unitKind: 'GROUP' }, 'create', 2, ''), '')
  const hash = 'a'.repeat(64)
  const dataset = { intent: 'derive', parentId: '9007199254740993123', expectedParentRowVersion: '0', expectedParentStemHash: hash, expectedParentContentHash: hash }
  assert.equal(derivePreflight(dataset, { id: dataset.parentId, rowVersion: '0', stemHash: hash, contentHash: hash }), '')
  assert.ok(derivePreflight({ ...dataset, expectedParentRowVersion: undefined }))
  assert.ok(derivePreflight(dataset, { id: dataset.parentId, rowVersion: '1', stemHash: hash }))
  assert.ok(derivePreflight(dataset, { id: dataset.parentId, rowVersion: '0', stemHash: hash, contentHash: 'b'.repeat(64) }))
})

test('候选只有当前真实冻结身份可审批，纯文本转录不得作为HTML执行', () => {
  const candidate = { current: true, workerKind: 'CODEX', runId: 'run-a', candidateKey: 'c1', candidateHash: 'b'.repeat(64) }
  assert.equal(candidateReviewable(candidate, 'run-a', 'c1'), true)
  assert.equal(candidateReviewable({ ...candidate, workerKind: 'FAKE' }, 'run-a', 'c1'), false)
  assert.equal(candidateReviewable({ ...candidate, current: false }, 'run-a', 'c1'), false)
  assert.equal(candidateReviewable(candidate, 'run-b', 'c1'), false)
  assert.equal(candidateReviewable({ ...candidate, candidateHash: '' }, 'run-a', 'c1'), false)
  const body = candidateContent({ stem: '<script>doNotRun()</script>', items: [{ key: 'stable-1', stem: '2 < 3', answer: '正确' }] })
  assert.ok(body.includes('&lt;script&gt;'))
  assert.ok(body.includes('data-item-key="stable-1"'))
  assert.ok(!body.includes('<script>'))
  assert.ok(candidateContent({ items: [{ key: 'stable-1', answer: '正确' }] }, 'answer').includes('正确'))
})


test('专项读取按原题序保留缺失或软删除引用，不静默删题', () => {
  const items = materialQuestions({ questionIds: ['31', '32', '33'], questions: [{ id: '33', status: 'DELETED' }, { id: '31', status: 'READY' }] })
  assert.deepEqual(items.map(item => item.id), ['31', '32', '33'])
  assert.equal(items[1].unavailable, true)
  assert.equal(items[2].status, 'DELETED')
  assert.equal(materialQuestions({ questionIds: ['32'], questions: [] }, [{ id: '32', title: '既有题名' }])[0].title, '既有题名')
})
