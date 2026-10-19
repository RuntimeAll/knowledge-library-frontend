<template>
  <div class="record-picker">
    <div class="picked-items">
      <el-tag
        v-for="item in selected"
        :key="String(item.id)"
        :closable="!isDisabled"
        @close="remove(item.id)"
      >
        {{ item.title || item.name || `编号 ${item.id}` }}
      </el-tag>
      <el-button
        size="small"
        plain
        type="primary"
        icon="Plus"
        :disabled="isDisabled"
        @click="openPicker"
      >
        {{ multiple ? '选择' : '更换' }}{{ resourceNames[type] }}
      </el-button>
      <span v-if="!selected.length" class="empty-hint">尚未选择</span>
    </div>
    <el-dialog
      v-model="open"
      :title="`选择${resourceNames[type]}`"
      width="850px"
      append-to-body
    >
      <el-form inline @submit.prevent="search">
        <el-form-item label="关键词">
          <el-input
            v-model="keyword"
            clearable
            placeholder="按名称搜索"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="search">
            搜索
          </el-button>
        </el-form-item>
      </el-form>
      <el-table
        v-loading="loading"
        :data="rows"
        row-key="id"
        empty-text="没有匹配记录，请调整搜索条件"
      >
        <el-table-column label="编号" prop="id" width="100" />
        <el-table-column label="名称" min-width="250">
          <template #default="{ row }">{{ row.title || row.name }}</template>
        </el-table-column>
        <el-table-column v-if="type === 'source'" label="来源类型" width="110">
          <template #default="{ row }">
            {{ label('sourceKind', row.sourceKind) }}
          </template>
        </el-table-column>
        <el-table-column v-if="['question', 'kp', 'outline'].includes(type)" label="学科" width="90">
          <template #default="{ row }">{{ label('subject', row.subject) }}</template>
        </el-table-column>
        <el-table-column v-if="type === 'question'" label="内容 / 题型" width="160">
          <template #default="{ row }">{{ label('contentKind', row.contentKind) }}<br>{{ label('questionType', row.questionType) }}</template>
        </el-table-column>
        <el-table-column v-if="type === 'kp'" label="层级 / 顶级考点" width="160">
          <template #default="{ row }">{{ Number(row.depth) === 1 ? '顶级' : Number(row.depth) > 1 ? `第 ${row.depth} 级` : '待计算' }}<br>{{ row.rootName || '—' }}</template>
        </el-table-column>
        <el-table-column v-if="type === 'outline'" label="教材 / 年级 / 学期" width="200">
          <template #default="{ row }">{{ [label('textbookVersion', row.textbookVersion), label('grade', row.grade), label('term', row.term)].join(' · ') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="
                selected.some((item) => String(item.id) === String(row.id))
              "
              @click="choose(row)"
            >
              选择
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination
        v-show="total > 0"
        :total="total"
        v-model:page="pageNum"
        v-model:limit="pageSize"
        @pagination="load"
      />
      <template #footer>
        <el-button @click="open = false">完成选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { listRecords, getRecord } from '@/api/knowledge'
import { resourceNames, label } from './labels'
import { formContextKey } from 'element-plus'
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  type: { type: String, required: true },
  multiple: { type: Boolean, default: true },
  excludeIds: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) },
  disabled: Boolean
})
const parentForm = inject(formContextKey, undefined)
const isDisabled = computed(() => props.disabled || parentForm?.disabled)
const emit = defineEmits(['update:modelValue', 'change'])
const selected = ref([]),
  open = ref(false),
  loading = ref(false),
  rows = ref([]),
  total = ref(0),
  keyword = ref(''),
  pageNum = ref(1),
  pageSize = ref(10)
let generation = 0
watch(
  () => props.modelValue,
  async (ids) => {
    const ticket = ++generation
    const items = await Promise.all(
      (ids || []).map(
        async (id) =>
          selected.value.find((item) => String(item.id) === String(id)) ||
          (await getRecord(props.type, id)
            .then((r) => r.data)
            .catch(() => ({ id, title: `编号 ${id}（无法读取）` })))
      )
    )
    if (ticket === generation) selected.value = items.filter(Boolean)
  },
  { immediate: true, deep: true }
)
async function load() {
  loading.value = true
  try {
    const result = await listRecords(props.type, {
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      title: props.type === 'kp' ? undefined : keyword.value,
      name: props.type === 'kp' ? keyword.value : undefined,
      ...props.filters
    })
    rows.value = (result.rows || []).filter(
      (row) => !props.excludeIds.some((id) => String(id) === String(row.id))
    )
    total.value = Number(result.total || 0)
  } finally {
    loading.value = false
  }
}
function search() {
  pageNum.value = 1
  load()
}
function openPicker() {
  open.value = true
  search()
}
function publish() {
  emit(
    'update:modelValue',
    selected.value.map((item) => item.id)
  )
  emit('change', selected.value)
}
function choose(row) {
  if (isDisabled.value) return
  selected.value = props.multiple ? [...selected.value, row] : [row]
  publish()
  if (!props.multiple) open.value = false
}
function remove(id) {
  if (isDisabled.value) return
  selected.value = selected.value.filter(
    (item) => String(item.id) !== String(id)
  )
  publish()
}
</script>
<style scoped>
.picked-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}
.empty-hint {
  color: #909399;
  font-size: 13px;
}
</style>
