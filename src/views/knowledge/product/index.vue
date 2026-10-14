<template>
  <resource-list
    ref="listRef"
    type="product"
    :action-width="330"
    @add="edit()"
    @edit="edit"
    @detail="detail"
  >
    <template #columns>
      <el-table-column label="版本" width="100">
        <template #default="{ row }">第 {{ row.versionNo || 1 }} 版</template>
      </el-table-column>
      <el-table-column
        label="备注"
        prop="remark"
        min-width="180"
        show-overflow-tooltip
      />
    </template>
    <template #actions="{ row }">
      <el-button
        v-hasPermi="['knowledge:product:add']"
        link
        type="primary"
        @click="newVersion(row)"
      >
        另存新版本
      </el-button>
      <el-button
        v-hasPermi="['knowledge:product:query']"
        link
        type="primary"
        @click="showVersions(row)"
      >
        历史版本
      </el-button>
    </template>
  </resource-list>
  <el-dialog
    v-model="open"
    :title="dialogTitle"
    width="820px"
    append-to-body
    destroy-on-close
  >
    <el-alert
      title="成品是独立冻结文件。修改备注不改变原件；重新排版后请上传并另存新版本。"
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-form
      ref="formRef"
      :model="form"
      label-width="100px"
      :disabled="readonly || saving"
      :rules="rules"
    >
      <el-form-item label="成品名称" prop="title">
        <el-input v-model="form.title" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item label="关联专项">
        <record-picker
          v-model="materialIds"
          type="material"
          :multiple="false"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <el-divider content-position="left">
      {{ form.id ? '冻结原件' : '上传本版本原件' }}
    </el-divider>
    <asset-files
      v-model="assetIds"
      purpose="PRODUCT_ORIGINAL"
      :single="true"
      :editable="!readonly"
      :frozen="!!form.id"
    />
    <div v-if="form.previousProductId" class="version-note">
      上一版本编号：{{ form.previousProductId }}
      <el-button link type="primary" @click="showPrevious">
        查看上一版本原件
      </el-button>
    </div>
    <template #footer>
      <el-button
        v-if="!readonly"
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </el-button>
      <el-button
        v-if="readonly"
        v-hasPermi="['knowledge:product:add']"
        type="primary"
        @click="newVersion(form)"
      >
        另存新版本
      </el-button>
      <el-button @click="open = false">关闭</el-button>
    </template>
  </el-dialog>
  <el-dialog
    v-model="previousOpen"
    title="历史版本原件"
    width="750px"
    append-to-body
  >
    <p>{{ previous.title }} · 第 {{ previous.versionNo || 1 }} 版</p>
    <asset-files :model-value="previous.assetId ? [previous.assetId] : []" />
    <el-button
      v-if="previous.previousProductId"
      link
      type="primary"
      @click="loadPrevious(previous.previousProductId)"
    >
      继续查看更早版本
    </el-button>
  </el-dialog>
  <el-dialog
    v-model="versionsOpen"
    title="成品历史版本"
    width="850px"
    append-to-body
  >
    <el-table :data="versions">
      <el-table-column label="版本" width="90">
        <template #default="{ row }">第 {{ row.versionNo }} 版</template>
      </el-table-column>
      <el-table-column label="成品名称" prop="title" min-width="200" />
      <el-table-column label="创建时间" prop="createTime" width="170" />
      <el-table-column label="操作" width="110">
        <template #default="{ row }">
          <el-button link type="primary" @click="loadPrevious(row.id)">
            查看原件
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>
<script setup name="KnowledgeProduct">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import AssetFiles from '../components/AssetFiles.vue'
import { getRecord, saveRecord, knowledgeRequest } from '@/api/knowledge'
import { ElMessage } from 'element-plus'
const listRef = ref(),
  formRef = ref(),
  open = ref(false),
  readonly = ref(false),
  saving = ref(false),
  form = ref({}),
  assetIds = ref([]),
  materialIds = ref([]),
  previous = ref({}),
  previousOpen = ref(false)
const rules = {
  title: [{ required: true, message: '请填写成品名称', trigger: 'blur' }]
}
const versions = ref([]),
  versionsOpen = ref(false)
const dialogTitle = computed(() =>
  readonly.value
    ? '成品详情'
    : form.value.id
      ? '编辑成品元数据'
      : form.value.previousProductId
        ? '另存成品新版本'
        : '新增成品'
)
async function edit(row, view = false) {
  readonly.value = view
  form.value = row?.id
    ? (await getRecord('product', row.id)).data
    : { title: '' }
  assetIds.value = form.value.assetId ? [form.value.assetId] : []
  materialIds.value = form.value.materialId ? [form.value.materialId] : []
  open.value = true
}
function detail(row) {
  return edit(row, true)
}
async function newVersion(row) {
  const original = (await getRecord('product', row.id)).data
  readonly.value = false
  form.value = {
    title: original.title,
    materialId: original.materialId,
    previousProductId: original.id,
    remark: ''
  }
  materialIds.value = original.materialId ? [original.materialId] : []
  assetIds.value = []
  open.value = true
}
async function save() {
  if (!(await formRef.value.validate().catch(() => false))) return
  if (!assetIds.value.length) return ElMessage.warning('请先上传成品原件')
  saving.value = true
  try {
    await saveRecord('product', {
      ...form.value,
      assetId: assetIds.value[0],
      materialId: materialIds.value[0] || null
    })
    ElMessage.success('成品保存成功')
    open.value = false
    listRef.value.reload()
  } finally {
    saving.value = false
  }
}
async function loadPrevious(id) {
  previous.value = (await getRecord('product', id)).data
  previousOpen.value = true
}
function showPrevious() {
  return loadPrevious(form.value.previousProductId)
}
async function showVersions(row) {
  versions.value =
    (await knowledgeRequest(`/product/${row.id}/versions`)).data || []
  versionsOpen.value = true
}
</script>
<style scoped>
.version-note {
  margin-top: 16px;
  color: #606266;
}
</style>
