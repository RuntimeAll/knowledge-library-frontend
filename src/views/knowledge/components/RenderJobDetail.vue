<template>
  <el-drawer v-model="open" title="生成任务与成品依据" size="90%" append-to-body destroy-on-close @closed="stopPolling">
    <div v-loading="loading">
      <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" class="mb8" />
      <div class="job-actions"><el-button icon="Refresh" :loading="loading" @click="load">刷新状态</el-button><el-button v-if="job.status === 'FAILED'" v-hasPermi="['knowledge:render:retry']" type="warning" :loading="retrying" @click="retry">重试原任务</el-button><el-button v-hasPermi="['knowledge:render:add']" type="primary" plain :disabled="!job.configSnapshot" @click="copy">复制配置并替换题单</el-button></div>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="任务编号">{{ job.id }}</el-descriptions-item><el-descriptions-item label="状态">{{ label('renderStatus', job.status) }}</el-descriptions-item>
        <el-descriptions-item label="模板版本">{{ job.templateSnapshot?.experienceName || job.templateSnapshot?.name || '模板' }} · {{ job.templateSnapshot?.versionNo || job.templateVersionId }}</el-descriptions-item>
        <el-descriptions-item label="内容位置">{{ job.items?.length || 0 }}</el-descriptions-item><el-descriptions-item label="提交编号">{{ job.idempotencyKey }}</el-descriptions-item><el-descriptions-item label="创建时间">{{ job.createTime || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-if="job.errorMessage" :title="job.errorMessage" type="error" :closable="false" class="mt8" />
      <el-divider content-position="left">已保存成品</el-divider>
      <el-table :data="job.outputs || []" empty-text="尚未生成完成，可稍后刷新查看">
        <el-table-column label="使用角色" min-width="150"><template #default="{ row }">{{ label('audienceRole', row.outputKey) }}</template></el-table-column>
        <el-table-column label="成品编号" prop="productId" width="110" />
        <el-table-column label="文件校验值" prop="sha256" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="260"><template #default="{ row }"><el-button v-hasPermi="['knowledge:render:download']" link type="primary" @click="preview(row)">预览 PDF</el-button><el-button v-hasPermi="['knowledge:render:download']" link type="primary" @click="download(row, 'pdf')">下载 PDF</el-button><el-button v-hasPermi="['knowledge:render:download']" link type="primary" @click="download(row, 'package')">离线资源包</el-button></template></el-table-column>
      </el-table>
      <el-tabs class="mt8"><el-tab-pane label="生成配置"><el-descriptions :column="1" border><el-descriptions-item v-for="(value, key) in job.configSnapshot?.parameters || {}" :key="key" :label="fieldLabel(key)">{{ Array.isArray(value) ? value.join('、') : value }}</el-descriptions-item></el-descriptions><outline-scopes :model-value="job.configSnapshot?.outlineScopes || []" readonly /></el-tab-pane>
        <el-tab-pane label="冻结题单与来源">
          <el-alert title="此处保存提交当时的题目与关系。线上题目后续修改不会改变这些生成依据或已保存 PDF。" :closable="false" type="info" class="mb8" />
          <el-table :data="job.items || []">
            <el-table-column label="顺序" prop="seq" width="65" />
            <el-table-column label="栏目" width="130"><template #default="{ row }">{{ sectionTitle(row.sectionKey) }}</template></el-table-column>
            <el-table-column label="题目编号" prop="questionId" width="110" />
            <el-table-column label="版本" prop="questionRowVersion" width="75" />
            <el-table-column label="题目" min-width="250"><template #default="{ row }"><el-button link type="primary" @click="showQuestion(row)">{{ snapshot(row).title || '查看冻结正文' }}</el-button></template></el-table-column>
            <el-table-column label="考点" min-width="180"><template #default="{ row }">{{ pointNames(row) }}</template></el-table-column>
            <el-table-column label="来源" min-width="180"><template #default="{ row }"><span v-for="source in row.occurrences || []" :key="source.id">{{ sourceName(row, source) }}{{ source.questionNo ? ` · ${source.questionNo}` : '' }}<br></span></template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="Agent 请求"><pre class="json-block">{{ JSON.stringify(job.configSnapshot || {}, null, 2) }}</pre></el-tab-pane>
      </el-tabs>
    </div>
  </el-drawer>
  <el-dialog v-model="previewOpen" title="生成 PDF 预览" width="90%" append-to-body destroy-on-close><pdf-preview v-if="previewOpen && previewLoader" :load-blob="previewLoader" /></el-dialog>
  <el-dialog v-model="questionOpen" title="提交时的题目正文快照" width="950px" append-to-body destroy-on-close>
    <el-descriptions :column="3" border><el-descriptions-item label="题目编号">{{ frozenQuestion.id }}</el-descriptions-item><el-descriptions-item label="版本">{{ frozenQuestion.rowVersion }}</el-descriptions-item><el-descriptions-item label="题型">{{ label('questionType', frozenQuestion.questionType) }}</el-descriptions-item></el-descriptions>
    <h4>题干 / 知识内容</h4><html-preview :html="frozenQuestion.stemHtml" :layout-mode="frozenQuestion.layoutMode" :pagination-mode="frozenQuestion.paginationMode" />
    <h4>答案 / 知识说明</h4><html-preview :html="frozenQuestion.answerHtml" answer />
    <h4>解析</h4><html-preview :html="frozenQuestion.analysisHtml" answer />
  </el-dialog>
</template>
<script setup>
import { ElMessage } from 'element-plus'
import { saveAs } from 'file-saver'
import { getRenderJob, retryRenderJob, getRenderOutputBlob } from '@/api/knowledge/experience'
import { label } from './labels'
import OutlineScopes from './OutlineScopes.vue'
const PdfPreview = defineAsyncComponent(() => import('./PdfPreview.vue'))
const HtmlPreview = defineAsyncComponent(() => import('./HtmlPreview.vue'))
const emit = defineEmits(['copy', 'changed'])
const open = ref(false), loading = ref(false), retrying = ref(false), job = ref({}), previewOpen = ref(false), previewLoader = shallowRef(null)
const loadError = ref('')
const questionOpen = ref(false), frozenQuestion = ref({})
let timer, generation = 0, jobId
function stopPolling() { clearTimeout(timer); timer = null; ++generation }
async function show(id) { stopPolling(); jobId = id; job.value = {}; open.value = true; await load() }
async function load() {
  clearTimeout(timer); const ticket = ++generation; loading.value = true; loadError.value = ''
  try {
    const result = (await getRenderJob(jobId)).data
    if (ticket !== generation) return
    job.value = result
    if (open.value && ['QUEUED', 'RUNNING'].includes(result.status)) timer = setTimeout(load, 3000)
  } catch (error) { if (ticket === generation) loadError.value = error.message || '任务读取失败，请检查权限或刷新重试' }
  finally { if (ticket === generation) loading.value = false }
}
async function retry() { retrying.value = true; try { await retryRenderJob(jobId); ElMessage.success('原任务已重新排队'); emit('changed'); await load() } finally { retrying.value = false } }
function copy() { open.value = false; stopPolling(); emit('copy', JSON.parse(JSON.stringify(job.value))) }
function fieldLabel(key) { return job.value.templateSnapshot?.fieldSchema?.find(field => field.key === key)?.label || ({ title:'主标题', subtitle:'副标题', instructions:'说明', studentFields:'学生信息栏' })[key] || key }
function snapshot(item) { return item.snapshot || item.snapshotJson || {} }
function sectionTitle(key) { return job.value.configSnapshot?.sections?.find(section => section.key === key)?.title || key }
function pointNames(item) { return (item.knowledgePoints || []).length ? item.knowledgePoints.map(point => point.name).join('、') : (snapshot(item).kpIds || []).map(id => `考点 ${id}`).join('、') || '未声明' }
function sourceName(item, occurrence) { return item.sources?.find(source => String(source.id) === String(occurrence.sourceId))?.title || occurrence.sourceTitle || `来源 ${occurrence.sourceId}` }
function showQuestion(item) { frozenQuestion.value = snapshot(item); questionOpen.value = true }
function preview(output) { const id = jobId, key = output.outputKey; previewLoader.value = () => getRenderOutputBlob(id, key); previewOpen.value = true }
async function download(output, kind) {
  try { const blob = await getRenderOutputBlob(jobId, output.outputKey, kind); if (blob.type?.includes('json')) throw new Error(JSON.parse(await blob.text()).msg || '下载失败'); saveAs(blob, `${job.value.configSnapshot?.parameters?.title || '生成成品'}-${label('audienceRole', output.outputKey)}.${kind === 'pdf' ? 'pdf' : 'zip'}`) }
  catch (error) { ElMessage.error(error.message || '下载失败') }
}
watch(open, value => { if (!value) stopPolling() })
onBeforeUnmount(stopPolling)
defineExpose({ show })
</script>
<style scoped>.job-actions{display:flex;gap:8px;margin-bottom:16px;}.json-block{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--el-fill-color-light);padding:16px;font-size:13px;}</style>
