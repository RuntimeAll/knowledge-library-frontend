<template>
  <div class="knowledge-page">
    <resource-list ref="listRef" type="source" @add="edit()" @edit="edit" @detail="detail">
      <template #filters="{ query }">
        <catalog-filters :query="query" kind="source" />
        <el-form-item v-for="field in examFilters" :key="field.key" :label="field.title"><enum-select v-model="query[field.key]" :field="field.key" clearable style="width:150px" /></el-form-item>
      </template>
      <template #columns>
        <catalog-columns kind="source" />
        <el-table-column label="考试身份" min-width="160"><template #default="{ row }"><template v-if="row.sourceKind === 'EXAM'">{{ label('authenticityStatus', row.authenticityStatus) }}<div>{{ label('paperNature', row.examDetail?.paperNature) }}</div><div v-if="row.examYear">考试 {{ row.examYear }}</div></template><span v-else>非考试资料</span></template></el-table-column>
        <el-table-column label="抽题进度" min-width="120"><template #default="{ row }">{{ label('extractionStatus', row.extractionStatus) }}</template></el-table-column>
      </template>
    </resource-list>
    <el-dialog v-model="open" :title="`${readonly ? '查看' : form.id ? '编辑' : '新增'}来源`" width="1000px" append-to-body destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="115px" :disabled="readonly || saving">
        <el-form-item label="来源名称" prop="title"><el-input v-model="form.title" maxlength="300" show-word-limit /></el-form-item>
        <catalog-form :model="form" kind="source" :readonly="readonly" />
        <el-divider content-position="left">原件信息</el-divider>
        <el-form-item label="抽题进度"><enum-select v-model="form.extractionStatus" field="extractionStatus" /></el-form-item>
        <el-form-item label="原始链接"><el-input v-model="form.originUrl" placeholder="原始资料网址，可留空" /></el-form-item>
        <el-form-item label="来源说明"><el-input v-model="form.originNote" type="textarea" :rows="2" /></el-form-item>
        <template v-if="isExam">
          <el-divider content-position="left">原考试身份（与教材适用范围分开）</el-divider>
          <el-row :gutter="20">
            <el-col v-for="field in examFields" :key="field.key" :span="12"><el-form-item :label="field.title">
              <enum-select v-if="field.type === 'enum'" v-model="form.examDetail[field.key]" :field="field.key" clearable />
              <el-input-number v-else-if="field.type === 'year'" v-model="form.examDetail[field.key]" :min="1900" :max="2100" controls-position="right" />
              <el-input v-else v-model="form.examDetail[field.key]" maxlength="200" clearable />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="考试日期"><el-date-picker v-model="form.examDetail.examDate" type="date" value-format="YYYY-MM-DD" /></el-form-item></el-col>
          </el-row>
          <el-form-item label="原卷范围说明"><el-input v-model="form.examDetail.scopeNote" type="textarea" :rows="2" /></el-form-item>
        </template>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
      </el-form>
      <asset-files v-model="form.assetIds" purpose="SOURCE_ORIGINAL" :editable="!readonly && !saving" @busy="uploading = $event" />
      <template v-if="isExam && form.id">
        <el-divider content-position="left">考试来源真实性核实</el-divider>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="核实状态">{{ label('authenticityStatus', form.authenticityStatus) }}</el-descriptions-item>
          <el-descriptions-item label="审核人 / 时间">{{ form.examDetail.verifiedBy || '—' }} / {{ form.examDetail.verifiedAt || '—' }}</el-descriptions-item>
          <el-descriptions-item label="核实依据" :span="2">{{ form.examDetail.verificationNote || form.verificationNote || '尚未填写' }}</el-descriptions-item>
        </el-descriptions>
        <el-alert v-if="form.examDetail.legacyVerification" title="这份来源保留历史核实记录，需要按当前原卷身份和证据规则重新核对。" type="warning" :closable="false" class="mt12" />
        <el-button v-hasPermi="['knowledge:source:verify']" class="mt12" type="primary" plain :disabled="!readonly" @click="startVerification">核实原卷身份</el-button>
        <span v-if="!readonly" class="tip">请先保存资料，再从详情进行核实。</span>
      </template>
      <template v-if="readonly && form.id"><el-divider content-position="left">实际出处与错题收录</el-divider><occurrences :source-id="form.id" /></template>
      <template #footer><el-button v-if="!readonly" type="primary" :loading="saving" :disabled="uploading" @click="save">保存来源</el-button><el-button @click="open = false">{{ readonly ? '关闭' : '取消' }}</el-button></template>
    </el-dialog>
    <el-dialog v-model="verificationOpen" title="核实考试原卷身份" width="750px" append-to-body destroy-on-close>
      <el-alert title="实际校内考试也属于真题。依据原卷、作答或批改材料核实；未知年份可待补，修改考试身份事实后需要重新核实。" type="info" :closable="false" class="mb8" />
      <el-form label-width="110px" :disabled="verifying">
        <el-form-item label="核实结果"><enum-select v-model="verification.authenticityStatus" field="authenticityStatus" /></el-form-item>
        <el-form-item label="核实说明"><el-input v-model="verification.verificationNote" type="textarea" :rows="4" maxlength="20000" /></el-form-item>
      </el-form>
      <asset-files :model-value="form.assetIds || []" :selected-id="verification.evidenceAssetId" selectable :removable="false" @selected="verification.evidenceAssetId = $event" />
      <el-button v-if="verification.evidenceAssetId" link @click="verification.evidenceAssetId = null">取消证据选择</el-button>
      <template #footer><el-button type="primary" :loading="verifying" @click="verify">提交核实</el-button><el-button @click="verificationOpen = false">取消</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup name="KnowledgeSource">
import ResourceList from '../components/ResourceList.vue'
import EnumSelect from '../components/EnumSelect.vue'
import AssetFiles from '../components/AssetFiles.vue'
import Occurrences from '../components/Occurrences.vue'
import CatalogForm from '../components/CatalogForm.vue'
import CatalogFilters from '../components/CatalogFilters.vue'
import CatalogColumns from '../components/CatalogColumns.vue'
import { label } from '../components/labels'
import { prepareCatalog, catalogPayload, sourceKind, pickFields } from '../components/catalog'
import { getRecord, saveRecord, knowledgeRequest } from '@/api/knowledge'
import { ElMessage } from 'element-plus'
const listRef = ref(), formRef = ref(), open = ref(false), readonly = ref(false), saving = ref(false), uploading = ref(false), form = ref({})
const verificationOpen = ref(false), verifying = ref(false), verification = ref({})
const rules = { title: [{ required: true, message: '请填写来源名称', trigger: 'blur' }] }
const examFilters = [{key:'examPurpose',title:'考试用途'},{key:'organizerLevel',title:'组织层级'},{key:'paperNature',title:'原卷性质'},{key:'authenticityStatus',title:'核实状态'}]
const examFields = [
  {key:'examPurpose',title:'考试用途',type:'enum'},{key:'paperNature',title:'原卷性质',type:'enum'},
  {key:'grade',title:'原考试年级',type:'enum'},{key:'term',title:'原考试学期',type:'enum'},
  {key:'examYear',title:'考试年份',type:'year'},{key:'academicYearStart',title:'学年起始年',type:'year'},
  {key:'entranceStage',title:'升学阶段',type:'enum'},{key:'organizerLevel',title:'组织层级',type:'enum'},
  {key:'organizerName',title:'组织者'},{key:'schoolName',title:'原卷学校'},
  {key:'sessionLabel',title:'场次'},{key:'paperCode',title:'卷别'}
]
const isExam = computed(() => form.value.profile?.resourceType === 'EXAM_PAPER' || (form.value.profile?.resourceType === 'UNKNOWN' && form.value.sourceKind === 'EXAM'))
async function edit(row, view = false) {
  readonly.value = view
  form.value = prepareCatalog(row?.id ? (await getRecord('source', row.id)).data : { title:'', extractionStatus:'ORIGINAL_ONLY', assetIds:[] }, 'source')
  form.value.assetIds ||= []
  open.value = true
}
function detail(row) { return edit(row, true) }
async function save() {
  if (!(await formRef.value.validate().catch(() => false))) return
  if (form.value.regions.some(region => !region.regionCode)) return ElMessage.warning('请补齐区域或移除空白区域行')
  saving.value = true
  try {
    const payload = { ...pickFields(form.value, ['id','rowVersion','title','extractionStatus','originUrl','originNote','remark']), ...catalogPayload(form.value, 'source') }
    payload.sourceKind = form.value.profile.resourceType === 'UNKNOWN' ? form.value.sourceKind || 'OTHER' : sourceKind(form.value.profile.resourceType)
    if (isExam.value && !payload.examDetail) payload.examDetail = catalogPayload({ ...form.value, profile:{ ...form.value.profile, resourceType:'EXAM_PAPER' } }, 'source').examDetail
    payload.attachments = form.value.assetIds.flatMap(assetId => {
      const existing = (form.value.attachments || []).filter(item => String(item.assetId) === String(assetId))
      return existing.length ? existing : [{ assetId, role:'ORIGINAL' }]
    }).map(item => ({ assetId:item.assetId, role:item.role }))
    await saveRecord('source', payload)
    ElMessage.success('来源及描述已保存')
    open.value = false
    listRef.value.reload()
  } finally { saving.value = false }
}
function startVerification() {
  verification.value = { rowVersion:form.value.rowVersion, authenticityStatus:form.value.authenticityStatus || 'UNVERIFIED', verificationNote:form.value.examDetail.verificationNote || form.value.verificationNote || '', evidenceAssetId:form.value.examDetail.evidenceAssetId || null }
  verificationOpen.value = true
}
async function verify() {
  verifying.value = true
  try {
    await knowledgeRequest(`/source/${form.value.id}/exam-verification`, 'put', verification.value)
    form.value = prepareCatalog((await getRecord('source', form.value.id)).data, 'source')
    verificationOpen.value = false
    ElMessage.success('核实结果已保存')
    listRef.value.reload()
  } finally { verifying.value = false }
}
</script>
<style scoped>.mt12 { margin-top:12px; }.tip {font-size:12px;color:#909399;margin-left:12px;}</style>
