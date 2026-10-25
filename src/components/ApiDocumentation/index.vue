<template>
  <section class="api-documentation" :class="{ 'is-standalone': standalone }">
    <header class="docs-header">
      <div>
        <h1>知识库核心接口</h1>
        <p>当前请求环境：<strong>{{ environment }}</strong></p>
        <p>文档可公开阅读。调用时请在 Authorize 中输入自己的 Token；刷新后需重新授权。</p>
      </div>
      <nav aria-label="接口文档导航">
        <a :href="links.schema" target="_blank" rel="noopener">OpenAPI JSON</a>
        <router-link v-if="standalone" to="/login">返回登录</router-link>
        <router-link v-else to="/api-docs" target="_blank">独立打开</router-link>
      </nav>
    </header>
    <iframe
      ref="frame"
      class="docs-frame"
      :src="frameUrl"
      title="知识库核心接口文档与调试"
      referrerpolicy="same-origin"
      @load="onFrameLoad"
    />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiDocsLinks } from '@/utils/api-docs'

defineOptions({ name: 'ApiDocumentation' })
defineProps({ standalone: Boolean })
const route = useRoute()
const router = useRouter()
const links = apiDocsLinks(import.meta.env.VITE_APP_BASE_API)
const environment = `${window.location.origin}${links.prefix || '/'}`
const frame = ref(null)
const initialHash = route.hash
const frameUrl = computed(() => links.ui + initialHash)
let frameWindow
let hashTimer

function comparableHash(hash) {
  try { return decodeURIComponent(hash) } catch { return hash }
}

// Preserve Swagger's native deep links in the outer route so refresh/share works.
function syncHash() {
  try {
    const hash = frameWindow?.location.hash || ''
    if (comparableHash(hash) !== comparableHash(route.hash)) router.replace({ hash })
  } catch {
    disconnectFrame()
  }
}

function disconnectFrame() {
  clearInterval(hashTimer)
  hashTimer = undefined
  frameWindow?.removeEventListener('hashchange', syncHash)
  frameWindow = undefined
}

function onFrameLoad() {
  disconnectFrame()
  const current = frame.value?.contentWindow
  try {
    if (current?.location.origin !== window.location.origin) return
    frameWindow = current
    current.addEventListener('hashchange', syncHash)
    // Swagger also uses history.replaceState, which does not emit hashchange.
    // Read only the same-origin frame URL; no API polling or credential access.
    hashTimer = setInterval(syncHash, 250)
  } catch {
    // A proxy error/redirect must not break the surrounding public page.
  }
}

watch(() => route.hash, hash => {
  if (frameWindow && comparableHash(frameWindow.location.hash) !== comparableHash(hash)) frameWindow.location.hash = hash
})
onBeforeUnmount(disconnectFrame)
</script>

<style scoped>
.api-documentation { display: flex; flex-direction: column; min-height: calc(100vh - 110px); background: #fff; }
.api-documentation.is-standalone { min-height: 100vh; }
.docs-header { display: flex; justify-content: space-between; gap: 16px; padding: 16px 24px; border-bottom: 1px solid #dcdfe6; }
.docs-header h1 { margin: 0 0 8px; font-size: 22px; color: #303133; }
.docs-header p { margin: 4px 0; color: #606266; font-size: 13px; overflow-wrap: anywhere; }
.docs-header nav { display: flex; align-items: center; gap: 18px; white-space: nowrap; }
.docs-header a { color: #337ecc; }
.docs-frame { display: block; width: 100%; flex: 1; min-height: 75vh; border: 0; }
@media (max-width: 640px) { .docs-header { flex-direction: column; padding: 16px; } }
</style>
