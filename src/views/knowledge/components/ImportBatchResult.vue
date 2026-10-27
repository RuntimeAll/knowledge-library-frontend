<template>
  <div class="import-result">
    <el-alert :title="`${label('importStatus', result.status)}：成功 ${result.successCount || 0}，失败 ${result.failureCount || 0}`" :type="result.status === 'SUCCESS' ? 'success' : result.status === 'FAILED' ? 'error' : 'warning'" :closable="false" show-icon />
    <el-alert v-if="result.successCount" title="导入成功表示内容已保存。新题为草稿；修改正常题的关键内容后也需重新批准。请按题目编号查看实际状态。" type="info" :closable="false" class="mt12" />
    <p>批次编号：{{ result.batchId }}
      <el-button v-hasPermi="['knowledge:import:query']" link type="primary" :disabled="busy" @click="$emit('refresh')">刷新结果</el-button>
      <el-button v-if="result.status === 'PROCESSING' && result.inputReady" v-hasPermi="['knowledge:import:execute']" type="warning" plain :disabled="leaseActive || busy" :loading="resuming" @click="$emit('resume')">恢复未完成题目</el-button>
    </p>
    <el-alert v-if="recoveryNotice" :title="recoveryNotice" :type="result.status === 'FAILED' ? 'error' : 'warning'" :closable="false" show-icon class="mb8" />
    <el-alert v-if="result.lastError" :title="`上次处理反馈：${result.lastError}`" type="warning" :closable="false" class="mb8" />
    <el-table :data="result.items || []">
      <el-table-column label="本地题目标识" prop="clientKey" min-width="170" />
      <el-table-column label="处理方式" width="100"><template #default="{ row }">{{ intentLabels[row.intent] || '未识别' }}</template></el-table-column>
      <el-table-column label="执行结果" width="110"><template #default="{ row }">{{ label('importItemStatus', row.status) }}</template></el-table-column>
      <el-table-column label="题目编号" min-width="160"><template #default="{ row }"><router-link v-if="row.questionId" :to="{ path: '/knowledge/question', query: { questionId: String(row.questionId) } }">{{ row.questionId }}</router-link><span v-else>尚未建题</span></template></el-table-column>
      <el-table-column label="反馈" prop="message" min-width="240" />
    </el-table>
    <el-collapse v-if="result.resources?.length">
      <el-collapse-item :title="`已接收 ${result.resources.length} 个配套资源`"><el-table :data="result.resources"><el-table-column label="资源文件" prop="resourceKey" min-width="240" /><el-table-column label="文件大小" width="120"><template #default="{ row }">{{ Math.ceil(Number(row.fileSize || 0) / 1024) }} KB</template></el-table-column></el-table></el-collapse-item>
    </el-collapse>
  </div>
</template>
<script setup>
import { label } from './labels'
defineProps({ result: { type: Object, required: true }, busy: Boolean, resuming: Boolean, leaseActive: Boolean, recoveryNotice: { type: String, default: '' } })
defineEmits(['refresh', 'resume'])
const intentLabels = { create: '新建', update: '更新原题', derive: '新建变式' }
</script>
<style scoped>
.import-result { margin-top: 20px; }
</style>
