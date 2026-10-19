<template>
  <div class="pdf-preview">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-else>
      <div class="pdf-toolbar">
        <el-button :disabled="busy || pageNumber <= 1" @click="pageNumber--">上一页</el-button>
        <span>第 {{ pageNumber }} / {{ pageCount || '—' }} 页</span>
        <el-button :disabled="busy || pageNumber >= pageCount" @click="pageNumber++">下一页</el-button>
        <el-select v-model="zoom" aria-label="预览缩放" :disabled="busy || !pageCount" class="pdf-zoom">
          <el-option label="适合宽度" :value="0" />
          <el-option label="75%" :value="0.75" />
          <el-option label="100%" :value="1" />
          <el-option label="150%" :value="1.5" />
          <el-option label="200%" :value="2" />
        </el-select>
      </div>
      <div ref="viewport" v-loading="busy" element-loading-text="正在加载 PDF" class="pdf-viewport">
        <canvas ref="canvas" :aria-label="`PDF 第 ${pageNumber} 页`" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { getDocument, GlobalWorkerOptions, AnnotationMode, version } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getAssetBlob } from '@/api/knowledge'

const props = defineProps({ assetId: [String, Number], loadBlob: Function })
GlobalWorkerOptions.workerSrc = workerUrl
const canvas = ref(), viewport = ref(), error = ref(''), busy = ref(false)
const pageNumber = ref(1), pageCount = ref(0), zoom = ref(0)
let document, loadingTask, renderingTask, generation = 0, renderGeneration = 0

function dispose() {
  generation++
  renderGeneration++
  renderingTask?.cancel()
  renderingTask = undefined
  loadingTask?.destroy().catch(() => {})
  loadingTask = undefined
  document = undefined
}

async function renderPage() {
  if (!document) return
  const ticket = ++renderGeneration
  const previous = renderingTask
  previous?.cancel()
  busy.value = true
  try {
    if (previous) await previous.promise.catch(() => {})
    const page = await document.getPage(pageNumber.value)
    await nextTick()
    if (ticket !== renderGeneration || !canvas.value) return
    const unscaled = page.getViewport({ scale: 1 })
    const width = Math.max(240, (viewport.value?.clientWidth || 800) - 32)
    const scale = zoom.value || Math.min(2, width / unscaled.width)
    const view = page.getViewport({ scale })
    // Bound the canvas allocation for unusually large PDF page dimensions.
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (view.width * view.height)))
    canvas.value.width = Math.ceil(view.width * ratio)
    canvas.value.height = Math.ceil(view.height * ratio)
    canvas.value.style.width = `${view.width}px`
    canvas.value.style.height = `${view.height}px`
    renderingTask = page.render({ canvas: canvas.value, viewport: view,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0], annotationMode: AnnotationMode.DISABLE })
    await renderingTask.promise
  } catch (cause) {
    if (ticket === renderGeneration && cause?.name !== 'RenderingCancelledException') {
      error.value = 'PDF 页面显示失败，请下载原件查看。'
    }
  } finally {
    if (ticket === renderGeneration) busy.value = false
  }
}

watch(() => [props.assetId, props.loadBlob], async ([id]) => {
  dispose()
  const ticket = generation
  error.value = ''
  busy.value = true
  pageNumber.value = 1
  pageCount.value = 0
  zoom.value = 0
  try {
    const blob = await (props.loadBlob ? props.loadBlob() : getAssetBlob(id))
    if (ticket !== generation) return
    if (blob.type?.includes('json')) {
      const result = JSON.parse(await blob.text())
      throw new Error(result.msg || '读取原件失败')
    }
    const data = new Uint8Array(await blob.arrayBuffer())
    if (ticket !== generation) return
    const resources = `${import.meta.env.BASE_URL}pdfjs/${version}/`
    loadingTask = getDocument({ data, cMapUrl: resources + 'cmaps/', cMapPacked: true,
      standardFontDataUrl: resources + 'standard_fonts/', wasmUrl: resources + 'wasm/',
      iccUrl: resources + 'iccs/', enableXfa: false })
    const loaded = await loadingTask.promise
    if (ticket !== generation) { await loaded.destroy(); return }
    document = loaded
    pageCount.value = loaded.numPages
    await renderPage()
  } catch (cause) {
    if (ticket === generation) {
      error.value = cause?.name === 'PasswordException'
        ? '此 PDF 已加密，请下载原件并使用密码打开。'
        : 'PDF 预览失败，请确认文件可下载后重试，或下载原件查看。'
    }
  } finally {
    if (ticket === generation) busy.value = false
  }
}, { immediate: true })
watch([pageNumber, zoom], renderPage)
onBeforeUnmount(dispose)
</script>

<style scoped>
.pdf-toolbar { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.pdf-zoom { width: 130px; }
.pdf-viewport { height: 65vh; overflow: auto; padding: 16px; background: var(--el-fill-color-light); text-align: center; }
.pdf-viewport canvas { display: inline-block; background: #fff; box-shadow: var(--el-box-shadow-light); max-width: none; }
</style>
