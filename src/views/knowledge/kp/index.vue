<template>
  <div class="knowledge-page">
    <resource-list
      ref="listRef"
      type="kp"
      :initial-query="routeScope"
      @add="edit()"
      @edit="edit"
      @detail="detail"
    >
      <template #filters="{ query }">
        <el-form-item label="学科">
          <enum-select v-model="query.subject" field="subject" clearable style="width: 140px" />
        </el-form-item>
        <outline-scope-filter v-model:outline-id="query.outlineId" v-model:outline-node-id="query.outlineNodeId" />
        <el-form-item label="父考点">
          <record-picker :model-value="parentIds(query.parentId)" type="kp" :multiple="false"
            :filters="{ subject: query.subject || undefined }" @update:model-value="query.parentId = $event[0]" />
          <el-checkbox :model-value="String(query.parentId) === '0'" @change="query.parentId = $event ? 0 : undefined">只看顶级</el-checkbox>
        </el-form-item>
      </template>
      <template #columns>
        <el-table-column label="学科" width="100">
          <template #default="{ row }"><classification-tag field="subject" :value="row.subject" /></template>
        </el-table-column>
        <el-table-column label="层级" width="100">
          <template #default="{ row }">{{ depthLabel(row.depth) }}</template>
        </el-table-column>
        <el-table-column label="所属顶级考点" prop="rootName" min-width="160" show-overflow-tooltip />
        <el-table-column
          label="定义"
          prop="description"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column label="挂载教材与章节" min-width="280">
          <template #default="{ row }"><outline-bindings :bindings="row.outlineBindings" /></template>
        </el-table-column>
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
        <el-form-item label="学科" prop="subject">
          <enum-select v-model="form.subject" field="subject" />
        </el-form-item>
        <el-form-item label="父考点">
          <record-picker v-if="!readonly" :model-value="parentIds(form.parentId)" type="kp" :multiple="false"
            :exclude-ids="form.id ? [form.id] : []" :filters="{ subject: form.subject || undefined }"
            @update:model-value="form.parentId = $event[0] || 0" />
          <relation-names v-else-if="parentIds(form.parentId).length" type="kp" :ids="parentIds(form.parentId)" />
          <span v-else>顶级考点</span>
          <div v-if="!readonly" class="form-hint">不选父考点即为顶级。每个考点只能有一个父考点，层级由系统计算。</div>
        </el-form-item>
        <el-form-item v-if="form.id" label="当前层级">
          <span>{{ depthLabel(form.depth) }} · 所属顶级考点：{{ form.rootName || '—' }}</span>
          <div v-if="!readonly" class="form-hint">这里显示已保存的层级；修改父考点后，保存时同步更新。</div>
        </el-form-item>
        <el-form-item label="教材大纲" prop="outlineIds">
          <record-picker v-if="!readonly" v-model="form.outlineIds" type="outline"
            :filters="{ catalogKind: 'TEXTBOOK', subject: form.subject || undefined }" />
          <relation-names v-else type="outline" :ids="form.outlineIds" />
          <div class="form-hint">考点不绑定年级，可供多套教材复用。至少挂载一份同学科教材大纲；章节在大纲目录中维护。</div>
        </el-form-item>
        <el-form-item v-if="form.outlineBindings?.length" label="章节位置">
          <outline-bindings :bindings="form.outlineBindings" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <el-alert
        title="嵌套考点是直接子级；组合只表达知识联系，不改变层级。不能关联自身、形成循环，或为一个子考点设置多个父级。"
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
            :filters="{ subject: form.subject || undefined }"
          />
          <relation-names v-else type="kp" :ids="form.nestedIds" />
        </el-descriptions-item>
        <el-descriptions-item label="组合考点">
          <record-picker
            v-if="!readonly"
            v-model="form.componentIds"
            type="kp"
            :exclude-ids="form.id ? [form.id] : []"
            :filters="{ subject: form.subject || undefined }"
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
  </div>
</template>
<script setup name="KnowledgeKp">
import ResourceList from '../components/ResourceList.vue'
import RecordPicker from '../components/RecordPicker.vue'
import RelationNames from '../components/RelationNames.vue'
import ClassificationTag from '../components/ClassificationTag.vue'
import EnumSelect from '../components/EnumSelect.vue'
import OutlineBindings from '../components/OutlineBindings.vue'
import OutlineScopeFilter from '../components/OutlineScopeFilter.vue'
import { getRecord, saveRecord } from '@/api/knowledge'
import { ElMessage } from 'element-plus'
const listRef = ref(),
  formRef = ref(),
  open = ref(false),
  readonly = ref(false),
  saving = ref(false),
  form = ref({})
const rules = {
  name: [{ required: true, message: '请填写考点正式名称', trigger: 'blur' }],
  subject: [{ required: true, message: '请选择学科', trigger: 'change' }],
  outlineIds: [{ type: 'array', required: true, min: 1, message: '请至少挂载一份教材大纲', trigger: 'change' }]
}
const route = useRoute()
const routeScope = computed(() => ({ outlineId: route.query.outlineId || undefined, outlineNodeId: route.query.outlineNodeId || undefined }))
function parentIds(id) {
  return /^[1-9]\d*$/.test(String(id ?? '')) ? [id] : []
}
function depthLabel(depth) {
  return Number(depth) === 1 ? '顶级' : Number(depth) > 1 ? `第 ${depth} 级` : '待计算'
}
function syncScope() {
  if (route.path !== '/knowledge/kp') {
    open.value = false
    return
  }
  listRef.value?.setFilters(routeScope.value)
}
watch(() => [route.path, route.query.outlineId, route.query.outlineNodeId], syncScope)
async function edit(row, view = false) {
  readonly.value = view
  form.value = row?.id
    ? (await getRecord('kp', row.id)).data
    : { name: '', subject: '', parentId: 0, outlineIds: [], nestedIds: [], componentIds: [] }
  if (String(form.value.parentId) === '0') form.value.parentId = 0
  form.value.outlineIds ||= []
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
    const { id, rowVersion, name, description, subject, parentId, outlineIds, nestedIds, componentIds, remark } = form.value
    await saveRecord('kp', { id, rowVersion, name, description, subject, parentId, outlineIds, nestedIds, componentIds, remark })
    ElMessage.success('考点保存成功')
    open.value = false
    listRef.value.reload()
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.form-hint { width: 100%; font-size: 12px; line-height: 1.6; color: #909399; margin-top: 4px; }
</style>
