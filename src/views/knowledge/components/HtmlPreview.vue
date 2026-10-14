<template>
  <iframe
    :srcdoc="documentHtml"
    sandbox=""
    referrerpolicy="no-referrer"
    class="html-preview"
    title="题目只读预览"
  />
</template>
<script setup>
import renderMathInElement from 'katex/contrib/auto-render'
import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?inline'
import { knowledgeRequest } from '@/api/knowledge'
const props = defineProps({
  html: { type: String, default: '' },
  answer: { type: Boolean, default: false }
})
const resolvedHtml = ref('')
let generation = 0
watch(
  () => props.html,
  async (html) => {
    const ticket = ++generation,
      container = document.createElement('div')
    container.innerHTML = html || ''
    const images = [
      ...container.querySelectorAll('img[data-asset-id],img[src^="kb-asset:"]')
    ]
    await Promise.all(
      images.map(async (image) => {
        const id = image.dataset.assetId || image.getAttribute('src').slice(9)
        try {
          const response = await knowledgeRequest(
            `/asset/${encodeURIComponent(id)}/preview`
          )
          image.setAttribute('src', response.data.url)
        } catch {
          image.removeAttribute('src')
          image.setAttribute('alt', '题图暂不可读取，请检查资产状态')
        }
      })
    )
    if (ticket === generation) resolvedHtml.value = container.innerHTML
  },
  { immediate: true }
)
const documentHtml = computed(() => {
  const container = document.createElement('div')
  // Detached markup is never mounted into the app. The iframe also disables scripts/forms.
  container.innerHTML = resolvedHtml.value || '<p>暂无内容</p>'
  container
    .querySelectorAll('script,iframe,object,embed,form,meta,base')
    .forEach((node) => node.remove())
  container.querySelectorAll('*').forEach((node) =>
    [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name)
    })
  )
  container.querySelectorAll('[data-latex]').forEach((node) => {
    katex.render(node.dataset.latex || '', node, {
      throwOnError: false,
      displayMode: node.dataset.display === 'block'
    })
  })
  renderMathInElement(container, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false
  })
  return `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${katexCss} body{font:16px/1.7 Arial,'Microsoft YaHei',sans-serif;color:${props.answer ? '#d03030' : '#222'};padding:16px;margin:0;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #aaa;padding:6px}pre{white-space:pre-wrap}</style></head><body>${container.innerHTML}</body></html>`
})
</script>
<style scoped>
.html-preview {
  width: 100%;
  min-height: 300px;
  border: 1px solid #e4e7ed;
  background: #fff;
  border-radius: 4px;
}
</style>
