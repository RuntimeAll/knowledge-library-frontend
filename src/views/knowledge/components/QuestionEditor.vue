<template>
  <el-dialog
    v-model="open"
    title="编辑题目元数据"
    width="800px"
    append-to-body
    destroy-on-close
  >
    <el-alert
      title="题干、答案和解析通过本地 HTML 更新。真题身份由出处核实推导，不可手动设置。"
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
      <el-form-item label="题目名称" prop="title">
        <el-input v-model="form.title" maxlength="300" show-word-limit />
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="学科">
            <enum-select
              v-model="form.subject"
              field="subject"
              clearable
              placeholder="选择或输入学科，未知留空"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="题型">
            <enum-select
              v-model="form.questionType"
              field="questionType"
              clearable
              placeholder="选择或输入题型"
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
      <el-form-item label="关联考点">
        <record-picker v-model="form.kpIds" type="kp" />
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
import { dictionaries } from './labels'
import EnumSelect from './EnumSelect.vue'
import RecordPicker from './RecordPicker.vue'
import { ElMessage } from 'element-plus'
const emit = defineEmits(['saved'])
const open = ref(false),
  saving = ref(false),
  form = ref({}),
  formRef = ref()
const rules = {
  title: [{ required: true, message: '请填写题目名称', trigger: 'blur' }]
}
async function show(row) {
  form.value = (await getRecord('question', row.id)).data
  form.value.kpIds ||= []
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
      questionType,
      difficulty,
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
      questionType,
      difficulty,
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
