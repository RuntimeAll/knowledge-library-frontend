<template>
  <el-table-column label="学科 / 资料类型" min-width="155"><template #default="{ row }">{{ label('subject', row.profile?.subject) }}<br>{{ label('resourceType', row.profile?.resourceType) }}</template></el-table-column>
  <el-table-column v-if="kind === 'product'" label="使用角色" min-width="110"><template #default="{ row }">{{ label('audienceRole', row.profile?.audienceRole) }}</template></el-table-column>
  <el-table-column label="教材范围" min-width="240"><template #default="{ row }">
    <div v-for="scope in row.outlineScopes || []" :key="scope.outlineId">{{ scope.outlineTitle || '教材信息待加载' }} · {{ label('scopeKind', scope.scopeKind) }}<small v-if="scope.scopeKind === 'CHAPTERS'">（{{ scope.nodeIds?.length || 0 }} 处章节）</small></div>
    <span v-if="!row.outlineScopes?.length">尚未声明</span>
  </template></el-table-column>
  <el-table-column label="考点" min-width="170"><template #default="{ row }"><relation-names type="kp" :ids="row.declaredKpIds" /></template></el-table-column>
  <el-table-column label="年份 / 区域" min-width="170"><template #default="{ row }">
    <div v-if="row.profile?.publishedYear">出版 {{ row.profile.publishedYear }}</div><div v-if="row.profile?.preparedYear">编制 {{ row.profile.preparedYear }}</div>
    <div v-for="region in row.regions || []" :key="`${region.role}-${region.regionCode}`">{{ label('regionRole', region.role) }}：{{ region.name || '区域信息待加载' }}</div>
    <span v-if="!row.profile?.publishedYear && !row.profile?.preparedYear && !row.regions?.length">未登记</span>
  </template></el-table-column>
  <el-table-column label="资料状态" min-width="150"><template #default="{ row }"><el-tag :type="row.profile?.catalogStatus === 'READY' ? 'success' : 'info'">{{ label('catalogStatus', row.profile?.catalogStatus) }}</el-tag><div v-for="reason in row.readinessReasons || []" :key="reason" class="reason">{{ reason }}</div></template></el-table-column>
  <el-table-column label="命中依据" min-width="190"><template #default="{ row }"><div v-for="reason in row.matchReasons || []" :key="reason">{{ reason }}</div><span v-if="!row.matchReasons?.length">按当前查询范围展示</span><div v-if="row.matchedProductId">匹配第 {{ row.versionNo }} 版</div></template></el-table-column>
</template>
<script setup>
import { label } from './labels'
import RelationNames from './RelationNames.vue'
defineProps({ kind: String })
</script>
<style scoped>.reason {font-size:12px;color:#909399;line-height:1.7;}</style>
