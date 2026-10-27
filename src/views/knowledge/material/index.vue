<template>
  <div class="knowledge-page">
    <resource-list
      ref="listRef"
      type="material"
      :action-width="460"
      @add="edit()"
      @edit="edit"
      @detail="edit"
    >
      <template #filters="{ query }">
        <el-form-item label="选题模式">
          <enum-select
            v-model="query.selectionMode"
            field="selectionMode"
            clearable
            style="width: 230px"
          />
        </el-form-item>
      </template>
      <template #columns>
        <el-table-column label="选题模式" min-width="230">
          <template #default="{ row }">
            {{ label('selectionMode', row.selectionMode) }}
          </template>
        </el-table-column>
        <el-table-column label="题目数" prop="questionCount" width="100" />
      </template>
      <template #actions="{ row }">
        <el-button v-hasPermi="['knowledge:render:add']" link type="primary" @click="generateRef.show({ materialId: row.id })">模板生成</el-button>
        <el-button
          v-hasPermi="['knowledge:material:query']"
          link
          type="primary"
          @click="compare(row)"
        >
          考点对照
        </el-button>
        <el-button
          v-hasPermi="['knowledge:question:export']"
          link
          type="primary"
          :loading="exporting === row.id"
          @click="download(row)"
        >
          导出
        </el-button>
      </template>
    </resource-list>
    <el-dialog
      v-model="open"
      :title="form.id ? '编辑专项 / 组织选题' : '新增专项'"
      width="min(1250px, 95vw)"
      append-to-body
      destroy-on-close
      :close-on-click-modal="!saving"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="110px"
        :disabled="saving || !canSave"
      >
        <el-form-item label="专项名称" prop="title">
          <el-input v-model="form.title" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="专项说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="主考点">
          <record-picker v-model="kpIds" type="kp" :multiple="false" />
        </el-form-item>
        <el-form-item label="选题模式">
          <enum-select v-model="form.selectionMode" field="selectionMode" />
        </el-form-item>
        <el-form-item label="参考来源">
          <record-picker
            v-model="referenceIds"
            type="source"
            @change="syncReferences"
          />
          <div class="form-hint">
            选择实际参考的来源；“仅真题”要求每题在此范围中存在当前有效的核实出处。
          </div>
        </el-form-item>
        <el-table
          v-if="form.referenceSources?.length"
          :data="form.referenceSources"
          size="small"
          class="reference-table"
        >
          <el-table-column label="参考来源" min-width="230">
            <template #default="{ row }">
              <relation-names type="source" :ids="[row.sourceId]" />
            </template>
          </el-table-column>
          <el-table-column label="使用说明" min-width="300">
            <template #default="{ row }">
              <el-input
                v-model="row.note"
                placeholder="说明这份来源用于什么参考"
              />
            </template>
          </el-table-column>
        </el-table>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <el-divider content-position="left">专项题目与顺序</el-divider>
      <el-alert
        v-if="form.selectionMode === 'EXAM_ONLY'"
        title="仅限指定参考范围内、来源及出处均核实且题干仍一致的真题。变式不继承母题真题身份；不合格选择会被后端拒绝。"
        type="warning"
        :closable="false"
        class="mb8"
      />
      <div v-if="canSave" class="material-tools">
        <el-button
          type="primary"
          plain
          icon="Plus"
          :loading="saving"
          @click="chooseQuestions"
        >
          {{ form.id ? '保存并打开候选题' : '保存专项并开始选题' }}
        </el-button>
        <el-button :disabled="!form.id" @click="validateSelection">
          保存并校验选题
        </el-button>
        <el-button :disabled="!form.id" @click="compareCurrent">
          保存并考点对照
        </el-button>
      </div>
      <el-alert
        v-if="validationMessage"
        :title="validationMessage"
        :type="form.selectionValid ? 'success' : 'warning'"
        :closable="false"
        class="mb8"
      />
      <el-table
        :data="selectedQuestions"
        empty-text="尚未选择题目，请打开候选题添加"
      >
        <el-table-column label="顺序" type="index" width="70" />
        <el-table-column label="题目" min-width="250">
          <template #default="{ row }">
            <el-button link type="primary" @click="questionDetailRef.show(row)">
              {{ row.title }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="创作类型" width="120">
          <template #default="{ row }">
            {{ label('creationKind', row.creationKind) }}
          </template>
        </el-table-column>
        <el-table-column label="内容 / 题型" width="160">
          <template #default="{ row }">{{ label('contentKind', row.contentKind) }}<br>{{ label('questionType', row.questionType) }}</template>
        </el-table-column>
        <el-table-column label="真题身份" width="120">
          <template #default="{ row }">
            {{ row.isRealExam ? '有效真题' : '无有效证明' }}
          </template>
        </el-table-column>
        <el-table-column label="当前可用性" min-width="230"><template #default="{ row }"><el-tag v-if="unavailable(row)" type="warning">当前不可用，保留原引用</el-tag><span v-else>待正式取用时复核</span><div v-if="unavailable(row)">{{ row.readinessReasons?.join('；') || '请检查题目状态与当前批准依据' }}</div></template></el-table-column>
        <el-table-column v-if="canSave" label="操作" width="180" fixed="right">
          <template #default="{ $index }">
            <el-button
              link
              type="primary"
              :disabled="$index === 0"
              @click="move($index, -1)"
            >
              上移
            </el-button>
            <el-button
              link
              type="primary"
              :disabled="$index === selectedQuestions.length - 1"
              @click="move($index, 1)"
            >
              下移
            </el-button>
            <el-button link type="danger" @click="removeQuestion($index)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button
          v-if="canSave"
          type="primary"
          :loading="saving"
          @click="save(true)"
        >
          保存专项
        </el-button>
        <el-button
          v-if="canSave"
          v-hasPermi="['knowledge:question:export']"
          :disabled="!form.id"
          :loading="exporting === form.id"
          @click="downloadCurrent"
        >
          保存并导出资源包
        </el-button>
        <el-button @click="open = false">关闭</el-button>
      </template>
    </el-dialog>
    <material-question-picker ref="candidateRef" :selected="selectedQuestions" :saving="saving" @add="addQuestion" @save="saveCandidates" @detail="row => questionDetailRef.show(row)" />
    <el-drawer
      v-model="comparisonOpen"
      :title="`考点对照 · ${comparisonMaterial.title || ''}`"
      size="90%"
      destroy-on-close
    >
      <el-form inline>
        <el-form-item label="比较范围">
          <el-radio-group v-model="comparisonScope" @change="resetComparison">
            <el-radio-button value="REFERENCE">指定参考范围</el-radio-button>
            <el-radio-button value="ALL">扩大到全库来源</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="expandKp" @change="resetComparison">
            展开嵌套 / 组合考点
          </el-checkbox>
        </el-form-item>
        <el-button icon="Refresh" @click="loadComparison">刷新对照</el-button>
      </el-form>
      <el-alert
        :title="
          comparison.notice ||
          '共同考点仅表明知识联系，不代表同题、相同考法或质量结论。'
        "
        type="info"
        :closable="false"
      />
      <div v-loading="comparisonLoading">
        <h4>范围内相关真题与共同考点</h4>
        <el-table
          :data="comparison.matches || []"
          empty-text="当前范围没有匹配；请同时查看下方来源覆盖情况，不能据此认定来源没有相关考点"
        >
          <el-table-column label="来源" prop="sourceTitle" min-width="200" />
          <el-table-column label="相关真题" min-width="230">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                @click="questionDetailRef.show({ id: row.questionId })"
              >
                {{ row.questionTitle }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="共同考点" prop="kpName" min-width="160" />
          <el-table-column label="题号" prop="questionNo" width="100" />
          <el-table-column label="页码" width="100">
            <template #default="{ row }">
              {{ row.pageFrom || '—'
              }}{{
                row.pageTo && row.pageTo !== row.pageFrom ? `～${row.pageTo}` : ''
              }}
            </template>
          </el-table-column>
        </el-table>
        <pagination
          v-show="Number(comparison.matchTotal) > 0"
          :total="Number(comparison.matchTotal || 0)"
          v-model:page="comparisonPages.matchPageNum"
          v-model:limit="comparisonPages.matchPageSize"
          @pagination="loadComparison"
        />
        <h4>来源覆盖与未比较原因</h4>
        <el-table
          :data="comparison.coverage || []"
          empty-text="此范围尚未指定来源"
        >
          <el-table-column label="来源" prop="sourceTitle" min-width="220" />
          <el-table-column label="抽题进度" width="130">
            <template #default="{ row }">
              {{ label('extractionStatus', row.extractionStatus) }}
            </template>
          </el-table-column>
          <el-table-column label="比较状态" width="170">
            <template #default="{ row }">
              {{ label('comparisonStatus', row.comparisonStatus) }}
            </template>
          </el-table-column>
          <el-table-column label="实际含义" prop="notice" min-width="320" />
        </el-table>
        <pagination
          v-show="Number(comparison.coverageTotal) > 0"
          :total="Number(comparison.coverageTotal || 0)"
          v-model:page="comparisonPages.coveragePageNum"
          v-model:limit="comparisonPages.coveragePageSize"
          @pagination="loadComparison"
        />
      </div>
    </el-drawer>
    <question-detail ref="questionDetailRef" @changed="refreshSelected" />
    <generate-dialog ref="generateRef" />
  </div>
</template>
<script setup name="KnowledgeMaterial">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import RelationNames from '../components/RelationNames.vue'
import EnumSelect from '../components/EnumSelect.vue'
import QuestionDetail from '../components/QuestionDetail.vue'
import GenerateDialog from '../components/GenerateDialog.vue'
import MaterialQuestionPicker from '../components/MaterialQuestionPicker.vue'
import { getMaterialComparison, validateMaterial } from '@/api/knowledge/material'
import { createRequestGeneration } from '@/utils/request-generation'
import { materialQuestions } from '../components/materialSelection'
import {
  getRecord,
  saveRecord,
  exportQuestions
} from '@/api/knowledge'
import { label } from '../components/labels'
import { ElMessage } from 'element-plus'
import { checkPermi } from '@/utils/permission'
const listRef = ref(),
  generateRef = ref(),
  candidateRef = ref(),
  formRef = ref(),
  questionDetailRef = ref(),
  form = ref({}),
  open = ref(false),
  saving = ref(false),
  kpIds = ref([]),
  referenceIds = ref([]),
  selectedQuestions = ref([]),
  validationMessage = ref(''),
  exporting = ref(null)
const canSave = computed(() =>
  checkPermi([
    form.value.id ? 'knowledge:material:edit' : 'knowledge:material:add'
  ])
)
const comparisonPages = reactive({
  matchPageNum: 1,
  matchPageSize: 10,
  coveragePageNum: 1,
  coveragePageSize: 10
})
const comparisonOpen = ref(false),
  comparisonLoading = ref(false),
  comparisonMaterial = ref({}),
  comparison = ref({}),
  comparisonScope = ref('REFERENCE'),
  expandKp = ref(true)
const detailRequests = createRequestGeneration()
const comparisonRequests = createRequestGeneration()
watch(open, visible => { if (!visible) detailRequests.invalidate() })
watch(comparisonOpen, visible => { if (!visible) comparisonRequests.invalidate() })
onBeforeUnmount(() => { detailRequests.invalidate(); comparisonRequests.invalidate() })
const rules = {
  title: [{ required: true, message: '请填写专项名称', trigger: 'blur' }]
}
async function edit(row) {
  const ticket = detailRequests.start()
  saving.value = false
  const record = row?.id
    ? (await getRecord('material', row.id)).data
    : {
        title: '',
        selectionMode: 'MIXED',
        questionIds: [],
        referenceSources: []
      }
  if (!detailRequests.current(ticket)) return
  form.value = record
  form.value.questionIds ||= []
  form.value.referenceSources ||= []
  kpIds.value = form.value.kpId ? [form.value.kpId] : []
  referenceIds.value = form.value.referenceSources.map((item) => item.sourceId)
  selectedQuestions.value = materialQuestions(form.value)
  validationMessage.value = ''
  open.value = true
}
function syncReferences(items) {
  form.value.referenceSources = items.map((item) => ({
    sourceId: item.id,
    note:
      form.value.referenceSources.find(
        (old) => String(old.sourceId) === String(item.id)
      )?.note || ''
  }))
}
async function save(close = false) {
  if (!(await formRef.value.validate().catch(() => false))) return false
  if (form.value.selectionMode === 'EXAM_ONLY' && !referenceIds.value.length) {
    ElMessage.warning('仅真题模式必须选择参考来源')
    return false
  }
  const ticket = detailRequests.start()
  saving.value = true
  try {
    const response = await saveRecord('material', {
      id: form.value.id,
      rowVersion: form.value.rowVersion,
      title: form.value.title,
      description: form.value.description,
      selectionMode: form.value.selectionMode,
      referenceSources: form.value.referenceSources,
      remark: form.value.remark,
      kpId: kpIds.value[0] || null,
      questionIds: selectedQuestions.value.map((item) => item.id)
    })
    if (!detailRequests.current(ticket)) return false
    form.value = response.data
    form.value.questionIds ||= selectedQuestions.value.map((item) => item.id)
    form.value.referenceSources ||= []
    selectedQuestions.value = materialQuestions(form.value, selectedQuestions.value)
    ElMessage.success('专项保存成功')
    listRef.value.reload()
    if (close) open.value = false
    return true
  } catch {
    return false
  } finally {
    if (detailRequests.current(ticket)) saving.value = false
  }
}
async function chooseQuestions() {
  if (await save()) await candidateRef.value.show(form.value)
}
function addQuestion(row) {
  if (
    selectedQuestions.value.some((item) => String(item.id) === String(row.id))
  )
    return
  selectedQuestions.value.push(row)
  form.value.questionIds = selectedQuestions.value.map((item) => item.id)
  validationMessage.value = ''
  ElMessage.success('已加入待保存选题')
}
function removeQuestion(index) {
  selectedQuestions.value.splice(index, 1)
  form.value.questionIds = selectedQuestions.value.map((item) => item.id)
  validationMessage.value = ''
}
function move(index, offset) {
  const item = selectedQuestions.value.splice(index, 1)[0]
  selectedQuestions.value.splice(index + offset, 0, item)
  form.value.questionIds = selectedQuestions.value.map((item) => item.id)
}
async function saveCandidates() {
  if (await save()) candidateRef.value.close()
}
async function validateSelection() {
  if (!(await save())) return
  const response = await validateMaterial(form.value.id)
  form.value.selectionValid = response.data.selectionValid
  form.value.unavailableQuestionIds = response.data.unavailableQuestionIds || []
  validationMessage.value = response.data.selectionValid
    ? '服务端校验通过：当前选题符合专项规则'
    : `当前题单尚不可正式使用，请检查参考范围、核实与批准依据${form.value.unavailableQuestionIds.length ? `；不可用题目：${form.value.unavailableQuestionIds.join('、')}` : ''}`
}
function unavailable(row) {
  return row.unavailable || row.status !== 'READY' || (form.value.unavailableQuestionIds || []).some(id => String(id) === String(row.id))
}
async function compare(row) {
  comparisonMaterial.value = { ...row }
  comparisonScope.value = 'REFERENCE'
  comparisonOpen.value = true
  await resetComparison()
}
function resetComparison() {
  comparisonPages.matchPageNum = 1
  comparisonPages.coveragePageNum = 1
  return loadComparison()
}
async function compareCurrent() {
  if (await save()) await compare(form.value)
}
async function loadComparison() {
  const ticket = comparisonRequests.start()
  comparisonLoading.value = true
  try {
    const result = (
      await getMaterialComparison(comparisonMaterial.value.id, {
          scope: comparisonScope.value,
          expand: expandKp.value,
          ...comparisonPages
        }
      )
    ).data
    if (comparisonRequests.current(ticket)) comparison.value = result
  } finally {
    if (comparisonRequests.current(ticket)) comparisonLoading.value = false
  }
}
async function download(row) {
  exporting.value = row.id
  try {
    await exportQuestions(
      { materialId: row.id, includeAnswers: true, purpose: 'NORMAL' },
      `${row.title}-资源包.zip`
    )
    ElMessage.success('专项资源包已下载；重新排版后可在成品页面另存版本')
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = null
  }
}
async function downloadCurrent() {
  if (await save()) await download(form.value)
}
async function refreshSelected(updated) {
  const ticket = detailRequests.start(), id = form.value.id
  if (updated?.id) selectedQuestions.value = selectedQuestions.value.map(item => String(item.id) === String(updated.id) ? updated : item)
  if (open.value && form.value.id) {
    const current = (await getRecord('material', id)).data
    if (!detailRequests.current(ticket) || String(form.value.id) !== String(id)) return
    const byId = new Map((current.questions || []).map(item => [String(item.id), item]))
    selectedQuestions.value = selectedQuestions.value.map(item => byId.get(String(item.id)) || item)
    form.value.selectionValid = current.selectionValid
    form.value.unavailableQuestionIds = current.unavailableQuestionIds || []
  }
  listRef.value.reload()
}

</script>
<style scoped>
.form-hint {
  font-size: 12px;
  color: #909399;
  width: 100%;
  margin-top: 4px;
}
.material-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.reference-table {
  margin: 0 0 18px 110px;
  width: calc(100% - 110px);
}
.selection-count {
  margin-right: 16px;
  color: #606266;
}
h4 {
  margin-top: 24px;
}
</style>
