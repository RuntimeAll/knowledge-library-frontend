<template>
  <el-form-item v-for="field in fields" :key="field.key" :label="field.title"><enum-select v-model="query[field.key]" :field="field.key" clearable style="width:140px" /></el-form-item>
  <outline-scope-filter v-model:outline-id="query.outlineId" v-model:outline-node-id="query.outlineNodeId" />
  <el-form-item v-if="query.outlineNodeId" label="章节匹配"><el-select v-model="query.chapterMatch" clearable style="width:150px"><el-option label="指定节点" value="EXACT" /><el-option label="含下级章节" value="SUBTREE" /></el-select></el-form-item>
  <el-form-item label="考点"><record-picker :model-value="query.kpId ? [query.kpId] : []" type="kp" :multiple="false" :filters="{subject:query.subject}" @update:model-value="query.kpId = $event[0]" /></el-form-item>
  <el-form-item v-if="query.kpId" label="覆盖依据"><el-select v-model="query.coverageMode" clearable style="width:150px"><el-option label="声明覆盖" value="DECLARED" /><el-option label="实际题单" value="ACTUAL" /></el-select></el-form-item>
  <el-form-item label="年份含义"><el-select v-model="query.yearField" clearable style="width:140px" @change="query.yearFrom = query.yearTo = undefined"><el-option label="出版年份" value="publishedYear" /><el-option label="编制年份" value="preparedYear" /><el-option v-if="kind === 'source'" label="考试年份" value="examYear" /><el-option v-if="kind === 'source'" label="学年起始年" value="academicYearStart" /></el-select></el-form-item>
  <el-form-item v-if="query.yearField" label="年份范围"><el-input-number v-model="query.yearFrom" :min="1900" :max="2100" controls-position="right" style="width:125px" /><span class="range-gap">至</span><el-input-number v-model="query.yearTo" :min="1900" :max="2100" controls-position="right" style="width:125px" /></el-form-item>
  <el-form-item label="区域角色"><enum-select v-model="query.regionRole" field="regionRole" :include-values="kind === 'product' ? ['APPLICABLE'] : null" clearable style="width:150px" /></el-form-item>
  <el-form-item label="区域"><region-picker v-model="query.regionCode" @change="regionChanged" /></el-form-item>
  <el-form-item v-if="query.regionCode"><el-checkbox v-model="query.regionDescendants">包含下级区域</el-checkbox><el-checkbox v-if="query.regionRole === 'APPLICABLE'" v-model="query.includeNationwide">包含全国适用</el-checkbox></el-form-item>
  <el-form-item v-if="kind === 'product'" label="版本范围"><el-select v-model="query.historyMode" clearable style="width:150px"><el-option label="仅最新版本" value="LATEST" /><el-option label="任一历史版本" value="ANY" /></el-select></el-form-item>
</template>
<script setup>
import EnumSelect from './EnumSelect.vue'
import OutlineScopeFilter from './OutlineScopeFilter.vue'
import RecordPicker from './RecordPicker.vue'
import RegionPicker from './RegionPicker.vue'
const props = defineProps({ query: Object, kind: String })
function regionChanged(region) { if (region && !props.query.regionRole) props.query.regionRole = 'APPLICABLE' }
const fields = computed(() => [
  { key:'subject',title:'学科' }, {key:'resourceType',title:'资料类型'}, {key:'catalogStatus',title:'资料状态'},
  {key:'textbookVersion',title:'教材版本'}, {key:'grade',title:'教材年级'}, {key:'term',title:'教材学期'},
  ...(props.kind === 'product' ? [{key:'audienceRole',title:'使用角色'}, {key:'provenanceStatus',title:'溯源状态'}] : [])
])
watch(() => props.query.regionRole, role => { if (role !== 'APPLICABLE') props.query.includeNationwide = undefined })
watch(() => props.query.regionCode, code => { if (!code) { props.query.regionRole = undefined; props.query.regionDescendants = undefined; props.query.includeNationwide = undefined } })
</script>
<style scoped>.range-gap { margin:0 8px; }</style>
