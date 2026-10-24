import { getRecord, getKpNames } from './index'
import { getToken } from '@/utils/auth'

// Share only requests that are currently in flight. Do not retain fetched
// records: a later render must see metadata edited elsewhere.
const pending = new Map()
const queues = new Map()

function enqueueKp(token, id, resolve, reject) {
  let queue = queues.get(token)
  if (!queue) {
    queue = []
    queues.set(token, queue)
    // Vue renders all rows synchronously: collect their explicit references
    // before issuing the lookup, instead of fetching one full record per tag.
    queueMicrotask(() => {
      queues.delete(token)
      if (getToken() !== token) {
        queue.forEach(item => item.reject(new Error('登录状态已变更')))
        return
      }
      for (let start = 0; start < queue.length; start += 200) {
        const batch = queue.slice(start, start + 200)
        getKpNames(batch.map(item => item.id)).then(result => {
          const byId = new Map((result.data || []).map(item => [String(item.id), item]))
          batch.forEach(item => {
            const data = byId.get(item.id)
            if (data) item.resolve({ data })
            else item.reject(new Error('考点不存在或无法读取'))
          })
        }).catch(error => batch.forEach(item => item.reject(error)))
      }
    })
  }
  queue.push({ id: String(id), resolve, reject })
}

export function getReferenceRecord(type, id) {
  const token = getToken()
  const key = JSON.stringify([token, type, String(id)])
  if (pending.has(key)) return pending.get(key)
  const request = (type === 'kp'
    ? new Promise((resolve, reject) => enqueueKp(token, id, resolve, reject))
    : getRecord(type, id)).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
