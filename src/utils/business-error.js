const privateField = /token|password|authorization|secret|credential|cookie/i

function safeDetails(value, depth = 0) {
  if (depth > 12) return undefined
  if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) return value.map(item => safeDetails(item, depth + 1))
  if (typeof value !== 'object') return undefined
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !privateField.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key))
    .map(([key, item]) => [key, safeDetails(item, depth + 1)]))
}

// Keep confirmed business failures distinct from a timeout with unknown outcome.
export function businessError(response, fallback = '请求未完成') {
  return Object.assign(new Error(response?.msg || fallback), {
    code: response?.code,
    businessCode: response?.code,
    details: safeDetails(response?.data),
    confirmed: true
  })
}

export function isConfirmedBusinessError(error) {
  return error?.confirmed === true && typeof error.businessCode === 'number'
}
