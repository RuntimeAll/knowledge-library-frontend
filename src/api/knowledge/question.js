import { listRecords } from './index'

// Explicit selected identities, not an unbounded business-list download.
export async function getQuestionsByIds(ids, purpose = 'MAINTENANCE') {
  const unique = [...new Set(ids.map(id => String(id)))]
  if (!unique.length) return []
  if (unique.length > 500 || unique.some(id => !/^[1-9]\d*$/.test(id))) throw new Error('请选择有效题目编号，每次最多读取 500 道已选题')
  const batches = []
  for (let start = 0; start < unique.length; start += 100) batches.push(unique.slice(start, start + 100))
  const responses = await Promise.all(batches.map(batch => listRecords('question', { ids: batch.join(','), purpose, pageNum: 1, pageSize: 100 })))
  return responses.flatMap(response => response.rows || [])
}
