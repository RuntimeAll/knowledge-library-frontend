<template>
  <el-dialog
    v-model="open"
    :title="dialogTitle"
    width="950px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="!busy"
  >
    <el-alert
      :title="
        mode === 'update'
          ? '上传本地修改后的标准 HTML，保留题目编号和行版本；版本冲突会拒绝覆盖。'
          : mode === 'derive'
            ? '变式会新建独立题目并关联母题，不继承母题的已核实真题身份。'
            : '题目正文由本地 HTML 导入；页面仅编辑分类与关联元数据。支持同一文件批量导入。'
      "
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-steps :active="result ? 3 : htmlFile ? 2 : 0" simple>
      <el-step title="下载格式模板" />
      <el-step title="本地编辑 HTML" />
      <el-step title="上传并核对结果" />
    </el-steps>
    <el-collapse class="restore-panel">
      <el-collapse-item title="查看或恢复已提交的导入批次" name="restore">
        <el-form inline @submit.prevent="loadBatch">
          <el-form-item label="批次编号">
            <el-input
              v-model="batchLookup"
              placeholder="输入原导入结果中的批次编号"
              clearable
            />
          </el-form-item>
          <el-form-item>
            <el-button
              v-hasPermi="['knowledge:import:query']"
              type="primary"
              plain
              :loading="readingBatch"
              @click="loadBatch"
            >
              读取批次结果
            </el-button>
          </el-form-item>
        </el-form>
        <p class="form-hint">
          本窗口会记住最近一次批次。补传原文件必须保留原提交标识；已成功的题目会复用原结果。
        </p>
      </el-collapse-item>
    </el-collapse>
    <div class="import-tools">
      <el-button icon="Download" @click="downloadTemplate">
        下载{{
          mode === 'derive' ? '变式' : mode === 'update' ? '更新' : '新建'
        }}模板
      </el-button>
      <el-button
        v-if="question?.id"
        v-hasPermi="['knowledge:question:export']"
        icon="Download"
        :loading="exporting"
        @click="exportOriginal"
      >
        导出母题 / 原题资源包
      </el-button>
    </div>
    <el-form label-width="110px" :disabled="busy">
      <template v-if="mode === 'derive'">
        <el-divider content-position="left">变式模板说明</el-divider>
        <el-form-item label="变式操作">
          <enum-select v-model="derivation.operation" field="operation" />
        </el-form-item>
        <el-form-item label="改动说明">
          <el-input
            v-model="derivation.changeNote"
            type="textarea"
            placeholder="写入下载模板；上传时以 HTML 中的说明为准"
          />
        </el-form-item>
        <el-form-item label="保留说明">
          <el-input
            v-model="derivation.preservedNote"
            type="textarea"
            placeholder="保留了母题的哪些考点、方法或条件"
          />
        </el-form-item>
        <el-form-item label="辅助母题">
          <record-picker
            v-model="derivation.auxiliaryParentIds"
            type="question"
            :exclude-ids="question?.id ? [question.id] : []"
          />
        </el-form-item>
      </template>
      <el-form-item v-if="mode === 'create'" label="可选来源">
        <record-picker v-model="sourceIds" type="source" :multiple="false" />
        <div class="form-hint">
          导入时只建立待核实的出处；原件需在来源页面独立上传。
        </div>
      </el-form-item>
      <el-form-item label="标准 HTML" required>
        <el-upload
          v-model:file-list="htmlFiles"
          :auto-upload="false"
          :limit="1"
          accept=".html,.htm"
          :on-change="selectHtml"
          :on-remove="clearHtml"
          :on-exceed="() => ElMessage.warning('请先移除已选 HTML 再选择')"
        >
          <el-button icon="Upload">选择 HTML 文件</el-button>
          <template #tip>
            <div class="el-upload__tip">
              UTF-8，最大 2 MB，需包含 kb-question-html/v1 标识与 article
              数据属性。
            </div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item label="配套题图">
        <el-upload
          v-model:file-list="resourceFiles"
          :auto-upload="false"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.webp"
        >
          <el-button icon="Picture">选择配套图片</el-button>
          <template #tip>
            <div class="el-upload__tip">
              文件名需与 HTML 相对图片路径对应；系统内原有资产编号可直接复用。
            </div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item label="提交标识">
        <el-input v-model="idempotencyKey" maxlength="128" />
        <div class="form-hint">
          同一次提交重试保留此标识；更换文件后自动生成新标识，避免重复建题。
        </div>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="preflightError"
      :title="preflightError"
      type="error"
      :closable="false"
      show-icon
      class="mb8"
    />
    <el-collapse v-if="previewHtml">
      <el-collapse-item title="本地题干预览（上传前核对）">
        <html-preview :html="previewHtml" />
      </el-collapse-item>
    </el-collapse>
    <div v-if="result" class="import-result">
      <el-alert
        :title="resultTitle"
        :type="
          result.status === 'SUCCESS'
            ? 'success'
            : result.status === 'FAILED'
              ? 'error'
              : 'warning'
        "
        :closable="false"
        show-icon
      />
      <p>
        批次编号：{{ result.batchId }}
        <el-button
          v-hasPermi="['knowledge:import:query']"
          link
          type="primary"
          @click="refreshResult"
        >
          刷新结果
        </el-button>
        <el-button
          v-if="result.status === 'PROCESSING' && result.inputReady"
          v-hasPermi="['knowledge:import:execute']"
          type="warning"
          plain
          :disabled="leaseActive || busy"
          :loading="resuming"
          @click="resumeBatch"
        >
          恢复未完成题目
        </el-button>
      </p>
      <el-alert
        v-if="recoveryNotice"
        :title="recoveryNotice"
        :type="result.status === 'FAILED' ? 'error' : 'warning'"
        :closable="false"
        show-icon
        class="mb8"
      />
      <el-alert
        v-if="result.lastError"
        :title="`上次处理反馈：${result.lastError}`"
        type="warning"
        :closable="false"
        class="mb8"
      />
      <el-table :data="result.items || []">
        <el-table-column
          label="本地题目标识"
          prop="clientKey"
          min-width="180"
        />
        <el-table-column label="处理方式" width="100">
          <template #default="{ row }">
            {{ intentLabel[row.intent] || '未识别' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            {{ statusLabel[row.status] || '处理中' }}
          </template>
        </el-table-column>
        <el-table-column label="题目编号" prop="questionId" width="100" />
        <el-table-column label="反馈" prop="message" min-width="200" />
      </el-table>
      <el-collapse v-if="result.resources?.length">
        <el-collapse-item
          :title="`已接收 ${result.resources.length} 个配套资源`"
        >
          <el-table :data="result.resources">
            <el-table-column
              label="资源文件"
              prop="resourceKey"
              min-width="240"
            />
            <el-table-column label="文件大小" width="120">
              <template #default="{ row }">
                {{ Math.ceil(Number(row.fileSize || 0) / 1024) }} KB
              </template>
            </el-table-column>
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </div>
    <template #footer>
      <el-button
        type="primary"
        :loading="busy"
        :disabled="!htmlFile || !!preflightError"
        @click="submit"
      >
        上传并导入
      </el-button>
      <el-button :disabled="busy" @click="open = false">关闭</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { saveAs } from 'file-saver'
import {
  importHtml,
  knowledgeRequest,
  exportQuestions,
  resumeImport
} from '@/api/knowledge'
import RecordPicker from './RecordPicker.vue'
import EnumSelect from './EnumSelect.vue'
import HtmlPreview from './HtmlPreview.vue'
import { ElMessage } from 'element-plus'
const emit = defineEmits(['completed'])
const derivation = reactive({
  operation: 'OTHER',
  changeNote: '',
  preservedNote: '',
  auxiliaryParentIds: []
})
const open = ref(false),
  mode = ref('create'),
  question = ref(null),
  sourceIds = ref([]),
  htmlFiles = ref([]),
  htmlFile = ref(null),
  resourceFiles = ref([]),
  idempotencyKey = ref(''),
  preflightError = ref(''),
  previewHtml = ref(''),
  result = ref(null),
  busy = ref(false),
  exporting = ref(false),
  instanceId = ref('')
const batchLookup = ref(''),
  readingBatch = ref(false),
  resuming = ref(false),
  leaseNow = ref(Date.now())
let leaseTimer
const lastBatchKey = 'knowledge:last-import-batch'
watch(open, (visible) => {
  clearInterval(leaseTimer)
  leaseNow.value = Date.now()
  if (visible)
    leaseTimer = setInterval(() => {
      leaseNow.value = Date.now()
    }, 1000)
})
onBeforeUnmount(() => clearInterval(leaseTimer))
const leaseActive = computed(
  () =>
    result.value?.leaseUntil &&
    Date.parse(String(result.value.leaseUntil).replace(' ', 'T')) >
      leaseNow.value
)
const recoveryNotice = computed(() => {
  if (result.value?.status === 'RECEIVING')
    return '原 HTML 或配套资源尚未接收完整。请选择原 HTML 与全部原资源，保留原提交标识重新上传；此状态不能直接恢复处理。'
  if (result.value?.status === 'PROCESSING')
    return !result.value.inputReady
      ? '输入文件尚未准备完整，请补传原文件后重试。'
      : leaseActive.value
        ? '当前批次仍在执行，请稍后刷新结果；处理占用期间不能重复恢复。'
        : '输入文件已完整接收，处理占用已过期。可恢复尚未完成的题目，已有成功结果会保留。'
  if (['PARTIAL', 'FAILED'].includes(result.value?.status))
    return '本批次结果已固定。失败题目请修正 HTML 后使用新的提交标识上传，已有成功题目不会因刷新结果重复创建。'
  return ''
})
const intentLabel = { create: '新建', update: '更新原题', derive: '新建变式' },
  statusLabel = {
    SUCCESS: '成功',
    REUSED: '已复用',
    FAILED: '失败',
    PROCESSING: '处理中'
  }
const dialogTitle = computed(() =>
  mode.value === 'derive'
    ? '上传 HTML 新建变式'
    : mode.value === 'update'
      ? '上传 HTML 更新正文'
      : '上传 HTML 新建题目 / 导出回流'
)
const resultTitle = computed(
  () =>
    `${result.value.status === 'SUCCESS' ? '导入成功' : result.value.status === 'FAILED' ? '导入失败' : result.value.status === 'PARTIAL' ? '部分导入成功，请逐项核对' : result.value.status === 'RECEIVING' ? '等待补传原文件' : '正在处理'}：成功 ${result.value.successCount || 0}，失败 ${result.value.failureCount || 0}`
)
const newKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `import-${Date.now()}-${Math.random().toString(36).slice(2)}`
async function show(intent = 'create', record = null) {
  Object.assign(derivation, {
    operation: 'OTHER',
    changeNote: '',
    preservedNote: '',
    auxiliaryParentIds: []
  })
  mode.value = intent
  question.value = record
  sourceIds.value = []
  htmlFiles.value = []
  htmlFile.value = null
  resourceFiles.value = []
  result.value = null
  previewHtml.value = ''
  preflightError.value = ''
  idempotencyKey.value = newKey()
  try {
    batchLookup.value =
      JSON.parse(sessionStorage.getItem(lastBatchKey) || '{}').batchId || ''
  } catch {
    batchLookup.value = ''
  }
  open.value = true
  try {
    instanceId.value = (
      await knowledgeRequest('/import/schema')
    ).data.instanceId
  } catch {
    instanceId.value = ''
  }
}
function clearHtml() {
  htmlFile.value = null
  previewHtml.value = ''
  preflightError.value = ''
  result.value = null
}
async function selectHtml(item) {
  const originalKey =
    result.value?.status === 'RECEIVING'
      ? result.value.idempotencyKey || idempotencyKey.value
      : null
  clearHtml()
  htmlFile.value = item.raw
  idempotencyKey.value = originalKey || newKey()
  if (item.raw.size > 2 * 1024 * 1024) {
    preflightError.value = 'HTML 文件不能超过 2 MB'
    return
  }
  const text = await item.raw.text(),
    documentHtml = new DOMParser().parseFromString(text, 'text/html')
  if (
    documentHtml.querySelector('meta[name="kb-schema"]')?.content !==
    'kb-question-html/v1'
  ) {
    preflightError.value =
      '缺少标准格式标识，请使用下载的模板或导出包中的单题 HTML'
    return
  }
  const articles = [...documentHtml.querySelectorAll('article')]
  if (!articles.length || articles.length > 200) {
    preflightError.value = '每个 HTML 需包含 1～200 道题目'
    return
  }
  for (const article of articles) {
    if (
      !article.dataset.clientKey ||
      !['create', 'update', 'derive'].includes(article.dataset.intent)
    ) {
      preflightError.value =
        '题目缺少稳定标识或有效处理方式，请检查模板数据属性'
      return
    }
    if (mode.value !== 'create' && article.dataset.intent !== mode.value) {
      preflightError.value = `当前操作要求 ${intentLabel[mode.value]} 格式，请使用对应模板`
      return
    }
    if (
      mode.value === 'update' &&
      article.dataset.questionId !== String(question.value.id)
    ) {
      preflightError.value = 'HTML 题目编号与当前题目不一致，已阻止提交'
      return
    }
    if (
      mode.value === 'derive' &&
      article.dataset.parentId !== String(question.value.id)
    ) {
      preflightError.value = 'HTML 母题编号与当前母题不一致，已阻止提交'
      return
    }
    if (
      ['update', 'derive'].includes(article.dataset.intent) &&
      (!instanceId.value ||
        documentHtml.querySelector('meta[name="kb-origin"]')?.content !==
          instanceId.value)
    ) {
      preflightError.value =
        '更新或变式 HTML 缺少本资料库来源标识，请使用当前模板或重新导出'
      return
    }
  }
  previewHtml.value = articles
    .map(
      (article) =>
        article.querySelector('[data-part="stem"]')?.innerHTML ||
        '<p>缺少题干区域</p>'
    )
    .join('<hr>')
}
function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}
function downloadTemplate() {
  if (mode.value !== 'create' && !instanceId.value)
    return ElMessage.warning('无法读取当前资料库格式，请关闭后重试')
  const q = question.value || {},
    metadata = {
      title: q.title || '请填写题目名称',
      subject: q.subject || '',
      questionType: q.questionType || '',
      difficulty: q.difficulty || '',
      kpIds: q.kpIds || [],
      sourceNote: q.sourceNote || ''
    }
  if (mode.value === 'derive')
    Object.assign(metadata, {
      operation: derivation.operation,
      changeNote: derivation.changeNote || '请在本地说明改动',
      preservedNote: derivation.preservedNote || '请在本地说明保留的知识与方法',
      auxiliaryParentIds: derivation.auxiliaryParentIds
    })
  const attrs =
    mode.value === 'update'
      ? ` data-question-id="${escapeAttribute(q.id)}" data-row-version="${escapeAttribute(q.rowVersion)}"`
      : mode.value === 'derive'
        ? ` data-parent-id="${escapeAttribute(q.id)}"`
        : ''
  const json = JSON.stringify(metadata, null, 2).replaceAll('<', '\\u003c')
  const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="kb-schema" content="kb-question-html/v1"><meta name="kb-origin" content="${escapeAttribute(instanceId.value)}"><title>题目交换模板</title><style>body{font:16px/1.8 sans-serif}section[data-part=answer],section[data-part=analysis]{color:red}table,td,th{border:1px solid black;border-collapse:collapse}</style></head><body>\n<article data-client-key="${mode.value === 'update' ? `question-${q.id}` : newKey()}" data-intent="${mode.value}"${attrs}>\n<script type="application/json" data-kb-metadata>${json}<\/script>\n<section data-part="stem">${q.stemHtml || '<p>请在本地填写题干，图片与此文件一同上传。</p>'}</section>\n<section data-part="answer">${q.answerHtml || '<p>请在本地填写答案。</p>'}</section>\n<section data-part="analysis">${q.analysisHtml || ''}</section>\n</article></body></html>`
  saveAs(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    `${intentLabel[mode.value]}模板.html`
  )
}
async function exportOriginal() {
  exporting.value = true
  try {
    await exportQuestions(
      { questionIds: [question.value.id], includeAnswers: true },
      `${question.value.title || '题目'}-资源包.zip`
    )
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
async function submit() {
  if (!idempotencyKey.value.trim()) return ElMessage.warning('请填写提交标识')
  busy.value = true
  try {
    const batch = (
      await importHtml(
        htmlFile.value,
        resourceFiles.value.map((item) => item.raw),
        {
          idempotencyKey: idempotencyKey.value.trim(),
          sourceId: sourceIds.value[0]
        }
      )
    ).data
    applyBatch(batch)
    emit('completed', result.value)
  } finally {
    busy.value = false
  }
}
async function refreshResult() {
  await loadBatch(result.value.batchId)
}
function applyBatch(batch) {
  result.value = batch
  batchLookup.value = String(batch.batchId)
  if (batch.status === 'RECEIVING' && batch.idempotencyKey)
    idempotencyKey.value = batch.idempotencyKey
  try {
    sessionStorage.setItem(
      lastBatchKey,
      JSON.stringify({ batchId: String(batch.batchId) })
    )
  } catch {
    /* Keeping a receipt in this tab is optional. */
  }
}
async function loadBatch(id) {
  const batchId =
    typeof id === 'string' || typeof id === 'number'
      ? String(id)
      : batchLookup.value.trim()
  if (!/^\d+$/.test(batchId))
    return ElMessage.warning('请输入有效的导入批次编号')
  readingBatch.value = true
  try {
    applyBatch((await knowledgeRequest(`/import/${batchId}`)).data)
    if (['SUCCESS', 'PARTIAL', 'FAILED'].includes(result.value.status))
      emit('completed', result.value)
    return result.value
  } catch {
    /* Request interceptor displays the server error. */
    return null
  } finally {
    readingBatch.value = false
  }
}
async function resumeBatch() {
  resuming.value = true
  busy.value = true
  try {
    if (!(await loadBatch(result.value.batchId))) return
    leaseNow.value = Date.now()
    if (result.value.status !== 'PROCESSING' || !result.value.inputReady)
      return ElMessage.info('该批次当前无需恢复，请查看最新结果')
    if (leaseActive.value)
      return ElMessage.warning('批次仍在执行，请稍后刷新结果')
    applyBatch((await resumeImport(result.value.batchId)).data)
    emit('completed', result.value)
    ElMessage.success('已完成恢复，请核对逐题结果')
  } catch {
    /* Request interceptor displays the server error. */
  } finally {
    busy.value = false
    resuming.value = false
  }
}
defineExpose({ show })
</script>
<style scoped>
.import-tools {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}
.restore-panel {
  margin-top: 16px;
}
.form-hint {
  width: 100%;
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.import-result {
  margin-top: 20px;
}
</style>
