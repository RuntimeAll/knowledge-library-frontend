// A configured path, never a user-provided URL: authorization stays on this site.
export function normalizeApiPrefix(value) {
  const prefix = String(value || '').replace(/\/$/, '')
  if (prefix && !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(prefix)) {
    throw new Error('VITE_APP_BASE_API 必须是当前站点的路径前缀')
  }
  return prefix
}

export function apiDocsLinks(baseApi) {
  const prefix = normalizeApiPrefix(baseApi)
  return {
    prefix,
    ui: `${prefix}/swagger-ui/index.html`,
    schema: `${prefix}/v3/api-docs/core`
  }
}
