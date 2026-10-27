<template>
  <section class="review-panel">
    <div class="review-toolbar">
      <el-button v-hasPermi="['knowledge:question:query']" :loading="loading" :disabled="busy" @click="load">检查当前可用性</el-button>
      <el-button v-if="question.status === 'DRAFT'" v-hasPermi="['knowledge:question:approve']" type="success" :disabled="!readiness.canApprove || !!pending || busy" @click="begin('approve')">批准正常</el-button>
      <el-button v-if="question.status === 'READY'" v-hasPermi="['knowledge:question:edit']" :disabled="!!pending || busy" @click="begin('draft')">退回草稿</el-button>
      <el-button v-if="['DRAFT', 'READY'].includes(question.status)" v-hasPermi="['knowledge:question:remove']" type="danger" plain :disabled="!!pending || busy" @click="begin('delete')">软删除</el-button>
      <el-button v-if="['DELETED', 'RETIRED'].includes(question.status)" v-hasPermi="['knowledge:question:restore']" type="warning" :disabled="!!pending || busy" @click="begin('restore')">恢复为草稿</el-button>
      <el-button v-if="question.status === 'DRAFT' && question.questionType === 'CALCULATION' && Number(question.itemCount || 1) < 3" v-hasPermi="['knowledge:question:granularityException']" :disabled="!!pending || busy" @click="begin('exception')">专项数量批准</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb8" />
    <el-alert v-if="readiness.questionId && String(readiness.rowVersion) !== String(question.rowVersion)" title="检查时发现题目版本已变化，请点击“重新读取当前题目”并重新审查。" type="warning" :closable="false" class="mb8" />
    <el-alert v-if="pending" title="上次操作结果尚未确认。请使用原操作编号查回，确认前不要重复发起其他操作。" type="warning" :closable="false" class="mb8">
      <template #default><p>操作编号：{{ pending.payload.operationId }}</p><el-button v-if="canRetry" :loading="busy" @click="submit">按原请求重试查回</el-button></template>
    </el-alert>
    <el-alert v-if="readiness.questionId" :title="readiness.eligible ? '当前题目正常可用' : '当前题目尚不可正常选用，请核对以下检查项'" :type="readiness.eligible ? 'success' : 'warning'" :closable="false" class="mb8" />
    <el-alert v-if="lastReceipt?.affectedQuestionIds?.length" :title="`此次操作已将受影响派生题退回草稿：${lastReceipt.affectedQuestionIds.join('、')}`" type="warning" :closable="false" class="mb8" />
    <review-checks :checks="readiness.checks || []" />
    <p v-if="readiness.approvalReceipt" class="receipt">批准回执：{{ readiness.approvalReceipt.operationId }} · {{ readiness.approvalReceipt.actor }} · {{ readiness.approvalReceipt.reason }}</p>
    <el-dialog v-model="dialogOpen" :title="actionInfo.label" width="620px" append-to-body :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy">
      <p>题目 {{ question.id }} · 当前版本 {{ question.rowVersion }}</p>
      <el-form v-if="['draft', 'delete'].includes(action)" label-position="top">
        <el-form-item label="处理类型">
          <el-select v-model="reasonCategory" :disabled="busy || !!pending" aria-label="退回或停用原因分类" style="width: 100%">
            <el-option label="仅停用当前题，保留既有派生" value="STOP_USE" />
            <el-option label="题目内容有误，同时退回受影响派生" value="CONTENT_ERROR" />
            <el-option label="题目来源有误，同时退回受影响派生" value="SOURCE_ERROR" />
          </el-select>
        </el-form-item>
        <el-alert :title="reasonCategory === 'STOP_USE' ? '本次只停用当前题目，保留既有派生的状态。' : '服务端会在同一事务内将受影响的正常派生题退回草稿；历史成品保留，完成后显示受影响题号。'" type="warning" :closable="false" class="mb8" />
      </el-form>
      <el-alert v-if="action === 'delete'" :title="`现有引用：专项 ${readiness.impact?.materialCount || 0} 个、派生 ${readiness.impact?.childCount || 0} 道、成品 ${readiness.impact?.productCount || 0} 个。软删除保留身份、关系和历史成品，新的选用将被阻止。`" type="warning" :closable="false" class="mb8" />
      <el-alert v-if="action === 'restore'" title="恢复后为草稿，原批准与数量例外不会自动恢复，需要重新检查。" type="info" :closable="false" class="mb8" />
      <el-alert v-if="action === 'exception'" title="只放宽当前完整计算练习的数量要求，不改变题目状态；仍需批准正常。请说明真实母题边界与依据。" type="warning" :closable="false" class="mb8" />
      <el-input v-model="reason" type="textarea" :rows="4" maxlength="2000" show-word-limit :disabled="busy || !!pending" placeholder="填写审查结论、处理理由及依据" />
      <el-checkbox v-if="action === 'approve'" v-model="reviewed" :disabled="busy || !!pending" class="review-confirm">已核对当前版本的完整题面、子项、答案、来源与教材范围</el-checkbox>
      <template #footer><el-button type="primary" :loading="busy" :disabled="!reason.trim() || (action === 'approve' && !reviewed)" @click="submit">{{ pending ? '按原请求重试查回' : actionInfo.label }}</el-button><el-button :disabled="busy" @click="dialogOpen = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import useUserStore from '@/store/modules/user'
import { checkPermi } from '@/utils/permission'
import { createRequestGeneration } from '@/utils/request-generation'
import { getQuestionReadiness, approveQuestion, returnQuestionToDraft, softDeleteQuestion, restoreQuestion, approveGranularityException } from '@/api/knowledge/review'
import { actionPayload, approvalSnapshot, knownReviewRejection, pendingReviewKey, readPendingReview, reviewActions } from './reviewState'
import ReviewChecks from './ReviewChecks.vue'

const props = defineProps({ question: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const user = useUserStore()
const readiness = ref({}), loading = ref(false), busy = ref(false), error = ref(''), pending = ref(null)
const dialogOpen = ref(false), action = ref('approve'), reason = ref(''), reviewed = ref(false), reasonCategory = ref('STOP_USE'), lastReceipt = ref(null)
const actionInfo = computed(() => reviewActions[action.value])
const approvedView = ref(null)
const storageKey = computed(() => pendingReviewKey(user.id || user.name, `question:${props.question.id}`))
const canRetry = computed(() => pending.value && checkPermi([reviewActions[pending.value.action]?.permission]))
const requests = createRequestGeneration()
const operations = { approve: approveQuestion, draft: returnQuestionToDraft, delete: softDeleteQuestion, restore: restoreQuestion }
watch(() => [props.question.id, props.question.rowVersion, user.id, user.name], (current, previous) => {
  if (!previous || current[0] !== previous[0] || current[2] !== previous[2] || current[3] !== previous[3]) lastReceipt.value = null
  requests.invalidate(); readiness.value = {}; error.value = ''; dialogOpen.value = false
  approvedView.value = null
  pending.value = readPendingReview(sessionStorage, storageKey.value)
  if (props.question.id && props.question.rowVersion != null) load()
}, { immediate: true })
onBeforeUnmount(requests.invalidate)
async function load() {
  if (!props.question.id) return
  const ticket = requests.start()
  loading.value = true; error.value = ''; readiness.value = {}
  try {
    const response = await getQuestionReadiness(props.question.id)
    if (requests.current(ticket)) readiness.value = response.data || {}
  } catch (failure) {
    if (requests.current(ticket)) error.value = failure.message || '检查失败，请重试'
  } finally { if (requests.current(ticket)) loading.value = false }
}
async function begin(value) {
  const identity = storageKey.value, version = props.question.rowVersion
  await load()
  if (storageKey.value !== identity || props.question.rowVersion !== version) return
  if (!readiness.value.questionId || String(readiness.value.rowVersion) !== String(props.question.rowVersion)) return ElMessage.warning('题目版本已经变化，请重新打开详情后审查')
  if (value === 'approve' && !readiness.value.canApprove) return ElMessage.warning('当前检查尚未通过，请核对检查项后重新审查')
  if (value === 'approve') {
    try { approvedView.value = approvalSnapshot(props.question, readiness.value) }
    catch (failure) { return ElMessage.warning(failure.message) }
  }
  action.value = value; reason.value = ''; reviewed.value = false; reasonCategory.value = 'STOP_USE'; dialogOpen.value = true
}
async function submit() {
  if (busy.value) return
  const key = storageKey.value, id = String(props.question.id)
  if (!pending.value) {
    if (!reason.value.trim() || (action.value === 'approve' && !reviewed.value)) return
    let payload
    try { payload = actionPayload(action.value === 'approve' ? approvedView.value : props.question, reason.value, reviewed.value) }
    catch (failure) { return ElMessage.warning(failure.message) }
    if (['draft', 'delete'].includes(action.value)) payload.reasonCategory = reasonCategory.value
    if (action.value === 'exception') { payload.questionId = id; delete payload.contentReviewed }
    pending.value = { action: action.value, questionId: id, payload }
    try { sessionStorage.setItem(key, JSON.stringify(pending.value)) } catch { pending.value = null; return ElMessage.error('无法保存操作编号，请检查浏览器存储后重试') }
  }
  const submitted = JSON.parse(JSON.stringify(pending.value))
  busy.value = true; error.value = ''
  try {
    const response = submitted.action === 'exception'
      ? await approveGranularityException(submitted.payload)
      : await operations[submitted.action](submitted.questionId, submitted.payload)
    const receipt = response.data
    if (submitted.action === 'exception' ? !receipt?.exceptionId : receipt?.outcome !== 'CONFIRMED') throw new Error('操作尚未确认，请保留原编号重试查回')
    sessionStorage.removeItem(key)
    if (storageKey.value !== key) return
    if (storageKey.value === key) { pending.value = null; dialogOpen.value = false; lastReceipt.value = receipt }
    ElMessage.success(submitted.action === 'exception' ? '数量例外已批准，仍需检查并批准正常' : `已确认${reviewActions[submitted.action].label}操作`)
    if (submitted.action === 'exception') await load()
    emit('changed')
  } catch (failure) {
    if (knownReviewRejection(failure)) { sessionStorage.removeItem(key); if (storageKey.value === key) pending.value = null }
    if (storageKey.value === key) error.value = failure.message || '结果尚未确认，请按原请求重试查回'
  } finally { busy.value = false }
}
defineExpose({ reload: load })
</script>
<style scoped>
.review-panel { margin: 18px 0; }
.review-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.review-confirm { margin-top: 12px; white-space: normal; height: auto; }
.receipt { color: #606266; overflow-wrap: anywhere; }
</style>
