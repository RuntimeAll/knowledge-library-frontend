<template>
  <div>
    <el-alert
      title="真题身份由考试来源、出现关系及当前题干共同核实得到。仅相似或祖先出处不能作为当前题的真题证明。"
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-button
      v-hasPermi="['knowledge:source:edit']"
      type="primary"
      plain
      icon="Plus"
      @click="edit()"
    >
      新增出处
    </el-button>
    <el-button icon="Refresh" @click="load">刷新出处</el-button>
    <el-table
      v-loading="loading"
      :data="rows"
      empty-text="暂无出现关系，请关联实际来源"
      class="occurrence-table"
    >
      <el-table-column :label="sourceId ? '题目' : '来源'" min-width="190">
        <template #default="{ row }">
          {{
            sourceId
              ? row.questionTitle || `题目 ${row.questionId}`
              : row.sourceTitle || `来源 ${row.sourceId}`
          }}
        </template>
      </el-table-column>
      <el-table-column label="题号" prop="questionNo" width="90" />
      <el-table-column label="页码" width="110">
        <template #default="{ row }">
          {{ row.pageFrom || '—'
          }}{{
            row.pageTo && row.pageTo !== row.pageFrom ? `～${row.pageTo}` : ''
          }}
        </template>
      </el-table-column>
      <el-table-column label="分值" prop="score" width="70" />
      <el-table-column label="核实" width="110">
        <template #default="{ row }">
          {{ label('matchStatus', row.matchStatus) }}
        </template>
      </el-table-column>
      <el-table-column label="当前身份" width="140">
        <template #default="{ row }">
          <el-tag :type="row.isRealExam ? 'success' : 'info'">
            {{
              row.isRealExam
                ? '有效真题出处'
                : row.stemMatches === false
                  ? '题干已变化'
                  : '尚未满足真题条件'
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240">
        <template #default="{ row }">
          <el-button
            v-if="!sourceId"
            v-hasPermi="['knowledge:source:query']"
            link
            type="primary"
            @click="showOriginals(row)"
          >
            来源原件
          </el-button>
          <el-button
            v-hasPermi="['knowledge:source:edit']"
            link
            type="primary"
            @click="edit(row)"
          >
            编辑核实
          </el-button>
          <el-button
            v-hasPermi="['knowledge:source:edit']"
            link
            type="danger"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog
      v-model="open"
      :title="form.id ? '编辑 / 核实出处' : '新增题目出处'"
      width="800px"
      append-to-body
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        label-width="110px"
        :disabled="saving"
      >
        <el-form-item v-if="!sourceId" label="实际来源" required>
          <record-picker v-model="sourceIds" type="source" :multiple="false" />
        </el-form-item>
        <el-form-item v-if="!questionId" label="实际题目" required>
          <record-picker
            v-model="questionIds"
            type="question"
            :multiple="false"
          />
        </el-form-item>
        <el-form-item label="原题题号">
          <el-input
            v-model="form.questionNo"
            placeholder="如二、3，保留原件题号"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="起始页">
              <el-input-number v-model="form.pageFrom" :min="1" :max="99999" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束页">
              <el-input-number
                v-model="form.pageTo"
                :min="form.pageFrom || 1"
                :max="99999"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="分值">
          <el-input-number
            v-model="form.score"
            :min="0"
            :max="10000"
            :precision="2"
          />
        </el-form-item>
        <el-form-item label="核实状态">
          <enum-select v-model="form.matchStatus" field="matchStatus" />
        </el-form-item>
        <el-form-item label="核实依据">
          <el-input
            v-model="form.verificationNote"
            type="textarea"
            :rows="3"
            placeholder="填写如何确认当前题干在该原件实际出现"
          />
        </el-form-item>
      </el-form>
      <p class="section-label">核实证据文件（可选）</p>
      <el-alert
        v-if="!selectedSourceId"
        title="请先选择实际来源，再选择该来源原件作为核实证据。"
        type="info"
        :closable="false"
      />
      <asset-files
        v-else
        :model-value="evidenceSource.assetIds || []"
        purpose="SOURCE_ORIGINAL"
        :selected-id="evidenceIds[0]"
        :removable="false"
        selectable
        editable
        upload-label="上传新证据原件"
        upload-tip="从来源已有原件中选择证据；新证据上传后自动关联当前来源，再保存出处完成核实。"
        @update:model-value="linkEvidence"
        @selected="evidenceIds = [$event]"
        @busy="evidenceUploading = $event"
      />
      <el-button
        v-if="evidenceIds.length"
        link
        type="warning"
        @click="evidenceIds = []"
      >
        取消证据选择
      </el-button>
      <template #footer>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="evidenceUploading || evidenceLinking"
          @click="save"
        >
          保存出处与核实状态
        </el-button>
        <el-button @click="open = false">取消</el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="originalsOpen"
      :title="`来源原件 · ${originalSource.title || ''}`"
      width="800px"
      append-to-body
      destroy-on-close
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item label="来源类型">
          {{ label('sourceKind', originalSource.sourceKind) }}
        </el-descriptions-item>
        <el-descriptions-item label="真实性">
          {{
            originalSource.sourceKind === 'EXAM'
              ? label('authenticityStatus', originalSource.authenticityStatus)
              : '不适用'
          }}
        </el-descriptions-item>
        <el-descriptions-item label="核实依据" :span="2">
          {{ originalSource.verificationNote || '尚未填写' }}
        </el-descriptions-item>
      </el-descriptions>
      <asset-files :model-value="originalSource.assetIds || []" />
    </el-dialog>
  </div>
</template>
<script setup>
import { knowledgeRequest, getRecord, saveRecord } from '@/api/knowledge'
import RecordPicker from './RecordPicker.vue'
import EnumSelect from './EnumSelect.vue'
import AssetFiles from './AssetFiles.vue'
import { label } from './labels'
import { ElMessage, ElMessageBox } from 'element-plus'
const props = defineProps({
  questionId: [String, Number],
  sourceId: [String, Number]
})
const emit = defineEmits(['changed'])
const originalsOpen = ref(false),
  originalSource = ref({})
const loading = ref(false),
  rows = ref([]),
  open = ref(false),
  form = ref({}),
  formRef = ref(),
  sourceIds = ref([]),
  questionIds = ref([]),
  evidenceIds = ref([]),
  saving = ref(false)
const evidenceSource = ref({}),
  evidenceUploading = ref(false),
  evidenceLinking = ref(false)
const selectedSourceId = computed(() => props.sourceId || sourceIds.value[0])
let evidenceGeneration = 0
watch(
  selectedSourceId,
  async (id) => {
    const ticket = ++evidenceGeneration
    if (String(id) !== String(form.value.sourceId)) evidenceIds.value = []
    evidenceSource.value = {}
    if (!id) return
    try {
      const source = (await getRecord('source', id)).data
      if (ticket === evidenceGeneration) evidenceSource.value = source
    } catch {
      /* Request interceptor displays the error. */
    }
  },
  { immediate: true }
)
async function linkEvidence(ids) {
  const sourceId = selectedSourceId.value
  const additions = ids.filter(
    (id) =>
      !(evidenceSource.value.assetIds || []).some(
        (old) => String(old) === String(id)
      )
  )
  if (!sourceId || !additions.length) return
  evidenceLinking.value = true
  try {
    const latest = (await getRecord('source', sourceId)).data
    const assetIds = [
      ...new Set([...(latest.assetIds || []), ...additions].map(String))
    ]
    const saved = await saveRecord('source', {
      ...latest,
      attachments: undefined,
      assetIds
    })
    if (String(sourceId) === String(selectedSourceId.value)) {
      evidenceSource.value = saved.data
      evidenceIds.value = [additions[additions.length - 1]]
      ElMessage.success('新证据已关联当前来源，请保存出处完成核实')
    }
  } catch {
    ElMessage.warning(
      '原件已上传，但关联来源未成功；请在来源页面关联后再选择证据'
    )
  } finally {
    evidenceLinking.value = false
  }
}
async function load() {
  if (!props.questionId && !props.sourceId) return
  loading.value = true
  try {
    rows.value =
      (
        await knowledgeRequest(
          props.sourceId
            ? `/source/${props.sourceId}/occurrences`
            : `/question/${props.questionId}/occurrences`
        )
      ).data || []
  } finally {
    loading.value = false
  }
}
watch(() => [props.questionId, props.sourceId], load, { immediate: true })
function edit(row) {
  form.value = row
    ? { ...row }
    : {
        matchStatus: 'UNVERIFIED',
        questionNo: '',
        pageFrom: undefined,
        pageTo: undefined,
        score: undefined
      }
  sourceIds.value = row?.sourceId ? [row.sourceId] : []
  questionIds.value = row?.questionId ? [row.questionId] : []
  evidenceIds.value = row?.evidenceAssetId ? [row.evidenceAssetId] : []
  open.value = true
}
async function save() {
  const sourceId = props.sourceId || sourceIds.value[0],
    questionId = props.questionId || questionIds.value[0]
  if (!sourceId || !questionId) return ElMessage.warning('请选择来源和题目')
  saving.value = true
  try {
    await knowledgeRequest(
      '/source/occurrence',
      form.value.id ? 'put' : 'post',
      {
        ...form.value,
        sourceId,
        questionId,
        evidenceAssetId: evidenceIds.value[0] || null
      }
    )
    ElMessage.success('出处保存成功')
    open.value = false
    await load()
    emit('changed')
  } finally {
    saving.value = false
  }
}
async function remove(row) {
  try {
    await ElMessageBox.confirm(
      '确认删除此出现关系？不会删除题目和来源原件。',
      '删除出处',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await knowledgeRequest(`/source/occurrence/${row.id}`, 'delete')
  ElMessage.success('出处删除成功')
  await load()
  emit('changed')
}
defineExpose({ reload: load })
async function showOriginals(row) {
  originalSource.value = (await getRecord('source', row.sourceId)).data
  originalsOpen.value = true
}
</script>
<style scoped>
.occurrence-table {
  margin-top: 12px;
}
.section-label {
  font-weight: 600;
  color: #606266;
}
</style>
