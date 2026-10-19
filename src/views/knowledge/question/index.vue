<template>
  <div class="knowledge-page">
    <resource-list
      ref="listRef"
      type="question"
      :action-width="340"
      @add="importRef.show('create')"
      @edit="(row) => editorRef.show(row)"
      @detail="(row) => detailRef.show(row)"
    >
      <template #filters="{ query }">
        <el-form-item label="内容类型">
          <enum-select v-model="query.contentKind" field="contentKind" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="状态">
          <enum-select
            v-model="query.status"
            field="status"
            clearable
            style="width: 130px"
          />
        </el-form-item>
        <el-form-item label="创作类型">
          <enum-select
            v-model="query.creationKind"
            field="creationKind"
            clearable
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="题干关键词">
          <el-input v-model="query.query" clearable placeholder="在题干中搜索" />
        </el-form-item>
        <el-form-item label="搜索方式">
          <el-select
            v-model="query.matchMode"
            clearable
            placeholder="包含匹配"
            style="width: 140px"
          >
            <el-option label="包含匹配" value="CONTAINS" />
            <el-option label="全文检索" value="FULLTEXT" />
          </el-select>
        </el-form-item>
        <el-form-item label="学科">
          <enum-select
            v-model="query.subject"
            field="subject"
            clearable
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="题型">
          <enum-select
            v-model="query.questionType"
            field="questionType"
            clearable
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="难度">
          <enum-select
            v-model="query.difficulty"
            field="difficulty"
            clearable
            style="width: 130px"
          />
        </el-form-item>
        <el-form-item label="题图">
          <el-select v-model="query.hasImage" clearable style="width: 130px">
            <el-option label="有图片" :value="true" />
            <el-option label="无图片" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容单元">
          <enum-select v-model="query.unitKind" field="unitKind" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="呈现方式">
          <enum-select v-model="query.layoutMode" field="layoutMode" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="按考点筛选">
          <record-picker
            :model-value="query.kpId ? [query.kpId] : []"
            type="kp"
            :multiple="false"
            @update:model-value="query.kpId = $event[0]"
          />
          <el-checkbox v-model="query.expand">含嵌套与组合</el-checkbox>
        </el-form-item>
        <el-form-item label="按来源筛选">
          <record-picker
            :model-value="query.sourceId ? [query.sourceId] : []"
            type="source"
            :multiple="false"
            @update:model-value="query.sourceId = $event[0]"
          />
        </el-form-item>
        <outline-scope-filter v-model:outline-id="query.outlineId" v-model:outline-node-id="query.outlineNodeId" />
        <el-form-item label="真题条件"><el-checkbox v-model="query.verifiedOnly">仅有效真题出处</el-checkbox></el-form-item>
        <el-form-item label="考试出处"><record-picker :model-value="query.examSourceId ? [query.examSourceId] : []" type="source" :multiple="false" :filters="{sourceKind:'EXAM'}" @update:model-value="query.examSourceId = $event[0]" /></el-form-item>
        <el-form-item label="考试用途"><enum-select v-model="query.examPurpose" field="examPurpose" clearable style="width:150px" /></el-form-item>
        <el-form-item label="考试年份"><el-input-number v-model="query.examYear" :min="1900" :max="2100" controls-position="right" style="width:140px" /></el-form-item>
        <el-form-item label="考试地区"><region-picker v-model="query.examRegionCode" /></el-form-item>
        <el-form-item v-if="query.examRegionCode"><el-checkbox v-model="query.examRegionDescendants">考试地区含下级</el-checkbox></el-form-item>
        <el-form-item label="错题条件"><el-checkbox v-model="query.wrongOnly">仅错题收录</el-checkbox></el-form-item>
        <el-form-item label="错题出处"><record-picker :model-value="query.wrongSourceId ? [query.wrongSourceId] : []" type="source" :multiple="false" @update:model-value="query.wrongSourceId = $event[0]; if ($event[0]) query.wrongOnly = true" /></el-form-item>
      </template>
      <template #toolbar="{ selection }">
        <el-col :span="1.5">
          <el-button
            v-hasPermi="['knowledge:import:execute']"
            icon="Upload"
            plain
            @click="importRef.show('create')"
          >
            导入 / 回流 HTML
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button
            v-hasPermi="['knowledge:question:export']"
            type="warning"
            plain
            icon="Download"
            :disabled="!selection.length"
            :loading="exporting"
            @click="download(selection)"
          >
            导出所选
          </el-button>
        </el-col>
      </template>
      <template #columns>
        <el-table-column label="匹配依据" min-width="190"><template #default="{ row }"><div v-for="reason in row.matchReasons || []" :key="reason">{{ reason }}</div><span v-if="!row.matchReasons?.length">按当前查询范围展示</span></template></el-table-column>
        <el-table-column label="内容类型" width="110">
          <template #default="{ row }"><classification-tag field="contentKind" :value="row.contentKind" /></template>
        </el-table-column>
        <el-table-column label="学科" width="110">
          <template #default="{ row }">
            <classification-tag field="subject" :value="row.subject" />
          </template>
        </el-table-column>
        <el-table-column label="题型" width="120">
          <template #default="{ row }">
            <classification-tag field="questionType" :value="row.questionType" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            {{ label('status', row.status) }}
          </template>
        </el-table-column>
        <el-table-column label="内容单元" width="130">
          <template #default="{ row }">
            {{ label('unitKind', row.unitKind) }}<span v-if="row.unitKind === 'GROUP'"> · {{ row.itemCount }} 项</span>
          </template>
        </el-table-column>
        <el-table-column label="考点" min-width="200">
          <template #default="{ row }"><relation-names type="kp" :ids="row.kpIds" /></template>
        </el-table-column>
        <el-table-column label="创作类型" width="110">
          <template #default="{ row }">
            {{ label('creationKind', row.creationKind) }}
          </template>
        </el-table-column>
        <el-table-column label="真题身份" width="120">
          <template #default="{ row }">
            <el-tag :type="row.isRealExam ? 'success' : 'info'">
              {{ row.isRealExam ? '有效真题' : '未认定为真题' }}
            </el-tag>
          </template>
        </el-table-column>
      </template>
      <template #actions="{ row }">
        <el-button
          v-hasPermi="['knowledge:import:execute']"
          link
          type="primary"
          @click="updateHtml(row)"
        >
          更新正文
        </el-button>
        <el-button
          v-hasPermi="['knowledge:import:execute']"
          link
          type="primary"
          @click="derive(row)"
        >
          上传变式
        </el-button>
      </template>
    </resource-list>
    <question-detail ref="detailRef" @changed="listRef.reload()" />
    <question-editor ref="editorRef" @saved="listRef.reload()" />
    <html-import-dialog ref="importRef" @completed="listRef.reload()" />
  </div>
</template>
<script setup name="KnowledgeQuestion">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import ClassificationTag from '../components/ClassificationTag.vue'
import EnumSelect from '../components/EnumSelect.vue'
import QuestionDetail from '../components/QuestionDetail.vue'
import QuestionEditor from '../components/QuestionEditor.vue'
import HtmlImportDialog from '../components/HtmlImportDialog.vue'
import OutlineScopeFilter from '../components/OutlineScopeFilter.vue'
import RegionPicker from '../components/RegionPicker.vue'
import RelationNames from '../components/RelationNames.vue'
import { label } from '../components/labels'
import { exportQuestions, getRecord } from '@/api/knowledge'
import { ElMessage } from 'element-plus'
const listRef = ref(),
  detailRef = ref(),
  editorRef = ref(),
  importRef = ref(),
  exporting = ref(false)
const route = useRoute()
function syncScope() {
  if (route.path !== '/knowledge/question') return
  listRef.value?.setFilters({ outlineId: route.query.outlineId || undefined, outlineNodeId: route.query.outlineNodeId || undefined })
}
watch(() => [route.path, route.query.outlineId, route.query.outlineNodeId], syncScope)
onMounted(syncScope)
async function updateHtml(row) {
  importRef.value.show('update', (await getRecord('question', row.id)).data)
}
async function derive(row) {
  importRef.value.show('derive', (await getRecord('question', row.id)).data)
}
async function download(rows) {
  exporting.value = true
  try {
    await exportQuestions(
      { questionIds: rows.map((row) => row.id), includeAnswers: true },
      '所选题目-资源包.zip'
    )
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>
