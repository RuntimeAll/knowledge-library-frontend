// Material identities/order survive incomplete detail projections and unavailable questions.
export function materialQuestions(record, previous = []) {
  const ids = record.questionIds || (record.questions || []).map(item => item.id)
  const byId = new Map(previous.map(item => [String(item.id), item]))
  ;(record.questions || []).forEach(item => byId.set(String(item.id), item))
  return ids.map(id => byId.get(String(id)) || { id: String(id), title: `编号 ${id}（当前不可读取）`, unavailable: true })
}
