<template>
  <div class="relation-names">
    <el-tag v-for="item in items" :key="String(item.id)">
      {{ item.title || item.name || `编号 ${item.id}` }}
    </el-tag>
    <span v-if="!items.length" class="empty">未关联</span>
  </div>
</template>
<script setup>
import { getRecord } from '@/api/knowledge'
const props = defineProps({
  type: String,
  ids: { type: Array, default: () => [] }
})
const items = ref([])
let generation = 0
watch(
  () => props.ids,
  async (ids) => {
    const ticket = ++generation
    const result = await Promise.all(
      (ids || []).map((id) =>
        getRecord(props.type, id)
          .then((r) => r.data)
          .catch(() => ({ id, title: `编号 ${id}（无法读取）` }))
      )
    )
    if (ticket === generation) items.value = result
  },
  { immediate: true, deep: true }
)
</script>
<style scoped>
.relation-names {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.empty {
  color: #909399;
}
</style>
