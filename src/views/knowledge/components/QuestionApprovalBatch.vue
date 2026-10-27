<template>
  <el-dialog v-model="open" title="逐题批准正常" width="880px" append-to-body :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy">
    <el-alert title="每题按所列版本独立检查。冲突与失败会保留原因，已成功项不会回滚；请先逐题核对完整内容与依据。" type="info" :closable="false" class="mb8" />
    <el-table :data="rows" size="small" max-height="300" row-key="id">
      <el-table-column label="题目编号" prop="id" width="160" />
      <el-table-column label="名称" prop="title" min-width="200" />
      <el-table-column label="审查版本" prop="rowVersion" width="120" />
      <el-table-column label="详情" width="110"><template #default="{ row }">{{ row.contentHash ? '已打开' : '待逐题打开' }}</template></el-table-column>
      <el-table-column label="内容" width="90"><template #default="{ row }"><el-button link type="primary" @click="$emit('detail', row)">查看</el-button></template></el-table-column>
    </el-table>
    <el-input v-model="reason" type="textarea" :rows="3" maxlength="2000" show-word-limit :disabled="busy || !!requestItems.length" placeholder="填写本批审查结论及依据" class="mt12" />
    <el-checkbox v-model="reviewed" :disabled="busy || !!requestItems.length || rows.some(row => !row.contentHash)" class="mt12">已核对以上各题当前版本的题面、答案、来源及分类</el-checkbox>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="mt12" />
    <el-alert v-if="pendingItems.length" :title="`尚有 ${pendingItems.length} 项结果未确认，请按原操作编号重试查回。`" type="warning" :closable="false" class="mt12" />
    <el-alert v-if="results.length" :title="summary" :type="results.every(item => item.outcome === 'SUCCESS') && !pendingItems.length ? 'success' : 'warning'" :closable="false" class="mt12" />
    <el-table v-if="results.length" :data="results" row-key="operationId" class="mt12">
      <el-table-column label="题目编号" prop="questionId" width="160" />
      <el-table-column label="结果" width="110"><template #default="{ row }">{{ outcomeLabels[row.outcome] || '待核对' }}</template></el-table-column>
      <el-table-column label="当前版本" min-width="120"><template #default="{ row }">{{ row.receipt?.currentRowVersion || row.receipt?.rowVersion || '—' }}</template></el-table-column>
      <el-table-column label="反馈" min-width="260"><template #default="{ row }">{{ row.message || row.receipt?.reason || '已取得回执' }}<span v-if="row.nextAction">（{{ nextActionLabels[row.nextAction] || '请核对当前题目与回执' }}）</span></template></el-table-column>
    </el-table>
    <template #footer>
      <el-button v-hasPermi="['knowledge:question:approve']" type="primary" :loading="busy" :disabled="(!pendingItems.length && !!results.length) || (!requestItems.length && (!reviewed || !reason.trim()))" @click="submit">{{ pendingItems.length ? '按原请求重试未确认项' : '逐题批准' }}</el-button>
      <el-button :disabled="busy" @click="open = false">关闭</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { approveQuestions } from '@/api/knowledge/review'
import useUserStore from '@/store/modules/user'
import { batchItems, mergeApprovalResults, unresolvedApprovalItems, pendingReviewKey, knownReviewRejection } from './reviewState'

const emit = defineEmits(['changed', 'detail'])
const user = useUserStore()
const open = ref(false), busy = ref(false), rows = ref([]), reason = ref(''), reviewed = ref(false), error = ref('')
const requestItems = ref([]), results = ref([])
const storageKey = computed(() => pendingReviewKey(user.id || user.name, 'approve-batch'))
const pendingItems = computed(() => unresolvedApprovalItems(requestItems.value, results.value))
const outcomeLabels = { SUCCESS: '已批准', CONFLICT: '版本冲突', FAILED: '未通过', PENDING: '待对账' }
const nextActionLabels = { RETRY_SAME_OPERATION: '按原操作编号查回', REVIEW_CURRENT_VERSION: '重新查看当前版本后审查' }
watch(() => [user.id, user.name], () => { open.value = false; rows.value = []; requestItems.value = []; results.value = []; error.value = '' })
const summary = computed(() => `已批准 ${results.value.filter(item => item.outcome === 'SUCCESS').length} 项，冲突 ${results.value.filter(item => item.outcome === 'CONFLICT').length} 项，未通过 ${results.value.filter(item => item.outcome === 'FAILED').length} 项`)
function show(selected = []) {
  if (busy.value) return
  let saved
  try { saved = JSON.parse(sessionStorage.getItem(storageKey.value) || 'null') } catch { saved = null }
  if (saved?.items?.length) {
    rows.value = saved.rows || saved.items.map(item => ({ id: item.questionId, rowVersion: item.expectedRowVersion }))
    requestItems.value = saved.items; results.value = saved.results || []; reason.value = saved.items[0].reason; reviewed.value = true
  } else {
    if (!selected.length) return ElMessage.info('没有未确认的批量审批，请先选择草稿题')
    if (selected.length > 50) return ElMessage.warning('每次最多批准 50 道草稿题')
    if (selected.some(row => row.status !== 'DRAFT')) return ElMessage.warning('批量批准只接受草稿，请切换草稿视图重新选择')
    rows.value = selected.map(row => ({ id: row.id, rowVersion: row.rowVersion, title: row.title }))
    requestItems.value = []; results.value = []; reason.value = ''; reviewed.value = false
  }
  error.value = ''; open.value = true
}
function persist(key) {
  if (pendingItems.value.length) sessionStorage.setItem(key, JSON.stringify({ items: requestItems.value, results: results.value, rows: rows.value }))
  else sessionStorage.removeItem(key)
}
function recordViewed(question) {
  if (!open.value || busy.value || requestItems.value.length) return
  const row = rows.value.find(item => item.id === question.id)
  if (!row) return
  reviewed.value = false
  row.rowVersion = question.rowVersion
  row.contentHash = question.status === 'DRAFT' ? question.contentHash : null
}
async function submit() {
  if (busy.value) return
  try { if (!requestItems.value.length) requestItems.value = batchItems(rows.value, reason.value) }
  catch (failure) { return ElMessage.warning(failure.message) }
  const key = storageKey.value
  try { persist(key) } catch { requestItems.value = []; return ElMessage.error('无法保存本批操作编号，请检查浏览器存储后重试') }
  const items = JSON.parse(JSON.stringify(pendingItems.value))
  if (!items.length) return
  busy.value = true; error.value = ''
  try {
    const response = await approveQuestions({ items })
    if (storageKey.value !== key) return
    if (!Array.isArray(response.data?.items)) throw new Error('批量结果格式不完整，请按原编号查回')
    results.value = mergeApprovalResults(results.value, response.data.items, requestItems.value)
    persist(key)
    if (response.data.items.some(item => item.outcome === 'SUCCESS')) emit('changed')
  } catch (failure) {
    if (storageKey.value !== key) return
    if (knownReviewRejection(failure)) {
      results.value = mergeApprovalResults(results.value, items.map(item => ({ questionId: item.questionId, operationId: item.operationId, outcome: failure.businessCode === 409 ? 'CONFLICT' : 'FAILED', message: failure.message })))
      persist(key)
    }
    error.value = failure.message || '本批结果尚未确认，请保留原编号重试查回'
  } finally { busy.value = false }
}
defineExpose({ show, recordViewed })
</script>
