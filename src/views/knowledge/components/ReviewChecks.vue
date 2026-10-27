<template>
  <el-table v-if="checks.length" :data="checks" size="small" row-key="code">
    <el-table-column label="检查项" prop="code" width="145" />
    <el-table-column label="结果" width="90"><template #default="{ row }"><el-tag :type="row.passed ? 'success' : 'warning'">{{ row.passed ? '通过' : '待处理' }}</el-tag></template></el-table-column>
    <el-table-column label="说明" prop="message" min-width="240" />
  </el-table>
</template>
<script setup>
defineProps({ checks: { type: Array, default: () => [] } })
</script>
