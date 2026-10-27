<template>
  <el-dialog v-model="open" title="专项候选题（服务端分页）" width="1000px" append-to-body destroy-on-close>
    <el-alert :title="material.selectionMode === 'EXAM_ONLY' ? '仅显示参考范围内当前可用的真题。没有候选时，请核对审批、来源和出处。' : '仅显示当前可用题。混合模式可选择正常自编题与变式。'" type="info" :closable="false" class="mb8" />
    <el-form inline @submit.prevent="search">
      <el-form-item label="标题"><el-input v-model="query.title" clearable @keyup.enter="search" /></el-form-item>
      <el-form-item label="题干关键词"><el-input v-model="query.query" clearable @keyup.enter="search" /></el-form-item>
      <el-form-item label="内容类型"><enum-select v-model="query.contentKind" field="contentKind" clearable style="width: 140px" /></el-form-item>
      <el-form-item label="题型"><enum-select v-model="query.questionType" field="questionType" clearable style="width: 150px" /></el-form-item>
      <el-form-item label="范围">
        <el-select v-model="query.scope" style="width: 150px" @change="search">
          <el-option label="参考来源范围" value="REFERENCE" />
          <el-option v-if="material.selectionMode !== 'EXAM_ONLY'" label="全部正常题库" value="ALL" />
        </el-select>
      </el-form-item>
      <el-button type="primary" icon="Search" @click="search">搜索</el-button>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb8" />
    <el-table v-loading="loading" :data="rows" row-key="id" empty-text="无符合条件的候选题">
      <el-table-column label="题目" min-width="250"><template #default="{ row }"><el-button link type="primary" @click="$emit('detail', row)">{{ row.title }}</el-button></template></el-table-column>
      <el-table-column label="状态" width="90"><template #default="{ row }">{{ label('status', row.status) }}</template></el-table-column>
      <el-table-column label="内容 / 题型" width="160"><template #default="{ row }">{{ label('contentKind', row.contentKind) }}<br>{{ label('questionType', row.questionType) }}</template></el-table-column>
      <el-table-column label="创作类型" width="110"><template #default="{ row }">{{ label('creationKind', row.creationKind) }}</template></el-table-column>
      <el-table-column label="考点" min-width="180"><template #default="{ row }"><relation-names type="kp" :ids="row.kpIds" /></template></el-table-column>
      <el-table-column label="操作" width="120"><template #default="{ row }"><el-button link type="primary" :disabled="selectedIds.has(String(row.id)) || saving" @click="$emit('add', row)">{{ selectedIds.has(String(row.id)) ? '已加入' : '加入专项' }}</el-button></template></el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="query.pageNum" v-model:limit="query.pageSize" @pagination="load" />
    <template #footer>
      <span class="selection-count">已选 {{ selected.length }} 题</span>
      <el-button type="primary" :loading="saving" @click="$emit('save')">保存所选题目</el-button>
      <el-button @click="open = false">返回专项</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getMaterialCandidates } from '@/api/knowledge/material'
import { createRequestGeneration } from '@/utils/request-generation'
import EnumSelect from './EnumSelect.vue'
import RelationNames from './RelationNames.vue'
import { label } from './labels'

const props = defineProps({ selected: { type: Array, default: () => [] }, saving: Boolean })
defineEmits(['add', 'save', 'detail'])
const open = ref(false), material = ref({}), rows = ref([]), total = ref(0), loading = ref(false), error = ref('')
const query = reactive({ pageNum: 1, pageSize: 10, title: '', query: '', contentKind: '', questionType: '', scope: 'REFERENCE' })
const selectedIds = computed(() => new Set(props.selected.map(row => String(row.id))))
const requests = createRequestGeneration()
watch(open, value => { if (!value) { requests.invalidate(); loading.value = false } })
onBeforeUnmount(requests.invalidate)

async function load() {
  const ticket = requests.start()
  const id = material.value.id
  loading.value = true
  error.value = ''
  try {
    const result = await getMaterialCandidates(id, { ...query, purpose: 'NORMAL' })
    if (!requests.current(ticket)) return
    rows.value = result.rows || []
    total.value = Number(result.total || 0)
    if (!rows.value.length && total.value && query.pageNum > 1) { query.pageNum--; await load() }
  } catch (failure) {
    if (requests.current(ticket)) { rows.value = []; total.value = 0; error.value = failure.message || '候选题加载失败，请重新搜索' }
  } finally {
    if (requests.current(ticket)) loading.value = false
  }
}
function search() { query.pageNum = 1; return load() }
function show(value) {
  material.value = { id: String(value.id), selectionMode: value.selectionMode }
  query.scope = value.selectionMode === 'EXAM_ONLY' ? 'REFERENCE' : 'ALL'
  rows.value = []; total.value = 0; open.value = true
  return search()
}
defineExpose({ show, reload: load, close: () => { open.value = false } })
</script>
<style scoped>
.selection-count { margin-right: 16px; color: #606266; }
</style>
