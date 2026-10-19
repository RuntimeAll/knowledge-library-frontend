<template>
  <el-drawer
    v-model="open"
    :title="`内容详情 · ${question.title || ''}`"
    size="85%"
    destroy-on-close
  >
    <div v-loading="loading">
      <div class="detail-toolbar">
        <el-button
          v-hasPermi="['knowledge:question:edit']"
          type="primary"
          plain
          icon="Edit"
          @click="editorRef.show(question)"
        >
          编辑元数据
        </el-button>
        <el-button
          v-hasPermi="['knowledge:import:execute']"
          icon="Upload"
          @click="importRef.show('update', question)"
        >
          上传 HTML 更新正文
        </el-button>
        <el-button
          v-hasPermi="['knowledge:import:execute']"
          icon="Plus"
          @click="importRef.show('derive', question)"
        >
          上传变式
        </el-button>
        <el-button
          v-hasPermi="['knowledge:question:export']"
          icon="Download"
          :loading="exporting"
          @click="download"
        >
          导出资源包
        </el-button>
      </div>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="内容类型">
          <classification-tag field="contentKind" :value="question.contentKind" />
        </el-descriptions-item>
        <el-descriptions-item label="编号">
          {{ question.id }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          {{ label('status', question.status) }}
        </el-descriptions-item>
        <el-descriptions-item label="创作类型">
          {{ label('creationKind', question.creationKind) }}
        </el-descriptions-item>
        <el-descriptions-item label="学科">
          <classification-tag field="subject" :value="question.subject" />
        </el-descriptions-item>
        <el-descriptions-item :label="question.contentKind === 'KNOWLEDGE' ? '知识类型' : '题型'">
          <classification-tag
            field="questionType"
            :value="question.questionType"
          />
        </el-descriptions-item>
        <el-descriptions-item label="难度">
          <classification-tag field="difficulty" :value="question.difficulty" />
        </el-descriptions-item>
        <el-descriptions-item label="呈现方式">{{ label('layoutMode', question.layoutMode) }}</el-descriptions-item>
        <el-descriptions-item label="内容单元">
          {{ label('unitKind', question.unitKind) }}<span v-if="question.unitKind === 'GROUP'"> · {{ question.itemCount }} 项（整体复用）</span>
        </el-descriptions-item>
        <el-descriptions-item label="分页方式">{{ label('paginationMode', question.paginationMode) }}</el-descriptions-item>
        <el-descriptions-item v-if="question.layoutNote" label="排版说明" :span="3">{{ question.layoutNote }}</el-descriptions-item>
        <el-descriptions-item label="真题身份">
          <el-tag :type="question.isRealExam ? 'success' : 'info'">
            {{ question.isRealExam ? '当前有效真题' : '当前无有效真题证明' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="行版本">
          {{ question.rowVersion }}
        </el-descriptions-item>
        <el-descriptions-item label="考点">
          <relation-names type="kp" :ids="question.kpIds" />
        </el-descriptions-item>
      </el-descriptions>
      <el-alert v-if="queryMatchReasons.length" :title="`本次查询命中：${queryMatchReasons.join('；')}`" type="info" :closable="false" class="detail-alert" />
      <template v-for="group in matchedGroups" :key="group.title">
        <template v-if="group.rows.length">
          <h4>{{ group.title }}</h4>
          <el-table :data="group.rows">
            <el-table-column label="实际来源" min-width="200"><template #default="{ row }"><span v-if="row.sourceTitle">{{ row.sourceTitle }}</span><relation-names v-else type="source" :ids="[row.sourceId]" /></template></el-table-column>
            <el-table-column label="原题号" prop="questionNo" width="100" />
            <el-table-column label="页码" width="120"><template #default="{ row }">{{ row.pageFrom || '—' }}{{ row.pageTo && row.pageTo !== row.pageFrom ? `～${row.pageTo}` : '' }}</template></el-table-column>
            <el-table-column label="出处核实" width="130"><template #default="{ row }">{{ label('matchStatus', row.matchStatus) }}</template></el-table-column>
            <el-table-column label="题面关系" min-width="160"><template #default="{ row }">{{ row.stemMatches === false ? '原题面关系待复核' : '按记录的实际出处追溯' }}</template></el-table-column>
          </el-table>
        </template>
      </template>
      <el-alert
        v-if="question.readinessReasons?.length"
        :title="`待补齐：${question.readinessReasons.join('；')}`"
        type="warning"
        :closable="false"
        class="detail-alert"
      />
      <el-tabs v-model="tab" class="detail-tabs" @tab-change="tabChanged">
        <el-tab-pane :label="question.contentKind === 'KNOWLEDGE' ? '知识内容 / 说明' : '题干 / 答案 / 解析'" name="body">
          <h4>{{ question.contentKind === 'KNOWLEDGE' ? '知识内容（只读）' : '题干（只读）' }}</h4>
          <html-preview :html="question.stemHtml" :layout-mode="question.layoutMode" :pagination-mode="question.paginationMode" />
          <h4>{{ question.contentKind === 'KNOWLEDGE' ? '知识说明' : '答案' }}</h4>
          <html-preview :html="question.answerHtml" answer />
          <h4>解析</h4>
          <html-preview :html="question.analysisHtml" answer />
          <p v-if="question.sourceNote">来源备注：{{ question.sourceNote }}</p>
        </el-tab-pane>
        <el-tab-pane label="实际出处与核实" name="occurrences">
          <occurrences
            ref="occurrenceRef"
            v-if="tab === 'occurrences' && question.id"
            :question-id="question.id"
            @changed="reload"
          />
        </el-tab-pane>
        <el-tab-pane label="母题与变式" name="lineage">
          <el-alert
            :title="
              lineage.notice ||
              '祖先出处只用于追溯，不表示当前题实际出自该来源。'
            "
            type="info"
            :closable="false"
          />
          <h4>母题</h4>
          <el-table :data="lineage.parents || []" empty-text="没有母题关系">
            <el-table-column label="母题" min-width="200">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="show({ id: row.parentQuestionId })"
                >
                  {{ row.parentTitle || `题目 ${row.parentQuestionId}` }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="主母题" width="90">
              <template #default="{ row }">
                {{ row.isPrimary ? '是' : '否' }}
              </template>
            </el-table-column>
            <el-table-column label="变式操作">
              <template #default="{ row }">
                {{ label('operation', row.operation) }}
              </template>
            </el-table-column>
            <el-table-column label="改动说明" prop="changeNote" />
            <el-table-column label="保留说明" prop="preservedNote" />
          </el-table>
          <h4>派生变式</h4>
          <el-table :data="lineage.children || []" empty-text="没有派生变式">
            <el-table-column label="变式" min-width="200">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="show({ id: row.childQuestionId })"
                >
                  {{ row.childTitle || `题目 ${row.childQuestionId}` }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="变式操作">
              <template #default="{ row }">
                {{ label('operation', row.operation) }}
              </template>
            </el-table-column>
            <el-table-column label="改动说明" prop="changeNote" />
            <el-table-column label="保留说明" prop="preservedNote" />
          </el-table>
          <h4>祖先来源（仅追溯）</h4>
          <el-table
            :data="lineage.ancestorSources || []"
            empty-text="没有祖先来源"
          >
            <el-table-column label="来源" prop="sourceTitle" />
            <el-table-column label="题号" prop="questionNo" />
            <el-table-column label="核实" width="120">
              <template #default="{ row }">
                {{ label('matchStatus', row.matchStatus) }}
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="题图文件" name="assets">
          <asset-files :model-value="question.assetIds || []" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-drawer>
  <question-editor ref="editorRef" @saved="changed" />
  <html-import-dialog ref="importRef" @completed="changed" />
</template>
<script setup>
import { getRecord, knowledgeRequest, exportQuestions } from '@/api/knowledge'
import { label } from './labels'
import HtmlPreview from './HtmlPreview.vue'
import ClassificationTag from './ClassificationTag.vue'
import RelationNames from './RelationNames.vue'
import Occurrences from './Occurrences.vue'
import AssetFiles from './AssetFiles.vue'
import QuestionEditor from './QuestionEditor.vue'
import HtmlImportDialog from './HtmlImportDialog.vue'
import { ElMessage } from 'element-plus'
const emit = defineEmits(['changed'])
const open = ref(false),
  loading = ref(false),
  question = ref({}),
  tab = ref('body'),
  lineage = ref({}),
  editorRef = ref(),
  importRef = ref(),
  exporting = ref(false)
const occurrenceRef = ref()
const queryMatchReasons = ref([])
const queryOccurrences = ref(null)
const matchedGroups = computed(() => {
  const context = queryOccurrences.value || question.value
  const prefix = queryOccurrences.value ? '本次查询命中' : '当前'
  return [{ title:`${prefix}的有效真题出处`,rows:context.matchedExamOccurrences || [] }, {title:`${prefix}的错题收录出处`,rows:context.matchedWrongOccurrences || []}]
})
async function show(row) {
  queryMatchReasons.value = row.matchReasons || []
  queryOccurrences.value = Array.isArray(row.matchedExamOccurrences) || Array.isArray(row.matchedWrongOccurrences) ? { matchedExamOccurrences:row.matchedExamOccurrences || [],matchedWrongOccurrences:row.matchedWrongOccurrences || [] } : null
  question.value = { id: row.id }
  lineage.value = {}
  tab.value = 'body'
  open.value = true
  await reload()
}
async function reload() {
  loading.value = true
  try {
    question.value = (await getRecord('question', question.value.id)).data
    if (tab.value === 'lineage') await tabChanged('lineage')
  } finally {
    loading.value = false
  }
}
async function tabChanged(name) {
  if (name === 'lineage')
    lineage.value = (
      await knowledgeRequest(`/question/${question.value.id}/lineage`)
    ).data
}
async function changed() {
  queryMatchReasons.value = []
  queryOccurrences.value = null
  if (open.value) {
    await reload()
    await occurrenceRef.value?.reload()
  }
  emit('changed')
}
async function download() {
  exporting.value = true
  try {
    await exportQuestions(
      { questionIds: [question.value.id], includeAnswers: true },
      `${question.value.title}-资源包.zip`
    )
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
defineExpose({ show })
</script>
<style scoped>
.detail-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.detail-alert {
  margin-top: 16px;
}
.detail-tabs {
  margin-top: 20px;
}
h4 {
  color: #303133;
}
</style>
