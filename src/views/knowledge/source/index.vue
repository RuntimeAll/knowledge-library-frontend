<template>
  <resource-list
    ref="listRef"
    type="source"
    @add="edit()"
    @edit="edit"
    @detail="detail"
  >
    <template #filters="{ query }">
      <el-form-item label="来源类型">
        <enum-select
          v-model="query.sourceKind"
          field="sourceKind"
          clearable
          style="width: 150px"
        />
      </el-form-item>
      <el-form-item label="核实状态">
        <enum-select
          v-model="query.authenticityStatus"
          field="authenticityStatus"
          clearable
          style="width: 150px"
        />
      </el-form-item>
    </template>
    <template #columns>
      <el-table-column label="类型" width="110">
        <template #default="{ row }">
          {{ label('sourceKind', row.sourceKind) }}
        </template>
      </el-table-column>
      <el-table-column label="学科 / 年级" min-width="130">
        <template #default="{ row }">
          <template v-if="row.sourceKind === 'EXAM'">
            <classification-tag field="subject" :value="row.subject" />
            / {{ row.grade || '未填年级' }}
          </template>
          <span v-else>不适用</span>
        </template>
      </el-table-column>
      <el-table-column label="年份" prop="examYear" width="85" />
      <el-table-column label="核实状态" width="120">
        <template #default="{ row }">
          <el-tag
            :type="row.authenticityStatus === 'VERIFIED' ? 'success' : 'info'"
          >
            {{
              row.sourceKind === 'EXAM'
                ? label('authenticityStatus', row.authenticityStatus)
                : '不适用'
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="抽题进度" width="120">
        <template #default="{ row }">
          {{ label('extractionStatus', row.extractionStatus) }}
        </template>
      </el-table-column>
    </template>
  </resource-list>
  <el-dialog
    v-model="open"
    :title="`${readonly ? '查看' : form.id ? '编辑' : '新增'}来源`"
    width="860px"
    append-to-body
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="110px"
      :disabled="readonly || saving"
    >
      <el-form-item label="来源名称" prop="title">
        <el-input v-model="form.title" maxlength="200" show-word-limit />
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="来源类型" prop="sourceKind">
            <enum-select v-model="form.sourceKind" field="sourceKind" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="抽题进度">
            <enum-select
              v-model="form.extractionStatus"
              field="extractionStatus"
            />
          </el-form-item>
        </el-col>
        <el-col v-if="form.sourceKind === 'EXAM'" :span="12">
          <el-form-item label="学科">
            <enum-select
              v-model="form.subject"
              field="subject"
              clearable
              placeholder="未知请留空"
            />
          </el-form-item>
        </el-col>
        <el-col v-if="form.sourceKind === 'EXAM'" :span="12">
          <el-form-item label="年级">
            <el-input v-model="form.grade" placeholder="未知请留空" />
          </el-form-item>
        </el-col>
        <el-col v-if="form.sourceKind === 'EXAM'" :span="12">
          <el-form-item label="考试年份">
            <el-input-number
              v-model="form.examYear"
              :min="1900"
              :max="2100"
              controls-position="right"
              placeholder="可留空"
            />
          </el-form-item>
        </el-col>
        <el-col v-if="form.sourceKind === 'EXAM'" :span="12">
          <el-form-item label="考试类型">
            <enum-select
              v-model="form.examType"
              field="examType"
              clearable
              placeholder="请选择考试类型，未知留空"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item v-if="form.sourceKind === 'EXAM'" label="学校">
        <el-input v-model="form.schoolName" />
      </el-form-item>
      <el-form-item v-if="form.sourceKind === 'EXAM'" label="范围说明">
        <el-input v-model="form.scopeNote" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="原始链接">
        <el-input
          v-model="form.originUrl"
          placeholder="可选，填写原始资料的网址"
        />
      </el-form-item>
      <el-form-item label="来源说明">
        <el-input v-model="form.originNote" type="textarea" :rows="2" />
      </el-form-item>
      <el-divider v-if="form.sourceKind === 'EXAM'" content-position="left">
        考试来源真实性核实
      </el-divider>
      <el-form-item v-if="form.sourceKind === 'EXAM'" label="核实状态">
        <enum-select
          v-model="form.authenticityStatus"
          field="authenticityStatus"
        />
      </el-form-item>
      <el-form-item v-if="form.sourceKind === 'EXAM'" label="核实依据">
        <el-input
          v-model="form.verificationNote"
          type="textarea"
          :rows="3"
          placeholder="记录核实方式、依据及疑点；未知不推断"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" />
      </el-form-item>
    </el-form>
    <el-divider content-position="left">独立来源原件</el-divider>
    <asset-files
      v-model="form.assetIds"
      purpose="SOURCE_ORIGINAL"
      :editable="!readonly"
    />
    <template v-if="readonly && form.id">
      <el-divider content-position="left">实际出现的题目</el-divider>
      <occurrences :source-id="form.id" />
    </template>
    <template #footer>
      <el-button
        v-if="!readonly"
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </el-button>
      <el-button @click="open = false">
        {{ readonly ? '关闭' : '取消' }}
      </el-button>
    </template>
  </el-dialog>
</template>
<script setup name="KnowledgeSource">
import ResourceList from '../components/ResourceList.vue'
import EnumSelect from '../components/EnumSelect.vue'
import AssetFiles from '../components/AssetFiles.vue'
import Occurrences from '../components/Occurrences.vue'
import ClassificationTag from '../components/ClassificationTag.vue'
import { label } from '../components/labels'
import { getRecord, saveRecord } from '@/api/knowledge'
import { ElMessage } from 'element-plus'
const listRef = ref(),
  formRef = ref(),
  open = ref(false),
  readonly = ref(false),
  saving = ref(false),
  form = ref({})
const rules = {
  title: [{ required: true, message: '请填写来源名称', trigger: 'blur' }],
  sourceKind: [{ required: true, message: '请选择来源类型', trigger: 'change' }]
}
watch(
  () => form.value.sourceKind,
  (kind) => {
    if (kind === 'EXAM' && !form.value.authenticityStatus)
      form.value.authenticityStatus = 'UNVERIFIED'
  }
)
async function edit(row, view = false) {
  readonly.value = view
  form.value = row?.id
    ? (await getRecord('source', row.id)).data
    : {
        title: '',
        sourceKind: 'HANDOUT',
        extractionStatus: 'ORIGINAL_ONLY',
        assetIds: [],
        examYear: undefined
      }
  form.value.assetIds ||= []
  open.value = true
}
function detail(row) {
  return edit(row, true)
}
async function save() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const payload = { ...form.value, attachments: undefined }
    if (payload.sourceKind !== 'EXAM') {
      for (const key of [
        'subject',
        'grade',
        'examType',
        'examYear',
        'schoolName',
        'scopeNote',
        'authenticityStatus',
        'verificationNote'
      ])
        payload[key] = null
    } else {
      payload.authenticityStatus ||= 'UNVERIFIED'
    }
    await saveRecord('source', payload)
    ElMessage.success('来源保存成功')
    open.value = false
    listRef.value.reload()
  } finally {
    saving.value = false
  }
}
</script>
