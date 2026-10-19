<template>
  <el-divider content-position="left">成品题单与来源追溯</el-divider>
  <el-alert title="题单记录编制时的题目版本和指纹；当前题目正文可能已更新。成品文件与历史题单保持原样。" type="info" :closable="false" class="mb8" />
  <record-picker v-if="!readonly" :model-value="(model.questionRefs || []).map(item => item.questionId)" type="question" :disabled="loading" :filters="{subject:model.profile?.subject || undefined}" @change="selectQuestions" />
  <el-table :data="model.questionRefs || []" empty-text="未登记题单；不能据文件名推断题目关系">
    <el-table-column label="题序" prop="seq" width="75" />
    <el-table-column label="题目（当前标题）" min-width="220"><template #default="{ row }"><span v-if="row.questionTitle">{{ row.questionTitle }}</span><relation-names v-else type="question" :ids="[row.questionId]" /></template></el-table-column>
    <el-table-column label="编制时版本" prop="questionRowVersion" width="110" />
    <el-table-column label="题干指纹" prop="stemHash" min-width="190" show-overflow-tooltip />
    <el-table-column label="文件内位置" min-width="160"><template #default="{ row }"><span v-if="readonly">{{ row.itemLocator || '未登记' }}</span><el-input v-else v-model="row.itemLocator" placeholder="题号 / 页码，可留空" /></template></el-table-column>
    <el-table-column v-if="!readonly" label="顺序" width="115"><template #default="{ $index }"><el-button link :disabled="$index === 0" @click="move($index, -1)">上移</el-button><el-button link :disabled="$index === model.questionRefs.length - 1" @click="move($index, 1)">下移</el-button></template></el-table-column>
  </el-table>
  <el-form-item label="参考来源" class="reference-picker"><record-picker v-if="!readonly" :model-value="(model.referenceSources || []).map(item => item.sourceId)" type="source" @update:model-value="selectSources" /><span v-else-if="!model.referenceSources?.length">未登记</span></el-form-item>
  <el-table v-if="model.referenceSources?.length" :data="model.referenceSources">
    <el-table-column label="来源" min-width="220"><template #default="{ row }"><span v-if="row.sourceTitle">{{ row.sourceTitle }}</span><relation-names v-else type="source" :ids="[row.sourceId]" /></template></el-table-column>
    <el-table-column label="引用说明" min-width="250"><template #default="{ row }"><span v-if="readonly">{{ row.note || '未填写' }}</span><el-input v-else v-model="row.note" maxlength="2000" /></template></el-table-column>
  </el-table>
  <el-alert v-if="model.snapshotJson && snapshotMismatch" title="当前关联专项与生成快照中的专项不同；以生成时快照和冻结文件为追溯依据。" type="warning" :closable="false" class="reference-picker" />
</template>
<script setup>
import RecordPicker from './RecordPicker.vue'
import RelationNames from './RelationNames.vue'
import { getRecord } from '@/api/knowledge'
const props = defineProps({ model: Object, readonly: Boolean })
const emit = defineEmits(['busy'])
const loading = ref(false)
const snapshotMismatch = computed(() => {
  try { const snapshot = JSON.parse(props.model.snapshotJson); return snapshot.materialId && String(snapshot.materialId) !== String(props.model.materialId) } catch { return false }
})
let selectionGeneration = 0
async function selectQuestions(rows) {
  const ticket = ++selectionGeneration
  loading.value = true
  emit('busy', true)
  try {
    const result = await Promise.all(rows.map(async (row, index) => {
      const old = props.model.questionRefs?.find(item => String(item.questionId) === String(row.id))
      if (old) return { ...old, seq:index + 1 }
      const current = (await getRecord('question', row.id)).data
      return { seq:index + 1, questionId:current.id, questionTitle:current.title, questionRowVersion:current.rowVersion, stemHash:current.stemHash, itemLocator:'' }
    }))
    if (ticket === selectionGeneration) props.model.questionRefs = result
  } finally {
    if (ticket === selectionGeneration) { loading.value = false; emit('busy', false) }
  }
}
function cancelPending() { ++selectionGeneration; loading.value = false; emit('busy', false) }
watch(() => props.model, cancelPending)
onBeforeUnmount(cancelPending)
function selectSources(ids) { props.model.referenceSources = ids.map(id => props.model.referenceSources?.find(item => String(item.sourceId) === String(id)) || { sourceId:id,note:'' }) }
function move(index, offset) { const rows = props.model.questionRefs; [rows[index],rows[index + offset]] = [rows[index + offset],rows[index]]; rows.forEach((row, position) => { row.seq = position + 1 }) }
</script>
<style scoped>.reference-picker { margin-top:14px; }</style>
