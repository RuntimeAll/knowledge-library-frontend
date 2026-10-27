import { isConfirmedBusinessError } from '../../../utils/business-error.js'

export const reviewActions = {
  approve: { label: '批准正常', permission: 'knowledge:question:approve' },
  draft: { label: '退回草稿', permission: 'knowledge:question:edit' },
  delete: { label: '软删除', permission: 'knowledge:question:remove' },
  restore: { label: '恢复为草稿', permission: 'knowledge:question:restore' },
  exception: { label: '专项数量批准', permission: 'knowledge:question:granularityException' }
}

export function newOperationId() { return `ui-review:${globalThis.crypto.randomUUID()}` }
export function pendingReviewKey(account, identity) { return `kb-review-pending:${encodeURIComponent(account)}:${encodeURIComponent(identity)}` }
export function readPendingReview(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    return value?.payload?.operationId && value.action ? value : null
  } catch { return null }
}
export function knownReviewRejection(error) {
  return isConfirmedBusinessError(error) && [400, 403, 404, 409].includes(error.businessCode)
}
export function actionPayload(row, reason, contentReviewed = false) {
  if (typeof row?.id !== 'string' || !/^[1-9]\d*$/.test(row.id) || typeof row.rowVersion !== 'string' || !/^\d+$/.test(row.rowVersion)) throw new Error('请重新读取题目及字符串版本，避免编号精度损失')
  if (!reason.trim() || reason.trim().length > 2000) throw new Error('请填写 1～2000 字的审查理由')
  return { operationId: newOperationId(), expectedRowVersion: row.rowVersion, reason: reason.trim(), contentReviewed }
}
export function batchItems(rows, reason) {
  if (!rows.length || rows.length > 50) throw new Error('每次批准请选择 1～50 道题')
  if (new Set(rows.map(row => String(row.id))).size !== rows.length) throw new Error('批量审批不能包含重复题目')
  return rows.map(row => ({ questionId: String(row.id), ...actionPayload(row, reason, true) }))
}

export function mergeApprovalResults(previous, incoming, requests = null) {
  if (requests) {
    const expected = new Map(requests.map(item => [item.operationId, item.questionId]))
    const seen = new Set()
    for (const item of incoming) {
      if (!expected.has(item.operationId) || expected.get(item.operationId) !== item.questionId || seen.has(item.operationId)) throw new Error('批量回执与原题目身份不一致，请保留原操作编号查回')
      seen.add(item.operationId)
    }
  }
  const byOperation = new Map(previous.map(item => [item.operationId, item]))
  incoming.forEach(item => byOperation.set(item.operationId, item))
  return [...byOperation.values()]
}

export function unresolvedApprovalItems(items, results) {
  const confirmed = new Set(results.filter(item => ['SUCCESS', 'CONFLICT', 'FAILED'].includes(item.outcome)).map(item => item.operationId))
  return items.filter(item => !confirmed.has(item.operationId))
}
