<template>
  <div class="scope-list">
    <record-picker v-if="!readonly" :model-value="modelValue.map(scope => scope.outlineId)" type="outline" :filters="{ catalogKind: 'TEXTBOOK', subject: subject || undefined }" @update:model-value="selectOutlines" />
    <el-card v-for="scope in modelValue" :key="String(scope.outlineId)" shadow="never" class="scope-card">
      <div class="scope-heading">{{ catalogs[scope.outlineId]?.title || scope.outlineTitle || '正在读取教材…' }}</div>
      <div class="scope-meta" v-if="catalogs[scope.outlineId] || scope.subject">
        {{ textbookLabel(catalogs[scope.outlineId] || scope) }}
      </div>
      <template v-if="readonly">
        <p>{{ label('scopeKind', scope.scopeKind) }}</p>
        <div v-if="scope.scopeKind === 'CHAPTERS'">{{ (scope.nodeIds || []).map(id => nodeName(scope.outlineId, id)).join('、') }}</div>
        <p v-if="scope.note">{{ scope.note }}</p>
      </template>
      <template v-else>
        <el-form-item label="范围"><enum-select v-model="scope.scopeKind" field="scopeKind" @update:model-value="scope.nodeIds = []" /></el-form-item>
        <el-form-item v-if="scope.scopeKind === 'CHAPTERS'" label="章节">
          <el-tree-select v-model="scope.nodeIds" :data="nodeTree(catalogs[scope.outlineId]?.nodes)" :props="{ label: 'title', value: 'id', children: 'children' }" node-key="id" multiple show-checkbox check-strictly clearable filterable style="width:100%" placeholder="选择实际覆盖的章或节" @update:model-value="normalizeNodes(scope)" />
        </el-form-item>
        <el-form-item label="范围说明"><el-input v-model="scope.note" maxlength="2000" /></el-form-item>
      </template>
    </el-card>
    <span v-if="!modelValue.length" class="scope-meta">尚未声明教材范围</span>
  </div>
</template>
<script setup>
import { getRecord } from '@/api/knowledge'
import RecordPicker from './RecordPicker.vue'
import EnumSelect from './EnumSelect.vue'
import { label } from './labels'
import { nodeTree } from './catalog'
const props = defineProps({ modelValue: { type: Array, default: () => [] }, subject: String, readonly: Boolean })
const emit = defineEmits(['update:modelValue'])
const catalogs = reactive({})
watch(() => props.modelValue.map(scope => String(scope.outlineId)), async ids => {
  await Promise.all(ids.filter(id => !catalogs[id]).map(async id => {
    try { catalogs[id] = (await getRecord('outline', id)).data } catch { catalogs[id] = { title: '教材暂时无法读取', nodes: [] } }
  }))
}, { immediate: true })
function textbookLabel(row) { return ['subject', 'textbookVersion', 'grade', 'term'].map(field => label(field, row[field])).join(' · ') + (row.edition ? ` · ${row.edition}` : '') }
function nodeName(outlineId, id) { return catalogs[outlineId]?.nodes?.find(node => String(node.id) === String(id))?.title || '章节暂时无法读取' }
function selectOutlines(ids) {
  emit('update:modelValue', ids.map(id => props.modelValue.find(scope => String(scope.outlineId) === String(id)) || { outlineId: id, scopeKind: 'CATALOG_ONLY', nodeIds: [], note: '' }))
}
function normalizeNodes(scope) {
  const selected = new Set((scope.nodeIds || []).map(String))
  const parents = new Map((catalogs[scope.outlineId]?.nodes || []).map(node => [String(node.id), String(node.parentId)]))
  scope.nodeIds = [...selected].filter(id => {
    const seen = new Set()
    let parent = parents.get(id)
    while (parent && !seen.has(parent)) { if (selected.has(parent)) return false; seen.add(parent); parent = parents.get(parent) }
    return true
  })
}
</script>
<style scoped>.scope-list { width:100%; }.scope-card { margin-top:10px; }.scope-heading { font-weight:600; }.scope-meta { color:#909399;font-size:12px;line-height:1.8;margin-bottom:8px; }</style>
