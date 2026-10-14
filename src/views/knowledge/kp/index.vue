<template>
  <resource-list
    ref="listRef"
    type="kp"
    @add="edit()"
    @edit="edit"
    @detail="detail"
  >
    <template #columns>
      <el-table-column
        label="定义"
        prop="description"
        min-width="260"
        show-overflow-tooltip
      />
      <el-table-column label="年级提示" prop="gradeHint" width="140" />
    </template>
  </resource-list>
  <el-dialog
    v-model="open"
    :title="`${readonly ? '查看' : form.id ? '编辑' : '新增'}考点`"
    width="800px"
    append-to-body
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      label-width="100px"
      :disabled="readonly || saving"
      :rules="rules"
    >
      <el-form-item label="正式名称" prop="name">
        <el-input v-model="form.name" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item label="定义">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          placeholder="说明该考点的知识内涵和边界"
        />
      </el-form-item>
      <el-form-item label="年级提示">
        <el-input v-model="form.gradeHint" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" />
      </el-form-item>
    </el-form>
    <el-alert
      title="嵌套表示包含下位考点，组合表示由多个考点共同构成；不能关联自身或形成循环。"
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-descriptions :column="1" border>
      <el-descriptions-item label="嵌套考点">
        <record-picker
          v-if="!readonly"
          v-model="form.nestedIds"
          type="kp"
          :exclude-ids="form.id ? [form.id] : []"
        />
        <relation-names v-else type="kp" :ids="form.nestedIds" />
      </el-descriptions-item>
      <el-descriptions-item label="组合考点">
        <record-picker
          v-if="!readonly"
          v-model="form.componentIds"
          type="kp"
          :exclude-ids="form.id ? [form.id] : []"
        />
        <relation-names v-else type="kp" :ids="form.componentIds" />
      </el-descriptions-item>
    </el-descriptions>
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
<script setup name="KnowledgeKp">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import RelationNames from '../components/RelationNames.vue'
import { getRecord, saveRecord } from '@/api/knowledge'
import { ElMessage } from 'element-plus'
const listRef = ref(),
  formRef = ref(),
  open = ref(false),
  readonly = ref(false),
  saving = ref(false),
  form = ref({})
const rules = {
  name: [{ required: true, message: '请填写考点正式名称', trigger: 'blur' }]
}
async function edit(row, view = false) {
  readonly.value = view
  form.value = row?.id
    ? (await getRecord('kp', row.id)).data
    : { name: '', nestedIds: [], componentIds: [] }
  form.value.nestedIds ||= []
  form.value.componentIds ||= []
  open.value = true
}
function detail(row) {
  return edit(row, true)
}
async function save() {
  if (!(await formRef.value.validate().catch(() => false))) return
  saving.value = true
  try {
    await saveRecord('kp', form.value)
    ElMessage.success('考点保存成功')
    open.value = false
    listRef.value.reload()
  } finally {
    saving.value = false
  }
}
</script>
