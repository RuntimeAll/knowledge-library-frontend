<template>
  <section class="candidate-source">
    <h4>来源原件与母题位置</h4>
    <el-descriptions border :column="2">
      <el-descriptions-item label="来源编号">{{ sourceId || '未关联' }}</el-descriptions-item>
      <el-descriptions-item label="来源名称">{{ source?.title || '尚未读取' }}</el-descriptions-item>
      <el-descriptions-item label="文件页码">{{ locator.physicalPage || '未提供' }}</el-descriptions-item>
      <el-descriptions-item label="印刷页码">{{ locator.printedPage || '未提供' }}</el-descriptions-item>
      <el-descriptions-item label="题号">{{ locator.questionNo || '未提供' }}</el-descriptions-item>
      <el-descriptions-item label="位置说明">{{ locator.note || '未提供' }}</el-descriptions-item>
    </el-descriptions>
    <el-alert v-if="!sourceId" title="候选未关联知识库来源，当前没有可查看的来源原件；请先补充真实来源与母题边界依据。" type="warning" :closable="false" class="mt12" />
    <el-alert v-else-if="!canReadSource" :title="`当前账号没有来源查看权限，无法读取来源 ${sourceId} 的原件；上方保留来源编号与原始定位。`" type="warning" :closable="false" class="mt12" />
    <template v-else>
      <el-button class="mt12" :loading="loading" @click="load">重新读取来源原件</el-button>
      <el-alert v-if="error" :title="`无法读取来源原件：${error}`" type="error" :closable="false" class="mt12" />
      <template v-else-if="source">
        <el-alert v-if="!source.assetIds?.length" title="此来源尚未关联原件资产，当前只有来源身份与位置记录；请补充可核验原件后审查。" type="warning" :closable="false" class="mt12" />
        <el-alert v-else-if="!canReadAssets" title="当前账号没有原件资产查看权限，无法打开已关联文件；请使用具备相应权限的账号核对原件。" type="warning" :closable="false" class="mt12" />
        <asset-files v-else :model-value="source.assetIds" />
      </template>
    </template>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getRecord } from '@/api/knowledge'
import { checkPermi } from '@/utils/permission'
import { createRequestGeneration } from '@/utils/request-generation'
import useUserStore from '@/store/modules/user'
import AssetFiles from './AssetFiles.vue'

const props = defineProps({ sourceId: { type: String, default: '' }, locator: { type: Object, default: () => ({}) } })
const user = useUserStore(), requests = createRequestGeneration()
const source = ref(null), loading = ref(false), error = ref('')
const canReadSource = computed(() => checkPermi(['knowledge:source:query']))
const canReadAssets = computed(() => checkPermi(['knowledge:asset:query']))
watch(() => [props.sourceId, user.id, user.name, canReadSource.value], load, { immediate: true })
onBeforeUnmount(requests.invalidate)
async function load() {
  const ticket = requests.start()
  source.value = null; error.value = ''; loading.value = false
  if (!props.sourceId || !canReadSource.value) return
  loading.value = true
  try {
    const response = await getRecord('source', props.sourceId)
    if (requests.current(ticket)) source.value = response.data
  } catch (failure) {
    if (requests.current(ticket)) error.value = failure.message || '来源读取失败，请重试'
  } finally { if (requests.current(ticket)) loading.value = false }
}
</script>
