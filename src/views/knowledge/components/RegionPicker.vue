<template>
  <div class="region-picker">
    <el-button :disabled="disabled" plain @click="show">{{ selectedName || (modelValue ? '已选择区域' : '选择区域') }}</el-button>
    <el-button v-if="modelValue && !disabled" link @click="clear">清除</el-button>
    <el-dialog v-model="open" title="选择区域" width="650px" append-to-body destroy-on-close>
      <el-form inline @submit.prevent="search">
        <el-form-item label="名称 / 全称 / 代码"><el-input v-model="keyword" clearable @keyup.enter="search" /></el-form-item>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="root">全国目录</el-button>
        <el-button v-if="trail.length" @click="back">返回上级</el-button>
      </el-form>
      <p v-if="trail.length">当前范围：{{ trail.map(row => row.name).join(' / ') }}</p>
      <el-table v-loading="loading" :data="rows" empty-text="没有匹配区域">
        <el-table-column label="区域" min-width="260"><template #default="{ row }">{{ row.fullName || row.name }}</template></el-table-column>
        <el-table-column label="代码" prop="regionCode" width="105" />
        <el-table-column label="操作" width="190"><template #default="{ row }">
          <el-button v-if="row.hasChildren" link @click="descend(row)">下级区域</el-button>
          <el-button link type="primary" :disabled="row.status && row.status !== '0' && row.status !== 'ACTIVE'" @click="choose(row)">选择</el-button>
        </template></el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="pageNum" v-model:limit="pageSize" @pagination="load" />
    </el-dialog>
  </div>
</template>
<script setup>
import { knowledgeRequest } from '@/api/knowledge'
const props = defineProps({ modelValue: String, name: String, fullName: String, disabled: Boolean })
const emit = defineEmits(['update:modelValue', 'change'])
const open = ref(false), loading = ref(false), rows = ref([]), total = ref(0), pageNum = ref(1), pageSize = ref(10), keyword = ref(''), trail = ref([]), chosenName = ref('')
const selectedName = computed(() => chosenName.value || props.fullName || props.name)
let generation = 0
let labelGeneration = 0
watch(() => props.modelValue, async value => {
  const ticket = ++labelGeneration
  chosenName.value = ''
  if (!value) return
  try { const response = await knowledgeRequest(`/region/${encodeURIComponent(value)}`); if (ticket === labelGeneration) chosenName.value = response.data?.fullName || response.data?.name || '' } catch { /* The request layer reports failure; do not invent a label. */ }
}, { immediate:true })
async function load() {
  const ticket = ++generation
  loading.value = true
  try {
    const result = await knowledgeRequest('/region/list', 'get', undefined, { pageNum: pageNum.value, pageSize: pageSize.value, parentCode: keyword.value ? undefined : trail.value.at(-1)?.regionCode, keyword: keyword.value || undefined })
    if (ticket === generation) { rows.value = result.rows || []; total.value = Number(result.total || 0) }
  } finally { if (ticket === generation) loading.value = false }
}
function show() { open.value = true; search() }
function search() { pageNum.value = 1; load() }
function root() { keyword.value = ''; trail.value = []; search() }
function descend(row) { keyword.value = ''; trail.value.push(row); search() }
function back() { keyword.value = ''; trail.value.pop(); search() }
function choose(row) { emit('update:modelValue', row.regionCode); emit('change', row); nextTick(() => { chosenName.value = row.fullName || row.name }); open.value = false }
function clear() { chosenName.value = ''; emit('update:modelValue', undefined); emit('change', null) }
</script>
<style scoped>.region-picker { display: inline-flex; gap: 6px; align-items: center; }</style>
