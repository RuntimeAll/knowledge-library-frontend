<template>
  <div class="app-container">
    <el-form v-show="showSearch" :inline="true" @submit.prevent="search">
      <el-form-item :label="`${resourceNames[type]}名称`">
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="请输入名称"
          @keyup.enter="search"
        />
      </el-form-item>
      <slot name="filters" :query="query" />
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">搜索</el-button>
        <el-button icon="Refresh" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <el-row :gutter="10" class="mb8 resource-toolbar">
      <el-col :span="1.5">
        <el-button
          v-hasPermi="[
            type === 'question'
              ? 'knowledge:import:execute'
              : `knowledge:${type}:add`
          ]"
          type="primary"
          plain
          icon="Plus"
          @click="$emit('add')"
        >
          新增{{ resourceNames[type] }}
        </el-button>
      </el-col>
      <slot name="toolbar" :selection="selection" :reload="load" />
      <right-toolbar v-model:showSearch="showSearch" @queryTable="load" />
    </el-row>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
      class="mb8"
    />
    <el-table
      v-loading="loading"
      :data="rows"
      row-key="id"
      @selection-change="selection = $event"
      empty-text="暂无记录，请新增或调整搜索条件"
    >
      <el-table-column type="selection" width="45" />
      <el-table-column label="编号" prop="id" width="95" />
      <el-table-column
        :label="`${resourceNames[type]}名称`"
        min-width="200"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <el-button link type="primary" @click="$emit('detail', row)">
            {{ row.title || row.name }}
          </el-button>
        </template>
      </el-table-column>
      <slot name="columns" />
      <el-table-column label="更新时间" prop="updateTime" width="170">
        <template #default="{ row }">
          {{ row.updateTime || row.createTime || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" :width="actionWidth" fixed="right">
        <template #default="{ row }">
          <el-button
            v-hasPermi="[`knowledge:${type}:query`]"
            link
            type="primary"
            @click="$emit('detail', row)"
          >
            详情
          </el-button>
          <el-button
            v-hasPermi="[`knowledge:${type}:edit`]"
            link
            type="primary"
            @click="$emit('edit', row)"
          >
            编辑
          </el-button>
          <slot name="actions" :row="row" />
          <el-button
            v-hasPermi="[`knowledge:${type}:remove`]"
            link
            type="danger"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="query.pageNum"
      v-model:limit="query.pageSize"
      @pagination="load"
    />
    <slot :reload="load" />
  </div>
</template>
<script setup>
import { listRecords, deleteRecord } from '@/api/knowledge'
import { resourceNames } from './labels'
import { ElMessage, ElMessageBox } from 'element-plus'
const props = defineProps({
  type: { type: String, required: true },
  defaultQuery: { type: Object, default: () => ({}) },
  initialQuery: { type: Object, default: () => ({}) },
  actionWidth: { type: Number, default: 260 }
})
defineEmits(['add', 'detail', 'edit'])
const rows = ref([]),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  showSearch = ref(true),
  selection = ref([])
const query = reactive({ pageNum: 1, pageSize: 10, keyword: '', ...(props.type === 'question' ? { expand:true } : {}), ...props.defaultQuery, ...props.initialQuery })
let generation = 0
async function load() {
  const ticket = ++generation
  loading.value = true
  error.value = ''
  try {
    // Route scope changes and KeepAlive activation may request a load in the
    // same render cycle. Only the latest query should reach the backend.
    await nextTick()
    if (ticket !== generation) return
    const result = await listRecords(props.type, {
      ...Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '')),
      keyword: undefined,
      title: props.type !== 'kp' ? query.keyword : undefined,
      name: props.type === 'kp' ? query.keyword : undefined
    })
    if (ticket !== generation) return
    rows.value = result.rows || []
    total.value = Number(result.total || 0)
    if (!rows.value.length && total.value && query.pageNum > 1) {
      query.pageNum--
      await load()
    }
  } catch (e) {
    if (ticket === generation)
      error.value = e.message || '列表加载失败，请点击刷新重试'
  } finally {
    if (ticket === generation) loading.value = false
  }
}
function search() {
  query.pageNum = 1
  load()
}
function reset() {
  Object.keys(query).forEach((key) => {
    if (!['pageNum', 'pageSize'].includes(key)) query[key] = undefined
  })
  query.keyword = ''
  if (props.type === 'question') query.expand = true
  Object.assign(query, props.defaultQuery)
  search()
}
async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除${resourceNames[props.type]}“${row.title || row.name}”？有关联记录时系统将拒绝删除。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await deleteRecord(props.type, row.id)
    ElMessage.success('删除成功')
    await load()
  } catch {
    /* request displays server explanation */
  }
}
onMounted(load)
// KeepAlive re-entry must refresh records changed on other pages or by imports.
let activatedOnce = false
onActivated(() => {
  if (activatedOnce) load()
  activatedOnce = true
})
function setFilters(filters) {
  if (Object.entries(filters).every(([key, value]) => query[key] === value)) return
  Object.assign(query, filters)
  search()
}
defineExpose({ reload: load, rows, query, setFilters })
</script>
<style scoped>
.resource-toolbar {
  row-gap: 8px;
  align-items: center;
}
</style>
