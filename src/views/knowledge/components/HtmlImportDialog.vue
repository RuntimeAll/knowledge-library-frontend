<template>
  <el-dialog
    v-model="open"
    :title="dialogTitle"
    width="950px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <el-alert
      :title="
        mode === 'update'
          ? '上传修改后的标准 HTML，保留题目编号和行版本；关键修改会退回草稿，版本冲突拒绝覆盖。'
          : mode === 'derive'
            ? '变式保存为草稿，并校验冻结母题版本与哈希；不继承母题的真题身份。'
            : '此窗口接收标准 HTML 文件，可批量导入。Agent 也可通过统一 JSON 接口录入；页面可编辑分类与关联元数据。'
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
      <el-dropdown v-if="mode === 'create'" @command="downloadExample">
        <el-button plain>下载结构示例 <el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
        <template #dropdown>
          <el-dropdown-menu><el-dropdown-item v-for="example in exchangeExamples" :key="example.key" :command="example.key">{{ example.label }}</el-dropdown-item></el-dropdown-menu>
        </template>
      </el-dropdown>
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
    <el-alert v-if="pendingImport" :title="`此提交尚未完整确认，已保留原文件与提交标识 ${pendingImport.fields.idempotencyKey}，请按原请求重试。`" type="warning" :closable="false" class="mb8" />
    <el-alert v-if="importFailure" :title="importFailure" type="error" :closable="false" class="mb8" />
    <el-form label-width="110px" :disabled="busy || !!pendingImport">
      <el-collapse class="mb8">
        <el-collapse-item title="下载模板的分类、考点与排版" name="metadata">
          <el-form-item label="内容类型">
            <enum-select v-model="templateMeta.contentKind" field="contentKind" @update:model-value="changeTemplateKind" />
          </el-form-item>
          <el-form-item label="学科">
            <enum-select v-model="templateMeta.subject" field="subject" clearable />
          </el-form-item>
          <el-form-item :label="templateMeta.contentKind === 'KNOWLEDGE' ? '知识类型' : '题型'">
            <enum-select v-model="templateMeta.questionType" field="questionType" clearable
              :include-values="templateMeta.contentKind === 'KNOWLEDGE' ? knowledgeTypes : null"
              :exclude-values="templateMeta.contentKind === 'EXERCISE' ? knowledgeTypes : []" />
          </el-form-item>
          <el-form-item label="考点">
            <record-picker v-model="templateMeta.kpIds" type="kp" :filters="{ subject: templateMeta.subject || undefined }" />
          </el-form-item>
          <el-form-item label="呈现方式"><enum-select v-model="templateMeta.layoutMode" field="layoutMode" /></el-form-item>
          <el-form-item label="内容单元"><enum-select v-model="templateMeta.unitKind" field="unitKind" /></el-form-item>
          <el-form-item label="分页方式"><enum-select v-model="templateMeta.paginationMode" field="paginationMode" /></el-form-item>
          <el-form-item label="排版说明"><el-input v-model="templateMeta.layoutNote" type="textarea" :rows="2" maxlength="2000" show-word-limit /></el-form-item>
          <p class="form-hint">计算练习默认一条 GROUP 至少 3 个完整小题；真实母题不足 3 个需专项数量批准，不能添题或拼题凑数。</p>
          <p class="form-hint">10 道口算可放在同一组合内容中，整体检索和复用，不会拆成 10 条题库记录。条目数由正文结构计算；选择题选项支持单独的 HTML 区域。</p>
          <p class="form-hint">这些选项写入下载的模板。实际导入以 HTML 内逐条元数据为准；不会覆盖已选文件中的分类。</p>
        </el-collapse-item>
      </el-collapse>
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
      <el-collapse-item :title="`本地内容元数据（${previewMetadata.length} 条）`" name="metadata-preview">
        <el-table :data="previewMetadata" max-height="300">
          <el-table-column label="内容名称" prop="title" min-width="200" />
          <el-table-column label="内容类型" width="130"><template #default="{ row }">{{ metadataLabel('contentKind', row) }}</template></el-table-column>
          <el-table-column label="学科" width="100"><template #default="{ row }">{{ metadataLabel('subject', row) }}</template></el-table-column>
          <el-table-column label="题型 / 知识类型" width="150"><template #default="{ row }">{{ metadataLabel('questionType', row) }}</template></el-table-column>
          <el-table-column label="内容单元" width="120"><template #default="{ row }">{{ metadataLabel('unitKind', row) }}</template></el-table-column>
          <el-table-column label="呈现方式" width="120"><template #default="{ row }">{{ metadataLabel('layoutMode', row) }}</template></el-table-column>
          <el-table-column label="分页方式" width="130"><template #default="{ row }">{{ metadataLabel('paginationMode', row) }}</template></el-table-column>
          <el-table-column label="小题数" prop="itemCount" width="90" />
          <el-table-column label="数量例外凭据" prop="granularityExceptionId" min-width="180" />
          <el-table-column label="排版说明" prop="layoutNote" min-width="180" show-overflow-tooltip />
          <el-table-column label="考点" min-width="180"><template #default="{ row }"><relation-names v-if="row.kpIds" type="kp" :ids="row.kpIds" /><span v-else>{{ row.intent === 'update' ? '保留线上考点' : '待补充考点' }}</span></template></el-table-column>
        </el-table>
      </el-collapse-item>
      <el-collapse-item title="本地题干预览（上传前核对）">
        <html-preview :html="previewHtml" />
      </el-collapse-item>
    </el-collapse>
    <import-batch-result v-if="result" :result="result" :busy="busy" :resuming="resuming" :lease-active="!!leaseActive" :recovery-notice="recoveryNotice" @refresh="refreshResult" @resume="resumeBatch" />
    <template #footer>
      <el-button
        type="primary"
        :loading="busy"
        :disabled="!htmlFile || !!preflightError"
        @click="submit"
      >
        {{ pendingImport ? '按原请求重试上传' : '上传并导入' }}
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
import RelationNames from './RelationNames.vue'
import EnumSelect from './EnumSelect.vue'
import HtmlPreview from './HtmlPreview.vue'
import { label } from './labels'
import ImportBatchResult from './ImportBatchResult.vue'
import { calculationPreflight, derivePreflight } from './importReview'
import { knownReviewRejection } from './reviewState'
import { createRequestGeneration } from '@/utils/request-generation'
import useUserStore from '@/store/modules/user'
import { questionLayoutCss } from './questionLayout'
import { exchangeExamples } from './exchangeExamples'
import { ElMessage } from 'element-plus'
const emit = defineEmits(['completed'])
const knowledgeTypes = ['KNOWLEDGE_REVIEW', 'KNOWLEDGE_EXPLANATION']
const templateMeta = reactive({ contentKind: 'EXERCISE', subject: '', questionType: '', kpIds: [], layoutMode: 'PLAIN', unitKind: 'SINGLE', paginationMode: 'FLOW', layoutNote: '' })
const previewMetadata = ref([])
function changeTemplateKind(value) {
  if (value === 'KNOWLEDGE' && !knowledgeTypes.includes(templateMeta.questionType)) templateMeta.questionType = 'KNOWLEDGE_REVIEW'
  if (value === 'EXERCISE' && knowledgeTypes.includes(templateMeta.questionType)) templateMeta.questionType = ''
}
function metadataLabel(field, row) {
  if (row[field]) return label(field, row[field])
  if (row.intent === 'update') return '保留线上值'
  if (field === 'contentKind') return label('contentKind', 'EXERCISE')
  const defaults = { layoutMode: 'PLAIN', unitKind: 'SINGLE', paginationMode: 'FLOW' }
  if (defaults[field]) return label(field, defaults[field])
  return '待补充'
}
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
const user = useUserStore()
const pendingImport = shallowRef(null), importFailure = ref('')
watch(() => [user.id, user.name], () => {
  pendingImport.value = null; importFailure.value = ''; open.value = false; result.value = null
  previewRequests.invalidate(); batchRequests.invalidate(); schemaRequests.invalidate()
})
const lastBatchKey = computed(() => `knowledge:last-import-batch:${user.id || user.name}`)
const previewRequests = createRequestGeneration(), batchRequests = createRequestGeneration(), schemaRequests = createRequestGeneration()
watch(open, (visible) => {
  clearInterval(leaseTimer)
  if (!visible) { previewRequests.invalidate(); batchRequests.invalidate(); schemaRequests.invalidate() }
  leaseNow.value = Date.now()
  if (visible)
    leaseTimer = setInterval(() => {
      leaseNow.value = Date.now()
    }, 1000)
})
onBeforeUnmount(() => { clearInterval(leaseTimer); previewRequests.invalidate(); batchRequests.invalidate(); schemaRequests.invalidate() })
const leaseActive = computed(
  () =>
    result.value?.leaseUntil &&
    Date.parse(String(result.value.leaseUntil).replace(' ', 'T')) >
      leaseNow.value
)
const recoveryNotice = computed(() => {
  if (result.value?.status === 'RECEIVING')
    return '原输入尚未接收完整。请使用原提交入口重传相同请求，保留原提交标识和全部资源；此状态不能直接恢复处理。'
  if (result.value?.status === 'PROCESSING')
    return !result.value.inputReady
      ? '输入文件尚未准备完整，请补传原文件后重试。'
      : leaseActive.value
        ? '当前批次仍在执行，请稍后刷新结果；处理占用期间不能重复恢复。'
        : '输入文件已完整接收，处理占用已过期。可恢复尚未完成的题目，已有成功结果会保留。'
  if (['PARTIAL', 'FAILED'].includes(result.value?.status))
    return '本批次结果已固定。失败内容请修正后使用新的提交标识重新导入，已有成功内容不会因刷新结果重复创建。'
  return ''
})
const intentLabel = { create: '新建', update: '更新原题', derive: '新建变式' }
const dialogTitle = computed(() =>
  mode.value === 'derive'
    ? '上传 HTML 新建变式'
    : mode.value === 'update'
      ? '上传 HTML 更新正文'
      : '上传 HTML 新建题目 / 导出回流'
)
const newKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `import-${Date.now()}-${Math.random().toString(36).slice(2)}`
async function show(intent = 'create', record = null) {
  if (busy.value || pendingImport.value) { open.value = true; return }
  importFailure.value = ''
  const schemaTicket = schemaRequests.start()
  Object.assign(derivation, {
    operation: 'OTHER',
    changeNote: '',
    preservedNote: '',
    auxiliaryParentIds: []
  })
  mode.value = intent
  question.value = record
  sourceIds.value = []
  Object.assign(templateMeta, { contentKind: question.value?.contentKind || 'EXERCISE', subject: question.value?.subject || '', questionType: question.value?.questionType || '', kpIds: [...(question.value?.kpIds || [])], layoutMode: question.value?.layoutMode || 'PLAIN', unitKind: question.value?.unitKind || 'SINGLE', paginationMode: question.value?.paginationMode || 'FLOW', layoutNote: question.value?.layoutNote || '' })
  previewMetadata.value = []
  htmlFiles.value = []
  htmlFile.value = null
  resourceFiles.value = []
  result.value = null
  previewHtml.value = ''
  preflightError.value = ''
  idempotencyKey.value = newKey()
  try {
    batchLookup.value =
      JSON.parse(sessionStorage.getItem(lastBatchKey.value) || '{}').batchId || ''
  } catch {
    batchLookup.value = ''
  }
  open.value = true
  try {
    const schema = (await knowledgeRequest('/import/schema')).data
    if (schemaRequests.current(schemaTicket)) instanceId.value = schema.instanceId
  } catch {
    if (schemaRequests.current(schemaTicket)) instanceId.value = ''
  }
}
function clearHtml() {
  previewRequests.invalidate()
  htmlFile.value = null
  previewHtml.value = ''
  preflightError.value = ''
  result.value = null
  previewMetadata.value = []
}
async function selectHtml(item) {
  const originalKey =
    result.value?.status === 'RECEIVING'
      ? result.value.idempotencyKey || idempotencyKey.value
      : null
  clearHtml()
  const ticket = previewRequests.start()
  htmlFile.value = item.raw
  idempotencyKey.value = originalKey || newKey()
  if (item.raw.size > 2 * 1024 * 1024) {
    preflightError.value = 'HTML 文件不能超过 2 MB'
    return
  }
  const text = await item.raw.text()
  if (!previewRequests.current(ticket)) return
  const documentHtml = new DOMParser().parseFromString(text, 'text/html')
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
  previewHtml.value = articles
    .map(article => {
      const stem = article.querySelector(':scope > [data-part="stem"]')?.innerHTML || '<p>缺少题干区域</p>'
      const options = article.querySelector(':scope > [data-part="options"]')
      return stem + (options ? `<div data-kb-role="options">${options.innerHTML}</div>` : '')
    })
    .join('<hr>')
  for (const article of articles) {
    let metadata
    try {
      metadata = JSON.parse(article.querySelector('script[data-kb-metadata]')?.textContent || '{}')
    } catch {
      preflightError.value = '内容元数据 JSON 格式错误，请检查 data-kb-metadata 区域'
      return
    }
    const itemCount = article.querySelector(':scope > [data-part="stem"] [data-kb-role="group"]')?.querySelectorAll(':scope > [data-item-key]').length || 1
    const exceptionId = article.dataset.granularityExceptionId || ''
    previewMetadata.value.push({ ...metadata, title: metadata.title || article.dataset.clientKey, intent: article.dataset.intent, itemCount, granularityExceptionId: exceptionId })
    const reviewError = calculationPreflight(metadata, article.dataset.intent, itemCount, exceptionId) || derivePreflight(article.dataset, mode.value === 'derive' ? question.value : null)
    if (reviewError) { preflightError.value = reviewError; return }
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
      contentKind: templateMeta.contentKind,
      subject: templateMeta.subject || '',
      questionType: templateMeta.questionType || '',
      difficulty: q.difficulty || '',
      layoutMode: templateMeta.layoutMode,
      unitKind: templateMeta.unitKind,
      paginationMode: templateMeta.paginationMode,
      layoutNote: templateMeta.layoutNote,
      kpIds: templateMeta.kpIds || [],
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
        ? ` data-parent-id="${escapeAttribute(q.id)}" data-expected-parent-row-version="${escapeAttribute(q.rowVersion)}" data-expected-parent-stem-hash="${escapeAttribute(q.stemHash)}" data-expected-parent-content-hash="${escapeAttribute(q.contentHash)}"`
        : ''
  const groupCount = templateMeta.questionType === 'CALCULATION' ? 3 : 2
  const group = `<div data-kb-role="group" data-columns="2">${Array.from({ length: groupCount }, (_, index) => `<div data-item-key="${index + 1}"><p>（${index + 1}）请填写第 ${index + 1} 项。</p></div>`).join('')}</div>`
  const parts = {
    stem: q.stemHtml || (templateMeta.unitKind === 'GROUP' ? group : '<p>请在本地填写题干，图片与此文件一同上传。</p>'),
    answer: q.answerHtml || (templateMeta.unitKind === 'GROUP' ? group : '<p>请在本地填写答案。</p>'),
    analysis: q.analysisHtml || ''
  }
  const html = buildExchangeHtml(metadata, parts, mode.value, mode.value === 'update' ? `question-${q.id}` : newKey(), attrs)
  saveAs(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    `${intentLabel[mode.value]}模板.html`
  )
}
function buildExchangeHtml(metadata, parts, intent = 'create', clientKey = newKey(), attrs = '') {
  const json = JSON.stringify(metadata, null, 2).replaceAll('<', '\\u003c')
  const options = parts.options ? `\n<section data-part="options">${parts.options}</section>` : ''
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="kb-schema" content="kb-question-html/v1"><meta name="kb-origin" content="${escapeAttribute(instanceId.value)}"><title>题目交换模板</title><style>body{font:16px/1.8 sans-serif}section[data-part=answer],section[data-part=analysis]{color:red}table,td,th{border:1px solid black;border-collapse:collapse}svg,img{max-width:100%;height:auto}${questionLayoutCss}section[data-part=options]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px}</style></head><body>\n<article data-client-key="${escapeAttribute(clientKey)}" data-intent="${intent}" data-pagination-mode="${escapeAttribute(metadata.paginationMode || 'FLOW')}"${attrs}>\n<script type="application/json" data-kb-metadata>${json}<\/script>\n<section data-part="stem">${parts.stem}</section>${options}\n<section data-part="answer">${parts.answer || ''}</section>\n<section data-part="analysis">${parts.analysis || ''}</section>\n</article></body></html>`
}
function downloadExample(key) {
  const example = exchangeExamples.find(item => item.key === key)
  if (!example) return
  saveAs(new Blob([buildExchangeHtml(example.metadata, example)], { type: 'text/html;charset=utf-8' }), `${example.label}-结构示例.html`)
  ElMessage.info('已下载结构示例；请按实际内容修改正文并补充关联考点后导入。')
}
async function exportOriginal() {
  exporting.value = true
  try {
    await exportQuestions(
      { questionIds: [question.value.id], includeAnswers: true, purpose: 'MAINTENANCE' },
      `${question.value.title || '题目'}-资源包.zip`
    )
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
async function submit() {
  if (busy.value || !htmlFile.value || preflightError.value) return
  if (!idempotencyKey.value.trim()) return ElMessage.warning('请填写提交标识')
  const accountKey = lastBatchKey.value
  if (!pendingImport.value) pendingImport.value = {
    file: htmlFile.value,
    resources: resourceFiles.value.map(item => item.raw),
    fields: { idempotencyKey: idempotencyKey.value.trim(), sourceId: sourceIds.value[0] }
  }
  const submission = pendingImport.value
  busy.value = true; importFailure.value = ''
  try {
    const batch = (await importHtml(submission.file, submission.resources, submission.fields)).data
    if (lastBatchKey.value !== accountKey) return
    if (!batch?.batchId) throw new Error('未取得批次回执，请保留原请求重试')
    pendingImport.value = batch.status === 'RECEIVING' ? submission : null
    applyBatch(batch)
    emit('completed', result.value)
  } catch (failure) {
    if (lastBatchKey.value !== accountKey) return
    if (knownReviewRejection(failure)) pendingImport.value = null
    importFailure.value = failure.message || '提交结果未知，请保留原文件与提交标识重试'
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
      lastBatchKey.value,
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
  const ticket = batchRequests.start()
  readingBatch.value = true
  try {
    const batch = (await knowledgeRequest(`/import/${batchId}`)).data
    if (!batchRequests.current(ticket)) return null
    applyBatch(batch)
    if (['SUCCESS', 'PARTIAL', 'FAILED'].includes(result.value.status))
      emit('completed', result.value)
    return result.value
  } catch {
    /* Request interceptor displays the server error. */
    return null
  } finally {
    if (batchRequests.current(ticket)) readingBatch.value = false
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
