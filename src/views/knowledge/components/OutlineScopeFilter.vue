<template>
  <el-form-item label="教材大纲">
    <record-picker :model-value="outlineId ? [outlineId] : []" type="outline" :multiple="false"
      :filters="{ catalogKind: 'TEXTBOOK' }" @update:model-value="selectOutline" />
  </el-form-item>
  <el-form-item v-if="outlineId" label="章节">
    <el-tree-select :model-value="outlineNodeId" :data="tree" :props="{ label: 'title', value: 'id', children: 'children' }"
      node-key="id" check-strictly clearable style="width: 230px" placeholder="全部章节（含待定位考点）"
      @update:model-value="$emit('update:outlineNodeId', $event || undefined)" />
  </el-form-item>
</template>
<script setup>
import RecordPicker from './RecordPicker.vue'
import { getReferenceRecord } from '@/api/knowledge/reference-requests'
const props = defineProps({ outlineId: [Number, String], outlineNodeId: [Number, String] })
const emit = defineEmits(['update:outlineId', 'update:outlineNodeId'])
const nodes = ref([])
let generation = 0
watch(() => props.outlineId, async id => {
  const ticket = ++generation
  nodes.value = []
  if (!id) return
  const data = await getReferenceRecord('outline', id).then(result => result.data).catch(() => null)
  if (ticket === generation) nodes.value = data?.nodes || []
}, { immediate: true })
const tree = computed(() => {
  const items = nodes.value.map(node => ({ ...node, children: [] }))
  const byId = new Map(items.map(node => [String(node.id), node]))
  const roots = []
  for (const node of items) {
    const parent = byId.get(String(node.parentId))
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})
function selectOutline(ids) {
  emit('update:outlineId', ids[0])
  emit('update:outlineNodeId', undefined)
}
</script>
