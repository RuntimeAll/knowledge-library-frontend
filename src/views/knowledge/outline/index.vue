<template>
  <div class="knowledge-page">
    <resource-list
      ref="listRef"
      type="outline"
      :default-query="{ catalogKind: 'TEXTBOOK' }"
      :action-width="300"
      @add="edit()"
      @edit="edit"
      @detail="detail"
    >
      <template #filters="{ query }">
        <el-form-item v-for="field in catalogFields" :key="field.key" :label="field.label">
          <enum-select v-model="query[field.key]" :field="field.dict || field.key" :clearable="field.key !== 'catalogKind'" style="width: 150px" />
        </el-form-item>
      </template>
      <template #columns>
        <el-table-column v-for="field in catalogFields" :key="field.key" :label="field.label" width="130">
          <template #default="{ row }">{{ label(field.dict || field.key, row[field.key]) }}</template>
        </el-table-column>
        <el-table-column label="修订年份 / ISBN" prop="edition" min-width="160" />
        <el-table-column
          label="说明"
          prop="description"
          min-width="300"
          show-overflow-tooltip
        />
      </template>
      <template #actions="{ row }">
        <el-button
          v-hasPermi="['knowledge:outline:query']"
          link
          type="primary"
          @click="manage(row)"
        >
          管理目录
        </el-button>
      </template>
    </resource-list>
    <el-dialog
      v-model="open"
      :title="`${readonly ? '查看' : form.id ? '编辑' : '新增'}大纲`"
      width="650px"
      append-to-body
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        label-width="90px"
        :disabled="readonly || saving"
        :rules="rules"
      >
        <el-form-item label="大纲名称" prop="title">
          <el-input v-model="form.title" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item v-for="field in catalogFields" :key="field.key" :label="field.label">
          <enum-select v-model="form[field.key]" :field="field.dict || field.key" :allow-create="field.key === 'textbookVersion'" />
        </el-form-item>
        <el-form-item label="修订 / ISBN">
          <el-input v-model="form.edition" maxlength="100" placeholder="以实际课本版权页为准，未知留空并保持待核对" />
        </el-form-item>
        <el-form-item label="核对依据">
          <el-input v-model="form.catalogSource" type="textarea" maxlength="1000" placeholder="教材目录页来源或文件编号；确认教材大纲前必须填写" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          v-if="!readonly"
          type="primary"
          :loading="saving"
          @click="save"
        >
          保存
        </el-button>
        <el-button @click="open = false">关闭</el-button>
      </template>
    </el-dialog>
    <el-drawer
      v-model="treeOpen"
      :title="`大纲目录 · ${outline.title || ''}`"
      size="85%"
      destroy-on-close
    >
      <el-button
        v-hasPermi="['knowledge:outline:edit']"
        type="primary"
        plain
        icon="Plus"
        @click="editNode()"
      >
        新增顶层节点
      </el-button>
      <el-button icon="Refresh" @click="loadTree">刷新</el-button>
      <el-button v-hasPermi="['knowledge:question:list']" @click="browseQuestions()">按此大纲查内容</el-button>
      <el-alert
        :title="outline.catalogKind === 'TEXTBOOK' ? '教材大纲保存学科、教材版本、年级与学期。考点独立复用，已挂载但未核对章节的考点列在下方；按实际教材目录补齐章节后再关联。' : '这是历史资料覆盖目录，不属于教材大纲。'"
        type="info"
        :closable="false"
        class="tree-tip"
      />
      <el-table
        v-loading="treeLoading"
        :data="tree"
        row-key="id"
        highlight-current-row
        :current-row-key="route.query.nodeId"
        default-expand-all
        :tree-props="{ children: 'children' }"
        empty-text="暂无目录节点，请新增顶层节点"
      >
        <el-table-column label="目录节点" prop="title" min-width="260" />
        <el-table-column label="顺序" prop="sortOrder" width="80" />
        <el-table-column label="关联考点" min-width="260">
          <template #default="{ row }">
            <relation-names type="kp" :ids="row.kpIds" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="290">
          <template #default="{ row }">
            <el-button v-hasPermi="['knowledge:question:list']" link type="primary" @click="browseQuestions(row)">查内容</el-button>
            <el-button
              v-hasPermi="['knowledge:outline:edit']"
              link
              type="primary"
              @click="editNode(undefined, row)"
            >
              加子节点
            </el-button>
            <el-button
              v-hasPermi="['knowledge:outline:edit']"
              link
              type="primary"
              @click="editNode(row)"
            >
              编辑
            </el-button>
            <el-button
              v-hasPermi="['knowledge:outline:edit']"
              link
              type="danger"
              @click="removeNode(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template v-if="outline.catalogKind === 'TEXTBOOK'">
        <el-divider content-position="left">本教材挂载考点</el-divider>
        <el-button v-hasPermi="['knowledge:kp:list']" plain class="mb8" @click="browseKps">在考点管理中查看</el-button>
        <el-table v-loading="kpLoading" :data="boundKps" empty-text="尚未挂载考点，请在考点管理中选择此教材大纲">
          <el-table-column label="考点" prop="name" min-width="160" />
          <el-table-column label="定义" prop="description" min-width="220" show-overflow-tooltip />
          <el-table-column label="教材章节位置" min-width="260">
            <template #default="{ row }"><outline-bindings :bindings="(row.outlineBindings || []).filter(binding => String(binding.outlineId) === String(outline.id))" /></template>
          </el-table-column>
        </el-table>
        <pagination v-show="kpTotal > 0" :total="kpTotal" v-model:page="kpQuery.pageNum" v-model:limit="kpQuery.pageSize" @pagination="loadKps" />
      </template>
    </el-drawer>
    <el-dialog
      v-model="nodeOpen"
      :title="node.id ? '编辑目录节点' : '新增目录节点'"
      width="700px"
      append-to-body
      destroy-on-close
    >
      <el-form
        ref="nodeRef"
        :model="node"
        label-width="100px"
        :rules="rules"
        :disabled="saving"
      >
        <el-form-item label="上级节点">
          <el-tree-select
            v-model="node.parentId"
            :data="parentOptions"
            :props="{ label: 'title', value: 'id', children: 'children' }"
            node-key="id"
            check-strictly
            clearable
            placeholder="不选则为顶层节点"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="节点名称" prop="title">
          <el-input v-model="node.title" maxlength="200" />
        </el-form-item>
        <el-form-item label="显示顺序">
          <el-input-number v-model="node.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="关联考点">
          <record-picker v-model="node.kpIds" type="kp" :filters="{ subject: outline.subject || undefined, outlineId: outline.catalogKind === 'TEXTBOOK' ? outline.id : undefined }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="saving" @click="saveNode">
          保存节点
        </el-button>
        <el-button @click="nodeOpen = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup name="KnowledgeOutline">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import RelationNames from '../components/RelationNames.vue'
import EnumSelect from '../components/EnumSelect.vue'
import OutlineBindings from '../components/OutlineBindings.vue'
import { label, loadOutlineOptions } from '../components/labels'
import { getRecord, saveRecord, knowledgeRequest, listRecords } from '@/api/knowledge'
import { ElMessage, ElMessageBox } from 'element-plus'
const catalogFields = [
  { key: 'catalogKind', label: '大纲类型' },
  { key: 'subject', label: '科目' },
  { key: 'textbookVersion', label: '教材版本' },
  { key: 'grade', label: '年级' },
  { key: 'term', label: '学期' },
  { key: 'status', dict: 'outlineStatus', label: '核对状态' }
]
const listRef = ref(),
  formRef = ref(),
  nodeRef = ref(),
  open = ref(false),
  readonly = ref(false),
  saving = ref(false),
  form = ref({}),
  treeOpen = ref(false),
  treeLoading = ref(false),
  outline = ref({}),
  nodeOpen = ref(false),
  node = ref({})
const route = useRoute(), router = useRouter()
const boundKps = ref([]), kpTotal = ref(0), kpLoading = ref(false)
const kpQuery = reactive({ pageNum: 1, pageSize: 10 })
function syncRoute() {
  if (route.path !== '/knowledge/outline') {
    treeOpen.value = false
    nodeOpen.value = false
    open.value = false
    return
  }
  if (/^\d+$/.test(String(route.query.outlineId || ''))) manage({ id: route.query.outlineId })
}
watch(() => [route.path, route.query.outlineId, route.query.nodeId], syncRoute)
onMounted(syncRoute)
function browseQuestions(node) {
  treeOpen.value = false
  router.push({ path: '/knowledge/question', query: { outlineId: outline.value.id, outlineNodeId: node?.id } })
}
function browseKps() {
  treeOpen.value = false
  router.push({ path: '/knowledge/kp', query: { outlineId: outline.value.id } })
}
async function loadKps() {
  if (outline.value.catalogKind !== 'TEXTBOOK') return
  kpLoading.value = true
  try {
    const result = await listRecords('kp', { ...kpQuery, outlineId: outline.value.id })
    boundKps.value = result.rows || []
    kpTotal.value = Number(result.total || 0)
  } finally { kpLoading.value = false }
}
const rules = {
  title: [{ required: true, message: '请填写名称', trigger: 'blur' }]
}
async function edit(row, view = false) {
  readonly.value = view
  form.value = row?.id
    ? (await getRecord('outline', row.id)).data
    : { title: '', catalogKind: 'TEXTBOOK', textbookVersion: 'ZHEJIAO', grade: 'G7', term: 'FIRST', status: 'DRAFT' }
  open.value = true
}
function detail(row) {
  return manage(row)
}
async function save() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    await saveRecord('outline', form.value)
    await loadOutlineOptions(true)
    ElMessage.success('大纲保存成功')
    open.value = false
    listRef.value.reload()
  } finally {
    saving.value = false
  }
}
async function manage(row) {
  outline.value = { id: row.id, title: row.title }
  kpQuery.pageNum = 1
  boundKps.value = []
  kpTotal.value = 0
  treeOpen.value = true
  await loadTree()
}
async function loadTree() {
  treeLoading.value = true
  try {
    outline.value = (await getRecord('outline', outline.value.id)).data
    await loadKps()
  } finally {
    treeLoading.value = false
  }
}
const tree = computed(() => {
  const rows = (outline.value.nodes || []).map((item) => ({
      ...item,
      children: []
    })),
    map = new Map(rows.map((item) => [String(item.id), item])),
    roots = []
  rows.forEach((item) => {
    const parent = map.get(String(item.parentId))
    if (parent && String(parent.id) !== String(item.id))
      parent.children.push(item)
    else roots.push(item)
  })
  const sort = (nodes) => {
    nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    nodes.forEach((item) => sort(item.children))
  }
  sort(roots)
  return roots
})
const parentOptions = computed(() => {
  const filter = (nodes) =>
    nodes
      .filter((item) => String(item.id) !== String(node.value.id))
      .map((item) => ({ ...item, children: filter(item.children) }))
  return filter(tree.value)
})
function editNode(row, parent) {
  node.value = row
    ? { ...row, children: undefined, kpIds: [...(row.kpIds || [])] }
    : {
        outlineId: outline.value.id,
        parentId: parent?.id || null,
        title: '',
        sortOrder: 0,
        kpIds: []
      }
  nodeOpen.value = true
}
async function saveNode() {
  if (!(await nodeRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    await knowledgeRequest('/outline/node', node.value.id ? 'put' : 'post', {
      ...node.value,
      outlineId: outline.value.id,
      parentId: node.value.parentId || null
    })
    ElMessage.success('目录节点保存成功')
    nodeOpen.value = false
    await loadTree()
  } finally {
    saving.value = false
  }
}
async function removeNode(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除节点“${row.title}”？存在子节点时需先处理子节点。`,
      '删除节点',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await knowledgeRequest(`/outline/node/${row.id}`, 'delete')
  ElMessage.success('节点删除成功')
  await loadTree()
}
</script>
<style scoped>
.tree-tip {
  margin: 16px 0;
}
</style>
