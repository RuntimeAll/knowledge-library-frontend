<template>
  <el-dialog v-model="open" :title="readonly ? (form.status === 'DRAFT' ? '查看模板草稿' : '查看已冻结模板版本') : form.id ? '编辑模板草稿' : '新增模板版本'" width="1120px" append-to-body destroy-on-close :close-on-click-modal="!saving">
    <el-alert :title="form.status === 'PUBLISHED' ? '此版本已发布，内容保持不变。需要调整时，请复制为新草稿。' : readonly ? '当前账号可查看此草稿，修改需要模板维护权限。' : '保存排版规则和可配置字段；模板不绑定年级、教材或固定题单。'" type="info" :closable="false" class="mb8" />
    <el-form label-width="110px" :disabled="readonly || saving">
      <el-form-item label="修订说明"><el-input v-model="form.changeNote" type="textarea" :rows="2" maxlength="2000" /></el-form-item>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="HTML 与样式" name="layout">
          <p class="form-note">文本字段使用 data-kb-field，题单使用唯一的 data-kb-slot="sections"。不支持脚本、外部地址及任意表达式。</p>
          <el-form-item label="模板 HTML"><el-input v-model="form.definition.html" type="textarea" :rows="10" class="code-input" /></el-form-item>
          <el-form-item label="打印 CSS"><el-input v-model="form.definition.css" type="textarea" :rows="8" class="code-input" /></el-form-item>
        </el-tab-pane>
        <el-tab-pane label="页面与组织" name="page">
          <el-row :gutter="20">
            <el-col :span="12"><el-form-item label="纸型"><el-select v-model="form.definition.page.size"><el-option label="A4" value="A4" /><el-option label="A5" value="A5" /><el-option label="A3" value="A3" /></el-select></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="方向"><el-radio-group v-model="form.definition.page.orientation"><el-radio value="portrait">纵向</el-radio><el-radio value="landscape">横向</el-radio></el-radio-group></el-form-item></el-col>
            <el-col v-for="side in margins" :key="side.key" :span="12"><el-form-item :label="side.label"><el-input-number v-model="form.definition.page[side.key]" :min="5" :max="40" /> 毫米</el-form-item></el-col>
            <el-col :span="12"><el-form-item label="字号"><el-input-number v-model="form.definition.page.fontSizePt" :min="8" :max="24" /> 磅</el-form-item></el-col>
            <el-col :span="12"><el-form-item label="行距"><el-input-number v-model="form.definition.page.lineHeight" :min="1" :max="3" :step="0.1" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="分栏"><el-input-number v-model="form.definition.page.columns" :min="1" :max="3" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="题目间距"><el-input-number v-model="form.definition.page.questionGapMm" :min="0" :max="30" /> 毫米</el-form-item></el-col>
            <el-col :span="12"><el-form-item label="作答留白"><el-input-number v-model="form.definition.page.answerSpaceMm" :min="0" :max="150" /> 毫米</el-form-item></el-col>
            <el-col :span="12"><el-form-item label="选项布局"><el-select v-model="form.definition.content.optionLayout"><el-option label="自动适配（4、2、1列）" value="AUTO" /><el-option label="固定列数" value="FIXED" /></el-select></el-form-item></el-col>
            <el-col v-if="form.definition.content.optionLayout !== 'AUTO'" :span="12"><el-form-item label="选项列数"><el-input-number v-model="form.definition.content.optionColumns" :min="1" :max="4" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="图片最大宽度"><el-input-number v-model="form.definition.content.imageMaxWidthPercent" :min="10" :max="100" /> %</el-form-item></el-col>
            <el-col :span="12"><el-form-item label="题号规则"><el-select v-model="form.definition.organization.numbering"><el-option label="全文连续编号" value="CONTINUOUS" /><el-option label="每栏重新编号" value="SECTION" /></el-select></el-form-item></el-col>
          </el-row>
          <el-form-item label="换页与解析"><el-checkbox v-model="form.definition.organization.sectionPageBreak">栏目独立起页</el-checkbox><el-checkbox v-model="form.definition.organization.dayPageBreak">每天独立起页</el-checkbox><el-checkbox v-model="form.definition.content.showAnalysis">答案版显示解析</el-checkbox></el-form-item>
        </el-tab-pane>
        <el-tab-pane label="动态字段与默认值" name="fields">
          <p class="form-note">字段类型支持文本、数字、开关和文本列表；字段名必须与 HTML 的 data-kb-field 对应。页面填写与 Agent JSON 共用这些定义。</p>
          <el-form-item label="字段定义 JSON"><el-input v-model="schemaText" type="textarea" :rows="14" class="code-input" /></el-form-item>
          <el-form-item label="默认值 JSON"><el-input v-model="defaultsText" type="textarea" :rows="8" class="code-input" /></el-form-item>
        </el-tab-pane>
        <el-tab-pane label="模板固定资源" name="assets">
          <el-alert title="使用已上传的资产编号登记徽标或固定插图，HTML 中使用 data-kb-resource 引用资源键。引用会保护资产免于误删。" :closable="false" type="info" class="mb8" />
          <el-form-item label="资源 JSON"><el-input v-model="assetsText" type="textarea" :rows="12" class="code-input" placeholder='[{"resourceKey":"logo","assetId":"实际资产编号","assetRole":"TEMPLATE_IMAGE"}]' /></el-form-item>
        </el-tab-pane>
      </el-tabs>
    </el-form>
    <el-collapse v-model="previewPanels" @change="refreshPreview"><el-collapse-item title="版式预览与动态字段试填" name="preview">
      <p class="form-note">预览展示模板和示例题插槽。正式图片、公式与 PDF 分页在生成任务中校验。</p>
      <el-button size="small" icon="Refresh" @click="refreshPreview">应用当前编辑并刷新预览</el-button>
      <el-row :gutter="20" class="mt8"><el-col :span="9"><el-form label-width="90px"><template-fields v-model="previewValues" :fields="previewFields" /></el-form></el-col><el-col :span="15"><iframe title="模板安全预览" sandbox="" :srcdoc="previewDocument" class="template-preview" /></el-col></el-row>
    </el-collapse-item></el-collapse>
    <template #footer><el-button v-if="!readonly" v-hasPermi="['knowledge:experience:edit']" type="primary" :loading="saving" @click="save">保存草稿</el-button><el-button @click="open = false">关闭</el-button></template>
  </el-dialog>
</template>
<script setup>
import { ElMessage } from 'element-plus'
import { getExperienceVersion, saveExperienceVersion } from '@/api/knowledge/experience'
import { checkPermi } from '@/utils/permission'
import TemplateFields from './TemplateFields.vue'
import { defaultTemplate, templatePreview } from './templateDefinition'
const emit = defineEmits(['saved'])
const open = ref(false), readonly = ref(false), saving = ref(false), activeTab = ref('layout'), form = ref(defaultTemplate())
const schemaText = ref('[]'), defaultsText = ref('{}'), assetsText = ref('[]'), previewPanels = ref([]), previewValues = ref({}), previewFields = ref([]), previewDefinition = ref({})
const margins = [{ key:'marginTopMm', label:'上边距' }, { key:'marginRightMm', label:'右边距' }, { key:'marginBottomMm', label:'下边距' }, { key:'marginLeftMm', label:'左边距' }]
let experienceId
const previewDocument = computed(() => templatePreview(previewDefinition.value, previewValues.value))
async function show(id, version, copy = false) {
  experienceId = id
  const current = version?.id ? (await getExperienceVersion(version.id)).data : defaultTemplate()
  form.value = structuredClone(current)
  form.value.definition.content.optionLayout ??= 'FIXED'
  if (copy) { delete form.value.id; delete form.value.rowVersion; delete form.value.versionNo; form.value.changeNote = `基于第 ${current.versionNo} 版调整`; form.value.status = 'DRAFT' }
  readonly.value = !checkPermi(['knowledge:experience:edit']) || (!!form.value.id && form.value.status !== 'DRAFT')
  activeTab.value = 'layout'; previewPanels.value = []
  schemaText.value = JSON.stringify(form.value.fieldSchema || [], null, 2)
  defaultsText.value = JSON.stringify(form.value.defaultValues || {}, null, 2)
  assetsText.value = JSON.stringify(form.value.assets || [], null, 2)
  refreshPreview(); open.value = true
}
function parseEditor() {
  const fieldSchema = JSON.parse(schemaText.value), defaultValues = JSON.parse(defaultsText.value), assets = JSON.parse(assetsText.value)
  if (!Array.isArray(fieldSchema) || !Array.isArray(assets) || !defaultValues || Array.isArray(defaultValues) || typeof defaultValues !== 'object') throw new Error('字段和资源应为 JSON 数组，默认值应为 JSON 对象')
  return { fieldSchema, defaultValues, assets }
}
function refreshPreview() {
  try {
    const { fieldSchema, defaultValues } = parseEditor()
    previewFields.value = fieldSchema
    previewValues.value = { ...Object.fromEntries(fieldSchema.filter(f => f.defaultValue !== undefined).map(f => [f.key, f.defaultValue])), ...defaultValues }
    previewDefinition.value = JSON.parse(JSON.stringify(form.value.definition))
  } catch (error) { ElMessage.error(`无法预览：${error.message}`) }
}
async function save() {
  let fields
  try { fields = parseEditor() } catch (error) { ElMessage.error(error.message); return }
  saving.value = true
  try {
    await saveExperienceVersion(experienceId, { ...(form.value.id ? { id:form.value.id, rowVersion:form.value.rowVersion } : {}), schemaVersion:'kb-layout-template/v1', ...fields, definition:form.value.definition, changeNote:form.value.changeNote })
    ElMessage.success('模板草稿已保存'); open.value = false; emit('saved')
  } finally { saving.value = false }
}
defineExpose({ show })
</script>
<style scoped>
.form-note{font-size:13px;color:#606266;line-height:1.8}.code-input :deep(textarea){font-family:Consolas,monospace;font-size:13px}.template-preview{border:1px solid #dcdfe6;width:100%;height:520px;background:#f5f7fa}
</style>
