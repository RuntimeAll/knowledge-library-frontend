<template>
  <div class="outline-bindings">
    <div v-for="binding in bindings" :key="`${binding.outlineId}-${binding.nodeId || 'root'}`">
      <el-button link type="primary" @click="open(binding)">
        {{ binding.outlineTitle }}
      </el-button>
      <div class="binding-detail">
        {{ [label('subject', binding.subject), label('textbookVersion', binding.textbookVersion), label('grade', binding.grade), label('term', binding.term)].join(' · ') }}
        <span v-if="binding.edition"> · {{ binding.edition }}</span>
        <div>{{ binding.nodeTitle || '待定位章节' }}</div>
      </div>
    </div>
    <span v-if="!bindings.length" class="binding-detail">尚未挂载教材大纲</span>
  </div>
</template>
<script setup>
import { label } from './labels'
defineProps({ bindings: { type: Array, default: () => [] } })
const router = useRouter()
function open(binding) {
  router.push({ path: '/knowledge/outline', query: { outlineId: binding.outlineId, nodeId: binding.nodeId || undefined } })
}
</script>
<style scoped>
.outline-bindings { display: flex; flex-direction: column; gap: 8px; }
.binding-detail { color: #909399; font-size: 12px; line-height: 1.6; }
</style>
