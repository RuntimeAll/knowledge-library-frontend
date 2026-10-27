<template>
  <div class="app-container candidate-page">
    <div class="candidate-toolbar"><el-button :loading="loading" :disabled="busy" @click="load">刷新候选</el-button><el-button @click="router.push('/knowledge/question')">返回题库</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb8" />
    <el-alert v-if="actionError" :title="actionError" type="error" :closable="false" class="mb8" />
    <el-alert v-if="receipt" :title="`数量例外已确认：${receipt.exceptionId}。请回到原运行继续草稿入库。`" type="success" :closable="false" class="mb8" />
    <section v-if="pending" class="pending-recovery">
      <el-alert title="上次专项批准结果尚未确认。即使候选暂不可读取，仍可用原请求向知识库查回结果。" type="warning" :closable="false" />
      <p>原操作编号：{{ pending.payload.operationId }}</p>
      <p>原运行 / 候选：{{ pending.payload.runId }} / {{ pending.payload.candidateKey }}</p>
      <p class="hash">原候选哈希：{{ pending.payload.candidateHash }}</p>
      <el-button v-hasPermi="['knowledge:question:granularityException']" type="warning" :loading="busy" @click="approve">按原请求重试查回</el-button>
    </section>
    <template v-if="candidate">
      <el-alert title="此内容尚未创建题目编号。专项数量批准只允许当前候选存为草稿，之后仍需批准正常。" type="info" :closable="false" class="mb8" />
      <el-alert v-if="candidate.workerKind === 'FAKE'" title="这是恢复测试候选，不能进行真实审批或写入题库。" type="warning" :closable="false" class="mb8" />
      <el-alert v-else-if="candidate.current !== true" title="此候选已过期或当前修订未确认，请从运行待办打开最新审核链接。" type="warning" :closable="false" class="mb8" />
      <el-descriptions border :column="2">
        <el-descriptions-item label="运行编号">{{ candidate.runId }}</el-descriptions-item>
        <el-descriptions-item label="题组 / 角色">{{ candidate.groupKey }} / {{ roleLabels[candidate.role] || candidate.role }}</el-descriptions-item>
        <el-descriptions-item label="候选编号">{{ candidate.candidateKey }}</el-descriptions-item>
        <el-descriptions-item label="候选修订">{{ candidate.candidateRevision }}</el-descriptions-item>
        <el-descriptions-item label="内容类型">{{ label('contentKind', metadata.contentKind || 'EXERCISE') }}</el-descriptions-item>
        <el-descriptions-item label="题型">{{ label('questionType', metadata.questionType) }}</el-descriptions-item>
        <el-descriptions-item label="实际小题数">{{ itemCount }}</el-descriptions-item>
        <el-descriptions-item label="真实来源">{{ candidate.sourceId || '待补充' }}</el-descriptions-item>
        <el-descriptions-item label="关联考点" :span="2"><relation-names type="kp" :ids="metadata.kpIds || []" /></el-descriptions-item>
        <el-descriptions-item label="候选完整哈希" :span="2"><code class="hash">{{ candidate.candidateHash }}</code></el-descriptions-item>
      </el-descriptions>
      <h3>{{ metadata.title || '候选内容' }}</h3>
      <h4>题干与子项</h4><html-preview :html="candidateContent(candidate.record, 'stem')" :layout-mode="metadata.layoutMode || 'PLAIN'" />
      <h4>答案</h4><html-preview :html="candidateContent(candidate.record, 'answer')" answer />
      <h4>解析</h4><html-preview :html="candidateContent(candidate.record, 'analysis')" answer />
      <candidate-source-evidence :source-id="candidate.sourceId || ''" :locator="candidate.sourceLocator || {}" />
      <el-table v-if="candidate.evidenceRefs?.length" :data="candidate.evidenceRefs" size="small">
        <el-table-column label="证据引用" prop="artifactId" min-width="220" />
        <el-table-column label="SHA-256" prop="sha256" min-width="280" />
        <el-table-column label="类型" prop="mediaType" min-width="140" />
        <el-table-column label="字节数" prop="byteSize" width="120" />
      </el-table>
      <p v-if="candidate.evidenceRefs?.length" class="evidence-note">运行证据按引用与哈希核对。来源原件的可查看状态以上方实际读取结果为准；缺少可核验的题面或母题边界时，请先补证据。</p>
      <el-form label-position="top" class="mt12" :disabled="busy || !!pending || !!receipt">
        <el-form-item label="专项批准理由与真实母题依据"><el-input v-model="reason" type="textarea" :rows="4" maxlength="2000" show-word-limit /></el-form-item>
        <el-checkbox v-model="reviewed">已核对完整题面、解答、真实来源与母题边界，确认无需添题或拼题</el-checkbox>
      </el-form>
      <el-button v-if="!pending" v-hasPermi="['knowledge:question:granularityException']" class="mt12" type="warning" :loading="busy" :disabled="loading || !!receipt || !reviewable || !reason.trim() || !reviewed" @click="approve">批准当前候选的数量例外</el-button>
    </template>
    <el-empty v-else-if="!loading && !error" description="未取得候选快照" />
  </div>
</template>
<script setup name="KnowledgeCandidateReview">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import useUserStore from '@/store/modules/user'
import { getReviewCandidate, approveGranularityException } from '@/api/knowledge/review'
import { createRequestGeneration } from '@/utils/request-generation'
import { newOperationId, pendingReviewKey, readPendingReview, knownReviewRejection } from '../components/reviewState'
import { candidateContent, candidateReviewable } from '../components/candidateContent'
import { label } from '../components/labels'
import HtmlPreview from '../components/HtmlPreview.vue'
import CandidateSourceEvidence from '../components/CandidateSourceEvidence.vue'
import RelationNames from '../components/RelationNames.vue'
defineOptions({ name: 'KnowledgeCandidateReview' })

const route = useRoute(), router = useRouter(), user = useUserStore()
const candidate = ref(null), receipt = ref(null), loading = ref(false), busy = ref(false), error = ref(''), actionError = ref(''), reason = ref(''), reviewed = ref(false), pending = ref(null)
const runId = computed(() => String(route.params.runId || '')), candidateKey = computed(() => String(route.params.candidateKey || ''))
const key = computed(() => pendingReviewKey(user.id || user.name, `candidate:${runId.value}:${candidateKey.value}`))
const metadata = computed(() => candidate.value?.record?.metadata || {})
const itemCount = computed(() => {
  const record = candidate.value?.record || {}
  if (record.items?.length) return record.items.length
  const documentHtml = new DOMParser().parseFromString(candidateContent(record), 'text/html')
  return documentHtml.querySelector('[data-kb-role="group"]')?.querySelectorAll(':scope > [data-item-key]').length || 1
})
const reviewable = computed(() => candidateReviewable(candidate.value, runId.value, candidateKey.value))
const requests = createRequestGeneration()
const roleLabels = { ORIGINAL: '原题', VARIANT_1: '变式一', VARIANT_2: '变式二', EXTENSION: '提升拓展' }
watch(() => [runId.value, candidateKey.value, user.id, user.name], () => {
  requests.invalidate(); candidate.value = null; receipt.value = null; reason.value = ''; reviewed.value = false; actionError.value = ''
  pending.value = readPendingReview(sessionStorage, key.value)
  load()
}, { immediate: true })
onBeforeUnmount(requests.invalidate)
async function load() {
  const ticket = requests.start()
  loading.value = true; error.value = ''
  try {
    const response = await getReviewCandidate(runId.value, candidateKey.value)
    if (!requests.current(ticket)) return
    candidate.value = response.data
    receipt.value = response.data?.granularityExceptionReceipt || null
  } catch (failure) {
    if (requests.current(ticket)) { candidate.value = null; error.value = failure.message || '无法读取候选，请重试或返回运行待办' }
  } finally { if (requests.current(ticket)) loading.value = false }
}
async function approve() {
  if (busy.value || (!pending.value && (loading.value || !reviewable.value))) return
  const storage = key.value
  if (!pending.value) {
    if (!reviewed.value || !reason.value.trim()) return
    pending.value = { action: 'exception', payload: { operationId: newOperationId(), reason: reason.value.trim(), runId: runId.value, candidateKey: candidateKey.value, candidateHash: candidate.value.candidateHash } }
    try { sessionStorage.setItem(storage, JSON.stringify(pending.value)) } catch { pending.value = null; return ElMessage.error('无法保存操作编号，请检查浏览器存储后重试') }
  }
  const submitted = JSON.parse(JSON.stringify(pending.value.payload))
  busy.value = true; actionError.value = ''
  try {
    const response = await approveGranularityException(submitted)
    if (!response.data?.exceptionId) throw new Error('未取得有效例外回执，请按原编号重试查回')
    sessionStorage.removeItem(storage)
    if (key.value === storage) { requests.invalidate(); loading.value = false; receipt.value = response.data; pending.value = null }
  } catch (failure) {
    if (knownReviewRejection(failure)) { sessionStorage.removeItem(storage); if (key.value === storage) pending.value = null }
    if (key.value === storage) actionError.value = failure.message || '批准结果尚未确认，请按原请求查回'
  } finally { busy.value = false }
}
</script>
<style scoped>
.candidate-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.hash { overflow-wrap: anywhere; white-space: pre-wrap; }
.pending-recovery { padding: 12px; margin-bottom: 16px; border: 1px solid #e6a23c; border-radius: 4px; }
.evidence-note { color: #606266; }
</style>
