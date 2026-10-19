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
    <enum-select v-model="collectionKind" field="collectionKind" clearable placeholder="全部收录用途" style="width:170px;margin-left:12px" @update:model-value="pageNum = 1; load()" />
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
                : row.matchedStemHash && row.stemMatches === false
                  ? '题干已变化'
                  : '尚未满足真题条件'
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="收录用途" width="120"><template #default="{ row }"><el-tag v-for="item in row.collections || []" :key="item.collectionKind" type="warning">{{ label('collectionKind', item.collectionKind) }}</el-tag><span v-if="!row.collections?.length">普通收录</span></template></el-table-column>
      <el-table-column label="操作" width="320">
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
            link type="primary" @click="editCollections(row)"
          >收录用途</el-button>
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
    <pagination v-show="total > 0" :total="total" v-model:page="pageNum" v-model:limit="pageSize" @pagination="load" />
    <el-dialog v-model="collectionsOpen" title="出处收录用途" width="700px" append-to-body destroy-on-close>
      <el-alert title="错题收录属于本次出处。取消收录只解除用途，不删除题目、出处或原件。" type="info" :closable="false" class="mb8" />
      <el-form label-width="100px" :disabled="savingCollections">
        <el-form-item label="收录用途"><el-checkbox v-model="wrongCollection">{{ label('collectionKind', 'WRONG_QUESTION') }}</el-checkbox></el-form-item>
        <el-form-item v-if="wrongCollection" label="说明"><el-input v-model="collectionForm.note" type="textarea" :rows="3" maxlength="2000" /></el-form-item>
      </el-form>
      <template v-if="wrongCollection"><p>证据原件（可选）</p><asset-files :model-value="collectionSource.assetIds || []" selectable :removable="false" :selected-id="collectionForm.evidenceAssetId" @selected="collectionForm.evidenceAssetId = $event" /><el-button v-if="collectionForm.evidenceAssetId" link @click="collectionForm.evidenceAssetId = null">取消证据选择</el-button></template>
      <template #footer><el-button type="primary" :loading="savingCollections" @click="saveCollections">保存收录用途</el-button><el-button @click="collectionsOpen = false">取消</el-button></template>
    </el-dialog>
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
import { pickFields } from './catalog'
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
const pageNum = ref(1), pageSize = ref(10), total = ref(0), collectionKind = ref()
const collectionsOpen = ref(false), savingCollections = ref(false), collectionForm = ref({}), collectionSource = ref({}), wrongCollection = ref(false), collectionRow = ref({})
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
      ...pickFields(latest, ['id','rowVersion','title','sourceKind','extractionStatus','originUrl','originNote','remark','subject','grade','examType','examYear','schoolName','scopeNote']),
      attachments: assetIds.flatMap(id => {
        const existing = (latest.attachments || []).filter(item => String(item.assetId) === String(id))
        return existing.length ? existing : [{assetId:id,role:'EVIDENCE'}]
      }).map(item => ({assetId:item.assetId,role:item.role}))
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
let listGeneration = 0
async function load() {
  const ticket = ++listGeneration
  if (!props.questionId && !props.sourceId) return
  loading.value = true
  try {
    const response = await knowledgeRequest('/occurrence/list', 'get', undefined, { questionId:props.questionId, sourceId:props.sourceId, collectionKind:collectionKind.value, pageNum:pageNum.value, pageSize:pageSize.value })
    if (ticket !== listGeneration) return
    rows.value = response.rows || []
    total.value = Number(response.total || 0)
    if (!rows.value.length && total.value && pageNum.value > 1) { pageNum.value--; await load() }
  } finally {
    if (ticket === listGeneration) loading.value = false
  }
}
watch(() => [props.questionId, props.sourceId], () => { pageNum.value = 1; load() }, { immediate: true })
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
        ...pickFields(form.value, ['id','rowVersion','questionNo','pageFrom','pageTo','score','matchStatus','verificationNote']),
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
async function editCollections(row) {
  collectionRow.value = row
  const existing = row.collections?.find(item => item.collectionKind === 'WRONG_QUESTION')
  wrongCollection.value = !!existing
  collectionForm.value = { note:existing?.note || '', evidenceAssetId:existing?.evidenceAssetId || null }
  collectionSource.value = (await getRecord('source', row.sourceId)).data
  collectionsOpen.value = true
}
async function saveCollections() {
  savingCollections.value = true
  try {
    const collections = (collectionRow.value.collections || []).filter(item => item.collectionKind !== 'WRONG_QUESTION').map(item => pickFields(item, ['collectionKind','note','evidenceAssetId']))
    if (wrongCollection.value) collections.push({ collectionKind:'WRONG_QUESTION', ...collectionForm.value })
    await knowledgeRequest(`/occurrence/${collectionRow.value.id}/collections`, 'put', { rowVersion:collectionRow.value.rowVersion, collections })
    collectionsOpen.value = false
    ElMessage.success('收录用途已保存')
    await load()
    emit('changed')
  } finally { savingCollections.value = false }
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
