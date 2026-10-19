<template>
  <div class="app-container">
    <el-alert title="模板保存排版经验；每次生成只需更换标题、教材范围和题单。已发布模板可跨年级复用，生成 PDF 不调用模型。" type="info" :closable="false" class="mb8" />
    <el-tabs v-model="activeTab" @tab-change="changeTab">
      <el-tab-pane label="经验模板" name="templates">
        <el-form v-show="showSearch" inline @submit.prevent="search">
          <el-form-item label="模板名称"><el-input v-model="query.name" clearable placeholder="请输入名称" @keyup.enter="search" /></el-form-item>
          <el-form-item label="状态"><enum-select v-model="query.status" field="experienceStatus" clearable style="width:150px" /></el-form-item>
          <el-form-item><el-button type="primary" icon="Search" @click="search">搜索</el-button><el-button icon="Refresh" @click="reset">重置</el-button></el-form-item>
        </el-form>
        <el-row :gutter="10" class="mb8"><el-col :span="1.5"><el-button v-hasPermi="['knowledge:experience:add']" type="primary" plain icon="Plus" @click="edit()">新增经验模板</el-button></el-col><el-col :span="1.5"><el-button v-hasPermi="['knowledge:render:add']" type="success" plain @click="generateRef.show()">选择模板生成</el-button></el-col><right-toolbar v-model:showSearch="showSearch" @queryTable="load" /></el-row>
        <el-table v-loading="loading" :data="rows" row-key="id" empty-text="暂无模板，请新增经验目录并发布模板版本">
          <el-table-column label="编号" prop="id" width="85" />
          <el-table-column label="模板名称" prop="name" min-width="180"><template #default="{ row }"><el-button link type="primary" @click="showVersions(row)">{{ row.name }}</el-button></template></el-table-column>
          <el-table-column label="经验类型" width="115"><template #default="{ row }">{{ label('experienceType', row.experienceType) }}</template></el-table-column>
          <el-table-column label="使用说明" prop="description" min-width="250" show-overflow-tooltip />
          <el-table-column label="状态" width="100"><template #default="{ row }">{{ label('experienceStatus', row.status) }}</template></el-table-column>
          <el-table-column label="更新时间" width="170"><template #default="{ row }">{{ row.updateTime || row.createTime || '—' }}</template></el-table-column>
          <el-table-column label="操作" width="270" fixed="right"><template #default="{ row }"><el-button v-hasPermi="['knowledge:experience:query']" link type="primary" @click="showVersions(row)">版本与预览</el-button><el-button v-hasPermi="['knowledge:experience:edit']" link type="primary" @click="edit(row)">编辑目录</el-button><el-button v-hasPermi="['knowledge:experience:remove']" link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
        </el-table>
        <pagination v-show="total > 0" :total="total" v-model:page="query.pageNum" v-model:limit="query.pageSize" @pagination="load" />
      </el-tab-pane>
      <el-tab-pane v-if="checkPermi(['knowledge:render:query'])" label="生成任务" name="jobs">
        <el-form inline @submit.prevent="searchJobs"><el-form-item label="任务状态"><enum-select v-model="jobQuery.status" field="renderStatus" clearable style="width:180px" /></el-form-item><el-button type="primary" icon="Search" @click="searchJobs">搜索</el-button><el-button icon="Refresh" @click="loadJobs">刷新</el-button></el-form>
        <el-table v-loading="jobsLoading" :data="jobs" empty-text="暂无生成任务">
          <el-table-column label="任务编号" prop="id" width="110" /><el-table-column label="提交编号" prop="idempotencyKey" min-width="260" show-overflow-tooltip /><el-table-column label="模板版本编号" prop="templateVersionId" width="125" />
          <el-table-column label="状态" width="110"><template #default="{ row }">{{ label('renderStatus', row.status) }}</template></el-table-column><el-table-column label="创建时间" prop="createTime" width="170" /><el-table-column label="失败原因" prop="errorMessage" min-width="200" show-overflow-tooltip /><el-table-column label="操作" width="150"><template #default="{ row }"><el-button link type="primary" @click="jobRef.show(row.id)">查看任务与成品</el-button></template></el-table-column>
        </el-table>
        <pagination v-show="jobsTotal > 0" :total="jobsTotal" v-model:page="jobQuery.pageNum" v-model:limit="jobQuery.pageSize" @pagination="loadJobs" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="editOpen" :title="form.id ? '编辑经验目录' : '新增经验模板'" width="660px" append-to-body :close-on-click-modal="!saving">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="saving">
        <el-form-item label="稳定编码" prop="code"><el-input v-model="form.code" maxlength="64" :disabled="!!form.id" placeholder="如 daily-practice" /></el-form-item>
        <el-form-item label="模板名称" prop="name"><el-input v-model="form.name" maxlength="200" show-word-limit /></el-form-item>
        <el-form-item label="经验类型"><enum-select v-model="form.experienceType" field="experienceType" :include-values="['LAYOUT']" /></el-form-item>
        <el-form-item label="状态" prop="status"><enum-select v-model="form.status" field="experienceStatus" /></el-form-item>
        <el-form-item label="适用场景"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="5000" /></el-form-item>
        <el-form-item label="使用经验"><el-input v-model="form.usageNotes" type="textarea" :rows="4" maxlength="10000" placeholder="说明这个版式适用于什么任务，怎样调整效果更好" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" /></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" :loading="saving" @click="save">保存</el-button><el-button :disabled="saving" @click="editOpen = false">取消</el-button></template>
    </el-dialog>

    <el-drawer v-model="versionsOpen" :title="`${experience.name || '经验模板'} · 版本管理`" size="85%" append-to-body destroy-on-close>
      <el-descriptions :column="1" border class="mb8"><el-descriptions-item label="适用场景">{{ experience.description || '未填写' }}</el-descriptions-item><el-descriptions-item label="使用经验"><span class="preserve-lines">{{ experience.usageNotes || '未填写' }}</span></el-descriptions-item></el-descriptions>
      <el-row :gutter="10" class="mb8"><el-col :span="1.5"><el-button v-hasPermi="['knowledge:experience:edit']" type="primary" plain icon="Plus" @click="versionEditorRef.show(experience.id)">新增草稿</el-button></el-col><el-col :span="1.5"><enum-select v-model="versionQuery.status" field="experienceVersionStatus" clearable style="width:170px" @update:model-value="searchVersions" /></el-col><el-col :span="1.5"><el-button icon="Refresh" @click="loadVersions">刷新</el-button></el-col></el-row>
      <el-table v-loading="versionsLoading" :data="versions" empty-text="暂无版本，请先新增草稿">
        <el-table-column label="版本" width="95"><template #default="{ row }">第 {{ row.versionNo }} 版</template></el-table-column><el-table-column label="状态" width="120"><template #default="{ row }">{{ label('experienceVersionStatus', row.status) }}</template></el-table-column><el-table-column label="修订说明" prop="changeNote" min-width="220" show-overflow-tooltip /><el-table-column label="发布时间" prop="publishTime" width="170" />
        <el-table-column label="操作" width="350" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="versionEditorRef.show(experience.id, row)">{{ row.status === 'DRAFT' && canEdit ? '编辑与预览' : '查看与预览' }}</el-button><el-button v-hasPermi="['knowledge:experience:edit']" link type="primary" @click="versionEditorRef.show(experience.id, row, true)">复制草稿</el-button><el-button v-if="row.status === 'DRAFT'" v-hasPermi="['knowledge:experience:publish']" link type="success" :loading="publishing === row.id" @click="publish(row)">发布</el-button><el-button v-if="row.status === 'PUBLISHED' && experience.status === 'ACTIVE'" v-hasPermi="['knowledge:render:add']" link type="primary" @click="generateRef.show({ templateVersionId:row.id })">生成成品</el-button></template></el-table-column>
      </el-table>
      <pagination v-show="versionsTotal > 0" :total="versionsTotal" v-model:page="versionQuery.pageNum" v-model:limit="versionQuery.pageSize" @pagination="loadVersions" />
    </el-drawer>
    <template-version-editor ref="versionEditorRef" @saved="loadVersions" />
    <generate-dialog ref="generateRef" @created="onCreated" />
    <render-job-detail ref="jobRef" @copy="copyJob" @changed="loadJobs" />
  </div>
</template>
<script setup name="KnowledgeExperience">
import { ElMessage, ElMessageBox } from 'element-plus'
import { checkPermi } from '@/utils/permission'
import { listExperiences, getExperience, saveExperience, removeExperience, listExperienceVersions, publishExperienceVersion, listRenderJobs } from '@/api/knowledge/experience'
import EnumSelect from '../components/EnumSelect.vue'
import TemplateVersionEditor from '../components/TemplateVersionEditor.vue'
import GenerateDialog from '../components/GenerateDialog.vue'
import RenderJobDetail from '../components/RenderJobDetail.vue'
import { label } from '../components/labels'
const activeTab = ref('templates'), showSearch = ref(true), loading = ref(false), rows = ref([]), total = ref(0)
const query = reactive({ name:'', status:undefined, pageNum:1, pageSize:10 })
const formRef = ref(), form = ref({}), editOpen = ref(false), saving = ref(false), experience = ref({})
const versionsOpen = ref(false), versionsLoading = ref(false), versions = ref([]), versionsTotal = ref(0), publishing = ref(null), versionEditorRef = ref()
const versionQuery = reactive({ status:undefined, pageNum:1, pageSize:10 })
const generateRef = ref(), jobRef = ref(), jobsLoading = ref(false), jobs = ref([]), jobsTotal = ref(0), jobQuery = reactive({ status:undefined, pageNum:1, pageSize:10 })
const canEdit = computed(() => checkPermi(['knowledge:experience:edit']))
const rules = { code:[{ required:true, message:'请填写稳定编码', trigger:'blur' }], name:[{ required:true, message:'请填写模板名称', trigger:'blur' }], status:[{ required:true, message:'请选择状态', trigger:'change' }] }
let listGeneration = 0, versionGeneration = 0, jobGeneration = 0
async function load() {
  const ticket = ++listGeneration; loading.value = true
  try { const response = await listExperiences(query); if (ticket === listGeneration) { rows.value = response.rows || []; total.value = Number(response.total || 0) } }
  finally { if (ticket === listGeneration) loading.value = false }
}
function search() { query.pageNum = 1; load() }
function reset() { Object.assign(query, { name:'', status:undefined, pageNum:1 }); load() }
async function edit(row) { form.value = row?.id ? (await getExperience(row.id)).data : { code:'', name:'', experienceType:'LAYOUT', status:'ACTIVE', description:'', usageNotes:'', remark:'' }; editOpen.value = true; nextTick(() => formRef.value?.clearValidate()) }
async function save() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try { await saveExperience(form.value); editOpen.value = false; ElMessage.success('经验目录已保存，请在版本管理中维护排版模板'); await load() }
  finally { saving.value = false }
}
async function remove(row) {
  try { await ElMessageBox.confirm(`确认删除经验“${row.name}”？已被生成任务引用的模板会阻止删除。`, '删除确认', { type:'warning' }) }
  catch { return }
  await removeExperience(row.id); ElMessage.success('经验目录已删除'); load()
}
async function showVersions(row) { experience.value = (await getExperience(row.id)).data; versionQuery.pageNum = 1; versionQuery.status = undefined; versionsOpen.value = true; await loadVersions() }
function searchVersions() { versionQuery.pageNum = 1; loadVersions() }
async function loadVersions() {
  if (!experience.value.id) return
  const ticket = ++versionGeneration; versionsLoading.value = true
  try { const response = await listExperienceVersions(experience.value.id, versionQuery); if (ticket === versionGeneration) { versions.value = response.rows || []; versionsTotal.value = Number(response.total || 0) } }
  finally { if (ticket === versionGeneration) versionsLoading.value = false }
}
async function publish(row) {
  try { await ElMessageBox.confirm(`发布第 ${row.versionNo} 版后，HTML、配置字段与资源将冻结。确认发布？`, '发布模板', { type:'warning' }) }
  catch { return }
  publishing.value = row.id
  try { await publishExperienceVersion(row.id, row.rowVersion); ElMessage.success('模板版本已发布，可用于生成成品'); await loadVersions() }
  finally { publishing.value = null }
}
function changeTab(tab) { if (tab === 'jobs') loadJobs() }
function searchJobs() { jobQuery.pageNum = 1; loadJobs() }
async function loadJobs() {
  if (!checkPermi(['knowledge:render:query'])) return
  const ticket = ++jobGeneration; jobsLoading.value = true
  try { const response = await listRenderJobs(jobQuery); if (ticket === jobGeneration) { jobs.value = response.rows || []; jobsTotal.value = Number(response.total || 0) } }
  finally { if (ticket === jobGeneration) jobsLoading.value = false }
}
function onCreated() { if (activeTab.value === 'jobs') loadJobs() }
function copyJob(job) { generateRef.value.show({ request:job.configSnapshot, previousOutputs:job.outputs }) }
onMounted(load)
</script>
<style scoped>.preserve-lines{white-space:pre-wrap}</style>
