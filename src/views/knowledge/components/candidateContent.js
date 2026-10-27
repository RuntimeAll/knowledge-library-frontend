function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
function part(value, name) {
  return value?.[`${name}Html`] || (value?.[name] ? `<p>${escapeHtml(value[name]).replaceAll('\n', '<br>')}</p>` : '')
}
export function candidateContent(record = {}, name = 'stem') {
  let html = part(record, name)
  if (name === 'stem' && record.options?.length) html += `<div data-kb-role="options">${record.options.map(option => `<div><span>${escapeHtml(option.key)}. </span>${option.html || escapeHtml(option.text)}</div>`).join('')}</div>`
  if (record.items?.length) html += `<div data-kb-role="group" data-columns="${[1, 2, 3, 4].includes(record.columns) ? record.columns : 1}">${record.items.map(item => `<div data-item-key="${escapeHtml(item.key)}"><span>${escapeHtml(item.key)}. </span>${part(item, name)}</div>`).join('')}</div>`
  return html
}
export function candidateReviewable(candidate, runId, candidateKey) {
  return candidate?.current === true && ['CODEX', 'WRITER'].includes(candidate.workerKind)
    && candidate.runId === runId && candidate.candidateKey === candidateKey
    && /^[a-f0-9]{64}$/.test(candidate.candidateHash || '')
}
