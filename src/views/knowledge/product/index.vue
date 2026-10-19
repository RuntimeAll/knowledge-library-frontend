<template>
  <div class="knowledge-page">
    <resource-list
      ref="listRef"
      type="product"
      :default-query="{ historyMode: 'LATEST' }"
      :action-width="420"
      @add="edit()"
      @edit="edit"
      @detail="detail"
    >
      <template #filters="{ query }"><catalog-filters :query="query" kind="product" /></template>
      <template #columns>
        <catalog-columns kind="product" />
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
        <el-button v-if="row.renderJobId" v-hasPermi="['knowledge:render:query']" link type="primary" @click="renderJobRef.show(row.renderJobId)">生成依据</el-button>
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
      width="1000px"
      append-to-body
      destroy-on-close
    >
      <el-alert
        title="成品是独立冻结文件。修改元数据不改变原件；可上传新版本，也可复用模板重新生成。"
        type="info"
        :closable="false"
        class="mb8"
      />
      <el-alert v-if="form.renderJobId" type="success" :closable="false" class="mb8">
        <template #title>由经验模板生成 · 任务 {{ form.renderJobId }} · {{ label('audienceRole', form.renderOutputKey) }}</template>
        <el-button v-hasPermi="['knowledge:render:query']" link type="primary" @click="renderJobRef.show(form.renderJobId)">查看模板版本、冻结题单与来源 / 复制配置重新生成</el-button>
      </el-alert>
      <el-form
        ref="formRef"
        :model="form"
        label-width="100px"
        :disabled="readonly || saving"
        :rules="rules"
      >
        <el-form-item label="成品名称" prop="title">
          <el-input v-model="form.title" maxlength="300" show-word-limit />
        </el-form-item>
        <catalog-form :model="form" kind="product" :readonly="readonly" />
        <el-form-item label="关联专项">
          <relation-names v-if="form.id || readonly" type="material" :ids="materialIds" />
          <record-picker
            v-else
            v-model="materialIds"
            type="material"
            :multiple="false"
            @change="loadMaterialContents"
          />
          <el-button v-if="!form.id && !readonly && materialIds.length" link type="primary" :loading="materialLoading" @click="loadMaterialContents()">读取当前专项题单与参考来源</el-button>
        </el-form-item>
        <product-contents :model="form" :readonly="readonly || !!form.id" @busy="contentsLoading = $event" />
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
        :editable="!readonly && !saving"
        :frozen="!!form.id"
        @busy="uploading = $event"
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
          :disabled="uploading || contentsLoading || materialLoading"
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
      <el-descriptions :column="2" border class="mb8"><el-descriptions-item label="资料类型">{{ label('resourceType', previous.profile?.resourceType) }}</el-descriptions-item><el-descriptions-item label="使用角色">{{ label('audienceRole', previous.profile?.audienceRole) }}</el-descriptions-item></el-descriptions>
      <outline-scopes :model-value="previous.outlineScopes || []" readonly />
      <asset-files :model-value="previous.assetId ? [previous.assetId] : []" />
      <product-contents :model="previous" readonly />
      <el-button v-if="previous.renderJobId" v-hasPermi="['knowledge:render:query']" link type="primary" @click="renderJobRef.show(previous.renderJobId)">查看本版本生成依据</el-button>
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
      <el-table v-loading="versionsLoading" :data="versions">
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
      <pagination v-show="versionsTotal > 0" :total="versionsTotal" v-model:page="versionQuery.pageNum" v-model:limit="versionQuery.pageSize" @pagination="loadVersions" />
    </el-dialog>
    <render-job-detail ref="renderJobRef" @copy="copyRenderConfig" />
    <generate-dialog ref="generateRef" @created="listRef.reload()" />
  </div>
</template>
<script setup name="KnowledgeProduct">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import AssetFiles from '../components/AssetFiles.vue'
import CatalogForm from '../components/CatalogForm.vue'
import CatalogFilters from '../components/CatalogFilters.vue'
import CatalogColumns from '../components/CatalogColumns.vue'
import ProductContents from '../components/ProductContents.vue'
import OutlineScopes from '../components/OutlineScopes.vue'
import RelationNames from '../components/RelationNames.vue'
import RenderJobDetail from '../components/RenderJobDetail.vue'
import GenerateDialog from '../components/GenerateDialog.vue'
import { label } from '../components/labels'
import { prepareCatalog, catalogPayload, pickFields } from '../components/catalog'
import { getRecord, saveRecord, listRecords } from '@/api/knowledge'
import { ElMessage } from 'element-plus'
const listRef = ref(),
  renderJobRef = ref(),
  generateRef = ref(),
  formRef = ref(),
  open = ref(false),
  readonly = ref(false),
  saving = ref(false),
  uploading = ref(false),
  contentsLoading = ref(false),
  materialLoading = ref(false),
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
const versionsLoading = ref(false), versionsTotal = ref(0), versionQuery = reactive({ pageNum:1, pageSize:10, rootProductId:undefined, historyMode:'ANY' })
const dialogTitle = computed(() =>
  readonly.value
    ? '成品详情'
    : form.value.id
      ? '编辑成品元数据'
      : form.value.previousProductId
        ? '另存成品新版本'
        : '新增成品'
)
function copyRenderConfig(job) { generateRef.value.show({ request: job.configSnapshot, previousOutputs: job.outputs }) }
async function edit(row, view = false) {
  readonly.value = view
  form.value = prepareCatalog(row?.id ? (await getRecord('product', row.id)).data : { title: '', questionRefs:[], referenceSources:[] }, 'product')
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
  form.value = prepareCatalog({
    title: original.title,
    materialId: original.materialId,
    previousProductId: original.id,
    profile: { ...original.profile, catalogStatus:'DRAFT', provenanceStatus:'UNKNOWN' },
    outlineScopes: original.outlineScopes,
    declaredKpIds: original.declaredKpIds,
    regions: original.regions,
    questionRefs: [],
    referenceSources: [],
    remark: ''
  }, 'product')
  materialIds.value = original.materialId ? [original.materialId] : []
  assetIds.value = []
  open.value = true
}
async function save() {
  if (uploading.value || contentsLoading.value || materialLoading.value || saving.value) return
  if (!(await formRef.value.validate().catch(() => false))) return
  if (!assetIds.value.length) return ElMessage.warning('请先上传成品原件')
  if (form.value.regions.some(region => !region.regionCode)) return ElMessage.warning('请补齐区域或移除空白区域行')
  saving.value = true
  try {
    const payload = {
      ...pickFields(form.value, ['id','rowVersion','title','remark','previousProductId']),
      ...catalogPayload(form.value, 'product'),
      assetId: assetIds.value[0],
      materialId: materialIds.value[0] || null
    }
    if (!form.value.id) {
      payload.questionRefs = (form.value.questionRefs || []).map(row => pickFields(row, ['seq','questionId','questionRowVersion','stemHash','itemLocator']))
      payload.referenceSources = (form.value.referenceSources || []).map(row => pickFields(row, ['sourceId','note']))
    }
    await saveRecord('product', payload)
    ElMessage.success('成品保存成功')
    open.value = false
    listRef.value.reload()
  } finally {
    saving.value = false
  }
}
let materialGeneration = 0
watch(() => form.value, () => { ++materialGeneration; materialLoading.value = false })
async function loadMaterialContents() {
  const ticket = ++materialGeneration
  const id = materialIds.value[0]
  if (!id) { materialLoading.value = false; return }
  materialLoading.value = true
  try {
    const material = (await getRecord('material', id)).data
    if (ticket !== materialGeneration) return
    form.value.questionRefs = (material.questions || []).map((question, index) => ({ seq:index + 1, questionId:question.id, questionTitle:question.title, questionRowVersion:question.rowVersion, stemHash:question.stemHash, itemLocator:'' }))
    form.value.referenceSources = (material.referenceSources || []).map(source => ({ sourceId:source.sourceId, note:source.note || '' }))
  } finally { if (ticket === materialGeneration) materialLoading.value = false }
}
async function loadPrevious(id) {
  previous.value = (await getRecord('product', id)).data
  previousOpen.value = true
}
function showPrevious() {
  return loadPrevious(form.value.previousProductId)
}
async function showVersions(row) {
  versionQuery.rootProductId = row.rootProductId || row.id
  versionQuery.pageNum = 1
  versionsOpen.value = true
  await loadVersions()
}
async function loadVersions() {
  versionsLoading.value = true
  try { const response = await listRecords('product', versionQuery); versions.value = response.rows || []; versionsTotal.value = Number(response.total || 0) }
  finally { versionsLoading.value = false }
}
</script>
<style scoped>
.version-note {
  margin-top: 16px;
  color: #606266;
}
</style>
