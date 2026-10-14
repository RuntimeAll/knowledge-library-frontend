<template>
  <resource-list
    ref="listRef"
    type="outline"
    :action-width="300"
    @add="edit()"
    @edit="edit"
    @detail="detail"
  >
    <template #columns>
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
    <el-alert
      title="目录用于组织考点，不复制考点定义。每个节点可关联多个公共考点。"
      type="info"
      :closable="false"
      class="tree-tip"
    />
    <el-table
      v-loading="treeLoading"
      :data="tree"
      row-key="id"
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
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
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
        <record-picker v-model="node.kpIds" type="kp" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="saving" @click="saveNode">
        保存节点
      </el-button>
      <el-button @click="nodeOpen = false">取消</el-button>
    </template>
  </el-dialog>
</template>
<script setup name="KnowledgeOutline">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import RelationNames from '../components/RelationNames.vue'
import { getRecord, saveRecord, knowledgeRequest } from '@/api/knowledge'
import { ElMessage, ElMessageBox } from 'element-plus'
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
const rules = {
  title: [{ required: true, message: '请填写名称', trigger: 'blur' }]
}
async function edit(row, view = false) {
  readonly.value = view
  form.value = row?.id
    ? (await getRecord('outline', row.id)).data
    : { title: '' }
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
    ElMessage.success('大纲保存成功')
    open.value = false
    listRef.value.reload()
  } finally {
    saving.value = false
  }
}
async function manage(row) {
  outline.value = { id: row.id, title: row.title }
  treeOpen.value = true
  await loadTree()
}
async function loadTree() {
  treeLoading.value = true
  try {
    outline.value = (await getRecord('outline', outline.value.id)).data
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
