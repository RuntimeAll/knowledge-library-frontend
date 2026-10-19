<template>
  <el-dialog
    v-model="open"
    title="编辑内容元数据"
    width="800px"
    append-to-body
    destroy-on-close
  >
    <el-alert
      title="区分练习题与知识点内容；正文通过导出后本地修改并重新导入更新。设为可用前需补齐学科、题型和考点。"
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      :disabled="saving"
    >
      <el-form-item label="内容名称" prop="title">
        <el-input v-model="form.title" maxlength="300" show-word-limit />
      </el-form-item>
      <el-form-item label="内容类型" prop="contentKind">
        <enum-select v-model="form.contentKind" field="contentKind" @update:model-value="changeContentKind" />
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="学科" prop="subject">
            <enum-select
              v-model="form.subject"
              field="subject"
              clearable
              placeholder="请选择学科"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="form.contentKind === 'KNOWLEDGE' ? '知识类型' : '题型'" prop="questionType">
            <enum-select
              v-model="form.questionType"
              field="questionType"
              :include-values="form.contentKind === 'KNOWLEDGE' ? knowledgeTypes : null"
              :exclude-values="form.contentKind === 'EXERCISE' ? knowledgeTypes : []"
              clearable
              placeholder="请选择类型"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="难度">
        <enum-select
          v-model="form.difficulty"
          field="difficulty"
          clearable
          placeholder="按已知情况填写，未知留空"
        />
      </el-form-item>
      <el-collapse class="mb8">
        <el-collapse-item title="内容组织与排版" name="layout">
          <el-form-item label="呈现方式">
            <enum-select v-model="form.layoutMode" field="layoutMode" />
          </el-form-item>
          <el-form-item label="内容单元">
            <enum-select v-model="form.unitKind" field="unitKind" />
            <div class="form-hint">一组 10 道口算可作为一条组合内容；组内条目与选项通过 JSON/HTML 导入更新，切换类型必须与已有正文结构一致。</div>
          </el-form-item>
          <el-form-item label="条目数量">
            <span>{{ form.itemCount ?? '—' }}（按正文结构自动计算）</span>
          </el-form-item>
          <el-form-item label="分页方式">
            <enum-select v-model="form.paginationMode" field="paginationMode" />
          </el-form-item>
          <el-form-item label="排版说明">
            <el-input v-model="form.layoutNote" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="例如：探究材料与第 1 问同页；答题区适当留白。" />
          </el-form-item>
        </el-collapse-item>
      </el-collapse>
      <el-form-item label="状态">
        <enum-select v-model="form.status" field="status" />
      </el-form-item>
      <el-form-item label="创作类型">
        <el-select
          v-model="form.creationKind"
          :disabled="form.creationKind === 'DERIVED'"
          style="width: 100%"
        >
          <el-option
            v-for="(text, value) in dictionaries.creationKind"
            :key="value"
            :label="text"
            :value="value"
            :disabled="value === 'DERIVED'"
          />
        </el-select>
        <div class="form-hint">变式身份需通过“上传变式”建立母题关系。</div>
      </el-form-item>
      <el-form-item label="关联考点" prop="kpIds">
        <record-picker v-model="form.kpIds" type="kp" :filters="{ subject: form.subject || undefined }" />
      </el-form-item>
      <el-form-item label="来源备注">
        <el-input
          v-model="form.sourceNote"
          type="textarea"
          :rows="3"
          placeholder="备注不等于已核实出处，实际出现关系请在详情维护"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" />
      </el-form-item>
    </el-form>
    <el-alert
      v-if="form.readinessReasons?.length"
      :title="`可用状态待补齐：${form.readinessReasons.join('；')}`"
      type="warning"
      :closable="false"
    />
    <template #footer>
      <el-button type="primary" :loading="saving" @click="save">
        保存元数据
      </el-button>
      <el-button @click="open = false">取消</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { getRecord, saveRecord } from '@/api/knowledge'
import { dictionaries, loadDictionary } from './labels'
loadDictionary('creationKind')
import EnumSelect from './EnumSelect.vue'
import RecordPicker from './RecordPicker.vue'
import { ElMessage } from 'element-plus'
const emit = defineEmits(['saved'])
const open = ref(false),
  saving = ref(false),
  form = ref({}),
  formRef = ref()
const rules = {
  title: [{ required: true, message: '请填写内容名称', trigger: 'blur' }],
  contentKind: [{ required: true, message: '请选择内容类型', trigger: 'change' }],
  subject: [{ validator: readyRequired('学科'), trigger: 'change' }],
  questionType: [{ validator: readyRequired('题型或知识类型'), trigger: 'change' }],
  kpIds: [{ validator: readyRequired('关联考点'), trigger: 'change' }]
}
const knowledgeTypes = ['KNOWLEDGE_REVIEW', 'KNOWLEDGE_EXPLANATION']
function readyRequired(name) {
  return (_rule, value, callback) => callback(form.value.status === 'READY' && (!value || (Array.isArray(value) && !value.length))
    ? new Error(`设为可用前请补齐${name}`) : undefined)
}
function changeContentKind(value) {
  if (value === 'KNOWLEDGE' && !knowledgeTypes.includes(form.value.questionType)) form.value.questionType = 'KNOWLEDGE_REVIEW'
  if (value === 'EXERCISE' && knowledgeTypes.includes(form.value.questionType)) form.value.questionType = ''
}
async function show(row) {
  form.value = (await getRecord('question', row.id)).data
  form.value.kpIds ||= []
  form.value.contentKind ||= 'EXERCISE'
  form.value.layoutMode ||= 'PLAIN'
  form.value.unitKind ||= 'SINGLE'
  form.value.paginationMode ||= 'FLOW'
  open.value = true
}
async function save() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    const {
      id,
      rowVersion,
      title,
      subject,
      contentKind,
      questionType,
      difficulty,
      layoutMode,
      unitKind,
      paginationMode,
      layoutNote,
      status,
      creationKind,
      kpIds,
      sourceNote,
      remark
    } = form.value
    await saveRecord('question', {
      id,
      rowVersion,
      title,
      subject,
      contentKind,
      questionType,
      difficulty,
      layoutMode,
      unitKind,
      paginationMode,
      layoutNote,
      status,
      creationKind,
      kpIds,
      sourceNote,
      remark
    })
    ElMessage.success('题目元数据保存成功')
    open.value = false
    emit('saved', id)
  } finally {
    saving.value = false
  }
}
defineExpose({ show })
</script>
<style scoped>
.form-hint {
  font-size: 12px;
  color: #909399;
  width: 100%;
  margin-top: 4px;
}
</style>
