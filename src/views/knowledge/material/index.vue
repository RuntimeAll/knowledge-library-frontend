<template>
  <resource-list
    ref="listRef"
    type="material"
    :action-width="370"
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
    width="1050px"
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
      <el-table-column label="真题身份" width="120">
        <template #default="{ row }">
          {{ row.isRealExam ? '有效真题' : '无有效证明' }}
        </template>
      </el-table-column>
      <el-table-column v-if="canSave" label="操作" width="180">
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
  <el-dialog
    v-model="candidateOpen"
    title="专项候选题（服务端分页）"
    width="1000px"
    append-to-body
    destroy-on-close
  >
    <el-alert
      :title="
        form.selectionMode === 'EXAM_ONLY'
          ? '后端已限定为参考范围内的合格真题；没有候选时请先检查来源核实、出处核实与题干一致性。'
          : '混合模式允许选择自编题和变式；参考来源用于考点比较，不自动限制混合候选。'
      "
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-form inline @submit.prevent="searchCandidates">
      <el-form-item label="标题">
        <el-input
          v-model="candidateQuery.title"
          clearable
          @keyup.enter="searchCandidates"
        />
      </el-form-item>
      <el-form-item label="题干关键词">
        <el-input
          v-model="candidateQuery.query"
          clearable
          @keyup.enter="searchCandidates"
        />
      </el-form-item>
      <el-form-item label="范围">
        <el-select
          v-model="candidateQuery.scope"
          style="width: 150px"
          @change="searchCandidates"
        >
          <el-option label="参考来源范围" value="REFERENCE" />
          <el-option
            v-if="form.selectionMode !== 'EXAM_ONLY'"
            label="全部题库"
            value="ALL"
          />
        </el-select>
      </el-form-item>
      <el-button type="primary" icon="Search" @click="searchCandidates">
        搜索
      </el-button>
    </el-form>
    <el-table
      v-loading="candidateLoading"
      :data="candidates"
      empty-text="无符合条件的候选题"
    >
      <el-table-column label="题目" min-width="250">
        <template #default="{ row }">
          <el-button link type="primary" @click="questionDetailRef.show(row)">
            {{ row.title }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          {{ label('status', row.status) }}
        </template>
      </el-table-column>
      <el-table-column label="创作类型" width="110">
        <template #default="{ row }">
          {{ label('creationKind', row.creationKind) }}
        </template>
      </el-table-column>
      <el-table-column label="考点" min-width="200">
        <template #default="{ row }">
          <relation-names type="kp" :ids="row.kpIds" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="
              form.questionIds.some((id) => String(id) === String(row.id))
            "
            @click="addQuestion(row)"
          >
            {{
              form.questionIds.some((id) => String(id) === String(row.id))
                ? '已加入'
                : '加入专项'
            }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <pagination
      v-show="candidateTotal > 0"
      :total="candidateTotal"
      v-model:page="candidateQuery.pageNum"
      v-model:limit="candidateQuery.pageSize"
      @pagination="loadCandidates"
    />
    <template #footer>
      <span class="selection-count">
        已选 {{ selectedQuestions.length }} 题
      </span>
      <el-button type="primary" :loading="saving" @click="saveCandidates">
        保存所选题目
      </el-button>
      <el-button @click="candidateOpen = false">返回专项</el-button>
    </template>
  </el-dialog>
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
</template>
<script setup name="KnowledgeMaterial">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import RelationNames from '../components/RelationNames.vue'
import EnumSelect from '../components/EnumSelect.vue'
import QuestionDetail from '../components/QuestionDetail.vue'
import {
  getRecord,
  saveRecord,
  knowledgeRequest,
  exportQuestions
} from '@/api/knowledge'
import { label } from '../components/labels'
import { ElMessage } from 'element-plus'
import { checkPermi } from '@/utils/permission'
const listRef = ref(),
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
const candidateOpen = ref(false),
  candidateLoading = ref(false),
  candidates = ref([]),
  candidateTotal = ref(0),
  candidateQuery = reactive({
    pageNum: 1,
    pageSize: 10,
    title: '',
    query: '',
    scope: 'REFERENCE'
  })
const comparisonOpen = ref(false),
  comparisonLoading = ref(false),
  comparisonMaterial = ref({}),
  comparison = ref({}),
  comparisonScope = ref('REFERENCE'),
  expandKp = ref(true)
const rules = {
  title: [{ required: true, message: '请填写专项名称', trigger: 'blur' }]
}
async function edit(row) {
  form.value = row?.id
    ? (await getRecord('material', row.id)).data
    : {
        title: '',
        selectionMode: 'MIXED',
        questionIds: [],
        referenceSources: []
      }
  form.value.questionIds ||= []
  form.value.referenceSources ||= []
  kpIds.value = form.value.kpId ? [form.value.kpId] : []
  referenceIds.value = form.value.referenceSources.map((item) => item.sourceId)
  selectedQuestions.value = form.value.questions || []
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
  saving.value = true
  try {
    const response = await saveRecord('material', {
      ...form.value,
      questions: undefined,
      kpId: kpIds.value[0] || null,
      questionIds: selectedQuestions.value.map((item) => item.id)
    })
    form.value = response.data
    form.value.questionIds ||= selectedQuestions.value.map((item) => item.id)
    form.value.referenceSources ||= []
    ElMessage.success('专项保存成功')
    listRef.value.reload()
    if (close) open.value = false
    return true
  } catch {
    return false
  } finally {
    saving.value = false
  }
}
async function chooseQuestions() {
  if (!(await save())) return
  candidateQuery.pageNum = 1
  candidateQuery.scope =
    form.value.selectionMode === 'EXAM_ONLY' ? 'REFERENCE' : 'ALL'
  candidateOpen.value = true
  await loadCandidates()
}
async function loadCandidates() {
  candidateLoading.value = true
  try {
    const response = await knowledgeRequest(
      `/material/${form.value.id}/candidates`,
      'get',
      undefined,
      candidateQuery
    )
    candidates.value = response.rows || []
    candidateTotal.value = Number(response.total || 0)
  } finally {
    candidateLoading.value = false
  }
}
function searchCandidates() {
  candidateQuery.pageNum = 1
  loadCandidates()
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
  if (await save()) candidateOpen.value = false
}
async function validateSelection() {
  if (!(await save())) return
  const response = await knowledgeRequest(`/material/${form.value.id}/validate`)
  form.value.selectionValid = response.data.selectionValid
  validationMessage.value = response.data.selectionValid
    ? '服务端校验通过：当前选题符合专项规则'
    : '当前选题不符合参考范围或核实规则，请调整选题'
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
  comparisonLoading.value = true
  try {
    comparison.value = (
      await knowledgeRequest(
        `/material/${comparisonMaterial.value.id}/comparison`,
        'get',
        undefined,
        {
          scope: comparisonScope.value,
          expand: expandKp.value,
          ...comparisonPages
        }
      )
    ).data
  } finally {
    comparisonLoading.value = false
  }
}
async function download(row) {
  exporting.value = row.id
  try {
    await exportQuestions(
      { materialId: row.id, includeAnswers: true },
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
async function refreshSelected() {
  selectedQuestions.value = await Promise.all(
    selectedQuestions.value.map((item) =>
      getRecord('question', item.id).then((r) => r.data)
    )
  )
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
