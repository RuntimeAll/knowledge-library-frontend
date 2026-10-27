<template>
  <el-dialog v-model="open" title="选择模板生成成品" width="1100px" append-to-body destroy-on-close :close-on-click-modal="!busy">
    <el-alert title="填写配置并按顺序选题。提交时冻结题目、模板与图片，生成过程不调用模型；修改内容需使用新的提交编号。" type="info" :closable="false" class="mb8" />
    <el-tabs v-model="tab" @tab-change="changeTab">
      <el-tab-pane label="配置与选题" name="form">
        <el-form label-width="115px" :disabled="busy || submitted || validating">
          <el-form-item label="已发布模板" required>
            <el-select v-model="form.templateVersionId" filterable style="width:100%" :loading="templateLoading" @change="loadTemplate(true)">
              <el-option v-for="item in templates" :key="item.id" :value="String(item.id)" :label="`${item.name} · 第 ${item.versionNo} 版`" />
            </el-select>
          </el-form-item>
          <template-fields v-if="version" v-model="form.parameters" :fields="version.fieldSchema || []" />
          <el-form-item label="资料类型" required><enum-select v-model="form.resourceType" field="resourceType" :exclude-values="['UNKNOWN']" /></el-form-item>
          <el-form-item label="教材范围" required><outline-scopes v-model="form.outlineScopes" /></el-form-item>
          <el-form-item label="成品角色" required>
            <el-checkbox-group v-model="form.outputRoles"><el-checkbox v-for="role in roles" :key="role" :value="role">{{ label('audienceRole', role) }}</el-checkbox></el-checkbox-group>
          </el-form-item>
          <el-form-item v-if="previousCandidates.length || form.previousOutputs?.length" label="成品修订">
            <div class="revision-options">
              <el-checkbox :model-value="revisionEnabled" :disabled="revisionLoading" @change="configureRevisions">作为对应成品的新修订</el-checkbox>
              <div class="form-note">默认另存为新成品。启用后仅延续相同使用角色的版本链，学生版与答案版分别保存。</div>
              <template v-if="revisionEnabled">
                <el-checkbox-group v-model="revisionRoles"><el-checkbox v-for="item in previousCandidates.filter(p => form.outputRoles.includes(p.outputKey))" :key="item.outputKey" :value="item.outputKey">{{ label('audienceRole', item.outputKey) }}</el-checkbox></el-checkbox-group>
                <el-table :data="form.previousOutputs || []" size="small" v-loading="revisionLoading">
                  <el-table-column label="角色" width="125"><template #default="{ row }">{{ label('audienceRole', row.outputKey) }}</template></el-table-column>
                  <el-table-column label="前版成品" min-width="260"><template #default="{ row }">{{ previousNames[row.productId] || `成品 ${row.productId}` }}</template></el-table-column>
                  <el-table-column label="并发版本" prop="rowVersion" width="100" />
                </el-table>
              </template>
            </div>
          </el-form-item>
          <el-form-item label="题单来源"><el-radio-group v-model="selectionMode"><el-radio value="QUESTIONS">按栏目明确选题</el-radio><el-radio value="MATERIAL">已有专项题单</el-radio></el-radio-group></el-form-item>
          <template v-if="selectionMode === 'MATERIAL'">
            <el-form-item label="专项" required><record-picker v-model="materialIds" type="material" :multiple="false" @change="selectMaterial" /></el-form-item>
            <el-alert v-if="material" :title="`${material.title} · ${material.questionIds?.length || material.questions?.length || 0} 个内容单位，按保存的顺序生成`" :closable="false" />
          </template>
          <template v-else>
            <el-divider content-position="left">栏目与题目顺序</el-divider>
            <el-card v-for="(section, index) in form.sections" :key="section.key" shadow="never" class="section-card">
              <template #header><div class="section-header"><span>栏目 {{ index + 1 }}</span><el-button type="danger" link :disabled="form.sections.length === 1" @click="form.sections.splice(index, 1)">移除栏目</el-button></div></template>
              <el-row :gutter="12"><el-col :span="12"><el-form-item label="栏目标题"><el-input v-model="section.title" maxlength="200" /></el-form-item></el-col><el-col :span="12"><el-form-item label="每日标识"><el-input v-model="section.dayKey" placeholder="每日打卡可填写，如 day-01" maxlength="64" /></el-form-item></el-col></el-row>
              <record-picker :model-value="section.questionRefs.map(q => q.questionId)" type="question" :filters="{ purpose: 'NORMAL' }" @change="rows => setQuestions(section, rows)" />
              <el-table :data="section.questionRefs" size="small" empty-text="请按本栏目顺序选择题目">
                <el-table-column label="序号" type="index" width="65" />
                <el-table-column label="题目" min-width="260"><template #default="{ row }">{{ questionNames[row.questionId] || `题目 ${row.questionId}` }}</template></el-table-column>
                <el-table-column label="版本" prop="rowVersion" width="85" />
                <el-table-column label="操作" width="170"><template #default="{ $index }"><el-button link :disabled="$index === 0" @click="moveQuestion(section, $index, -1)">上移</el-button><el-button link :disabled="$index === section.questionRefs.length - 1" @click="moveQuestion(section, $index, 1)">下移</el-button><el-button type="danger" link @click="section.questionRefs.splice($index, 1)">移除</el-button></template></el-table-column>
              </el-table>
            </el-card>
            <el-button icon="Plus" plain @click="addSection">添加栏目 / 一天</el-button>
            <el-button :loading="refreshing" @click="refreshQuestions">读取当前题目版本</el-button>
            <span class="form-note">共 {{ questionCount }} 个内容位置，最多 500 个；同题可在不同栏目重复使用。</span>
          </template>
          <el-form-item label="提交编号" class="submission-key"><el-input v-model="form.idempotencyKey" maxlength="128" /><div class="form-note">网络中断时保留此编号重试，避免重复生成。</div></el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="Agent JSON" name="json">
        <el-alert title="JSON 与表单使用相同协议。编辑完成后点击“应用 JSON”，再预检或提交。" type="info" :closable="false" class="mb8" />
        <el-input v-model="jsonText" type="textarea" :rows="24" class="code-input" :disabled="busy || submitted" />
        <el-button class="mt8" :disabled="busy || submitted" @click="applyJson">应用 JSON</el-button>
      </el-tab-pane>
    </el-tabs>
    <el-alert v-if="validationMessage" :title="validationMessage" :type="validationOk ? 'success' : 'warning'" :closable="false" class="mt8" />
    <el-alert v-for="(warning, index) in validationWarnings" :key="index" :title="warning" type="warning" :closable="false" class="mt8" />
    <el-alert v-if="submitted" title="本次请求已冻结。若提交响应中断，请点击提交重试；修改配置请关闭后重新发起生成。" type="warning" :closable="false" class="mt8" />
    <template #footer><el-button :loading="validating" :disabled="busy || submitted" @click="validate">预检配置与题单</el-button><el-button v-hasPermi="['knowledge:render:add']" type="primary" :loading="busy" @click="submit">{{ submitted ? '按原提交编号重试' : '提交生成' }}</el-button><el-button :disabled="busy" @click="open = false">关闭</el-button></template>
  </el-dialog>
  <render-job-detail ref="jobRef" @copy="copyJob" />
</template>
<script setup>
import { ElMessage } from 'element-plus'
import { getRecord } from '@/api/knowledge'
import { getQuestionsByIds } from '@/api/knowledge/question'
import { getTemplateOptions, getExperienceVersion, validateRender, createRenderJob } from '@/api/knowledge/experience'
import useUserStore from '@/store/modules/user'
import TemplateFields from './TemplateFields.vue'
import EnumSelect from './EnumSelect.vue'
import OutlineScopes from './OutlineScopes.vue'
import RecordPicker from './RecordPicker.vue'
import RenderJobDetail from './RenderJobDetail.vue'
import { label } from './labels'
const emit = defineEmits(['created'])
const roles = ['STUDENT', 'INLINE_ANSWER', 'ANSWER_ONLY']
const open = ref(false), busy = ref(false), validating = ref(false), refreshing = ref(false), templateLoading = ref(false), submitted = ref(false)
const templates = ref([]), version = ref(null), form = ref({}), tab = ref('form'), jsonText = ref(''), jobRef = ref(), material = ref(null), materialIds = ref([]), selectionMode = ref('QUESTIONS')
const validationMessage = ref(''), validationOk = ref(false), questionNames = reactive({})
const validationWarnings = ref([])
const revisionEnabled = ref(false), revisionLoading = ref(false), previousCandidates = ref([]), revisionRoles = ref([]), previousNames = reactive({})
let previousSnapshots = []
watch([revisionRoles, () => form.value.outputRoles], () => {
  if (revisionEnabled.value) form.value.previousOutputs = previousSnapshots.filter(item => revisionRoles.value.includes(item.outputKey) && (form.value.outputRoles || []).includes(item.outputKey)).map(item => ({ ...item }))
}, { deep: true })
watch(form, () => { validationMessage.value = ''; validationWarnings.value = [] }, { deep: true })
let submittedRequest = null, generation = 0, sectionNumber = 0
const questionCount = computed(() => (form.value.sections || []).reduce((sum, item) => sum + item.questionRefs.length, 0))
const newKey = () => `ui-layout:${Date.now()}:${crypto.randomUUID()}`
const pendingKey = () => `kb-layout-pending:${useUserStore().id || useUserStore().name}`
function readPending() { try { return JSON.parse(sessionStorage.getItem(pendingKey()) || 'null') } catch { return null } }
function newSection() { return { key: `section-${++sectionNumber}`, title: `栏目 ${sectionNumber}`, dayKey: '', questionRefs: [] } }
function normalize(input) { return { ...input, resourceType: input.resourceType || 'WORKSHEET', templateVersionId: input.templateVersionId ? String(input.templateVersionId) : undefined, parameters: input.parameters || {}, outlineScopes: input.outlineScopes || [], sections: (input.sections || []).map(s => ({ ...s, questionRefs: s.questionRefs || [] })), outputRoles: input.outputRoles || ['STUDENT'] } }
async function show(options = {}) {
  const pending = readPending()
  if (pending) options = { request: pending }
  ++generation; submitted.value = !!pending; submittedRequest = pending; validationMessage.value = ''; tab.value = 'form'; sectionNumber = 0; version.value = null
  form.value = normalize({ idempotencyKey: newKey(), sections: [newSection()], outputRoles: ['STUDENT', 'INLINE_ANSWER'], ...JSON.parse(JSON.stringify(options.request || {})), templateVersionId: options.templateVersionId || options.request?.templateVersionId })
  previousCandidates.value = JSON.parse(JSON.stringify(options.previousOutputs || [])); previousSnapshots = []; revisionEnabled.value = false; revisionRoles.value = []
  if (!pending) delete form.value.previousOutputs
  else restorePreviousInputs(form.value.previousOutputs)
  form.value.idempotencyKey = pending?.idempotencyKey || newKey(); sectionNumber = form.value.sections.length
  material.value = null; materialIds.value = []; selectionMode.value = form.value.materialId ? 'MATERIAL' : 'QUESTIONS'
  open.value = true; templateLoading.value = true
  try { templates.value = (await getTemplateOptions()).data || []; if (form.value.templateVersionId) await loadTemplate(!options.request) }
  finally { templateLoading.value = false }
  if (options.materialId || form.value.materialId) { materialIds.value = [options.materialId || form.value.materialId]; selectionMode.value = 'MATERIAL'; if (!pending) await selectMaterial() }
  if (pending) ElMessage.warning('已恢复上次未确认的请求，请按原提交编号重试取得原任务')
}
async function loadTemplate(useDefaults) {
  if (!form.value.templateVersionId) { version.value = null; return }
  const ticket = ++generation
  const selected = (await getExperienceVersion(form.value.templateVersionId)).data
  if (ticket !== generation) return
  version.value = selected
  if (useDefaults) form.value.parameters = { ...Object.fromEntries((selected.fieldSchema || []).filter(f => f.defaultValue !== undefined).map(f => [f.key, f.defaultValue])), ...(selected.defaultValues || {}) }
}
async function selectMaterial() {
  if (!materialIds.value[0]) { material.value = null; delete form.value.materialId; delete form.value.materialRowVersion; return }
  const selected = (await getRecord('material', materialIds.value[0])).data
  material.value = selected; form.value.materialId = selected.id; form.value.materialRowVersion = selected.rowVersion
}
function restorePreviousInputs(values) {
  previousSnapshots = JSON.parse(JSON.stringify(values || []))
  previousCandidates.value = previousSnapshots.map(item => ({ ...item }))
  revisionEnabled.value = previousSnapshots.length > 0
  revisionRoles.value = previousSnapshots.map(item => item.outputKey)
}
async function configureRevisions(enabled) {
  if (!enabled) { revisionEnabled.value = false; delete form.value.previousOutputs; return }
  revisionLoading.value = true
  try {
    const snapshots = []
    for (const candidate of previousCandidates.value) {
      const product = (await getRecord('product', candidate.productId)).data
      if (product.profile?.audienceRole !== candidate.outputKey) throw new Error('前版成品角色不一致，请重新选择')
      previousNames[product.id] = product.title
      snapshots.push({ outputKey: candidate.outputKey, productId: product.id, rowVersion: product.rowVersion })
    }
    previousSnapshots = snapshots; revisionRoles.value = snapshots.filter(item => form.value.outputRoles.includes(item.outputKey)).map(item => item.outputKey)
    form.value.previousOutputs = snapshots.filter(item => revisionRoles.value.includes(item.outputKey)).map(item => ({ ...item })); revisionEnabled.value = true
  } catch (error) { revisionEnabled.value = false; delete form.value.previousOutputs; ElMessage.error(error.message || '无法读取前版成品，请确认成品查看权限') }
  finally { revisionLoading.value = false }
}
function addSection() { let section = newSection(); while (form.value.sections.some(item => item.key === section.key)) section = newSection(); form.value.sections.push(section) }
function setQuestions(section, rows) {
  const previous = new Map(section.questionRefs.map(q => [String(q.questionId), q]))
  rows.forEach(row => { questionNames[row.id] = row.title })
  section.questionRefs = rows.map(row => previous.get(String(row.id)) || { questionId: row.id, rowVersion: row.rowVersion })
}
function moveQuestion(section, index, offset) { const item = section.questionRefs.splice(index, 1)[0]; section.questionRefs.splice(index + offset, 0, item) }
async function refreshQuestions() {
  refreshing.value = true
  try {
    const ids = [...new Set(form.value.sections.flatMap(s => s.questionRefs.map(q => String(q.questionId))))]
    const rows = await getQuestionsByIds(ids)
    const current = new Map(rows.map(row => [String(row.id), row]))
    const missing = ids.filter(id => !current.has(id))
    if (missing.length) return ElMessage.warning(`以下题目当前不可读取，保留原题序和版本：${missing.join('、')}`)
    rows.forEach(row => { questionNames[row.id] = row.title })
    form.value.sections.forEach(s => s.questionRefs.forEach(q => { q.rowVersion = current.get(String(q.questionId)).rowVersion }))
    ElMessage.success('已读取当前版本，请重新预检')
  } finally { refreshing.value = false }
}
function payload() {
  const result = JSON.parse(JSON.stringify(form.value))
  result.outlineScopes = result.outlineScopes.map(({ outlineId, scopeKind, nodeIds, note }) => ({ outlineId, scopeKind, nodeIds: nodeIds || [], note }))
  if (selectionMode.value === 'MATERIAL') { result.materialId = material.value?.id || result.materialId; result.materialRowVersion = material.value?.rowVersion || result.materialRowVersion; result.sections = [] }
  else { delete result.materialId; delete result.materialRowVersion; result.sections = result.sections.map(s => ({ key: s.key, title: s.title, ...(s.dayKey ? { dayKey: s.dayKey } : {}), questionRefs: s.questionRefs.map(({ questionId, rowVersion }) => ({ questionId, rowVersion })) })) }
  return result
}
function changeTab(name) { if (name === 'json') jsonText.value = JSON.stringify(payload(), null, 2) }
async function applyJson() {
  try {
    const value = JSON.parse(jsonText.value)
    if (!value || Array.isArray(value) || !value.templateVersionId || !Array.isArray(value.outlineScopes) || !Array.isArray(value.outputRoles) || (!value.materialId && !Array.isArray(value.sections))) throw new Error('请提供模板版本、教材范围、成品角色以及题单或专项')
    if (value.parameters != null && (typeof value.parameters !== 'object' || Array.isArray(value.parameters))) throw new Error('parameters 必须是字段与值组成的 JSON 对象')
    if (value.sections != null && (!Array.isArray(value.sections) || value.sections.some(section => !section || !section.key || !Array.isArray(section.questionRefs) || section.questionRefs.some(item => !item?.questionId || item.rowVersion == null)))) throw new Error('每个栏目需提供 key 和 questionRefs，每题需提供 questionId 与 rowVersion')
    if (value.previousOutputs != null && (!Array.isArray(value.previousOutputs) || value.previousOutputs.some(item => !roles.includes(item?.outputKey) || !item.productId || item.rowVersion == null))) throw new Error('previousOutputs 中每项需提供相同角色的 outputKey、productId 和 rowVersion')
    form.value = normalize(value); selectionMode.value = value.materialId ? 'MATERIAL' : 'QUESTIONS'; material.value = null; materialIds.value = value.materialId ? [value.materialId] : []
    restorePreviousInputs(value.previousOutputs)
    sectionNumber = form.value.sections.length
    await loadTemplate(false); validationMessage.value = ''; ElMessage.success('JSON 已应用到表单')
    return true
  } catch (error) { ElMessage.error(error.message || 'JSON 格式错误'); return false }
}
async function prepare() {
  if (tab.value === 'json' && !(await applyJson())) return null
  const request = payload()
  if (revisionLoading.value) { ElMessage.warning('请等待读取前版成品'); return null }
  if (revisionEnabled.value && !request.previousOutputs?.length) { ElMessage.warning('请选择要延续修订的成品角色'); return null }
  if (!request.templateVersionId || !request.idempotencyKey || !request.outlineScopes.length || !request.outputRoles.length) { ElMessage.warning('请填写模板、教材范围、成品角色和提交编号'); return null }
  if (selectionMode.value === 'MATERIAL' && !request.materialId) { ElMessage.warning('请选择专项'); return null }
  if (selectionMode.value === 'QUESTIONS' && (!questionCount.value || questionCount.value > 500)) { ElMessage.warning('请选择 1～500 个内容位置'); return null }
  return request
}
async function validate() {
  const request = await prepare(); if (!request) return
  validating.value = true; validationMessage.value = ''
  try { const response = await validateRender(request); validationOk.value = response.data?.valid === true; validationWarnings.value = response.data?.warnings || []; validationMessage.value = validationOk.value ? `预检通过：${response.data.positionCount} 个内容位置、${response.data.uniqueQuestionCount} 道独立内容、${response.data.assetCount} 个资源，可以提交生成` : '预检未通过，请检查配置与题单' }
  catch (error) { validationOk.value = false; validationMessage.value = error.message || '预检失败，请检查版本、教材范围和资源' }
  finally { validating.value = false }
}
async function submit() {
  if (busy.value) return
  const request = submittedRequest || await prepare(); if (!request) return
  busy.value = true
  try {
    if (!submittedRequest) {
      const result = await validateRender(request)
      if (result.data?.valid !== true) { ElMessage.warning('预检未通过，请检查配置与题单'); return }
      submittedRequest = structuredClone(request); submitted.value = true
      sessionStorage.setItem(pendingKey(), JSON.stringify(submittedRequest))
    }
    const result = await createRenderJob(submittedRequest)
    sessionStorage.removeItem(pendingKey()); submittedRequest = null; submitted.value = false
    open.value = false; emit('created', result.data); await jobRef.value.show(result.data.id || result.data.jobId); ElMessage.success('生成任务已提交')
  } catch (error) {
    const code = Number(error.code || error.response?.status)
    if (code >= 400 && code < 500 && code !== 401) {
      sessionStorage.removeItem(pendingKey()); submittedRequest = null; submitted.value = false
      validationOk.value = false; validationMessage.value = error.message || '请求已被拒绝，请调整配置后重试'
    }
  }
  finally { busy.value = false }
}
function copyJob(job) { show({ request: job.configSnapshot, previousOutputs: job.outputs }) }
defineExpose({ show })
</script>
<style scoped>
.section-card { margin-bottom: 12px; }.section-header { display:flex;justify-content:space-between;align-items:center; }.form-note { font-size:12px;color:#909399;line-height:1.8; }.submission-key { margin-top:20px; }.code-input :deep(textarea) { font-family:Consolas,monospace;font-size:13px; }
</style>
