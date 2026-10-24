<template>
  <el-alert v-if="model.readinessReasons?.length" type="warning" :closable="false" show-icon class="mb8" :title="`待补信息：${model.readinessReasons.join('；')}`" />
  <el-row :gutter="20">
    <el-col :span="12"><el-form-item label="学科"><enum-select v-model="model.profile.subject" field="subject" clearable /></el-form-item></el-col>
    <el-col :span="12"><el-form-item label="资料类型"><enum-select v-model="model.profile.resourceType" field="resourceType" /></el-form-item></el-col>
    <el-col :span="12"><el-form-item label="资料状态"><enum-select v-model="model.profile.catalogStatus" field="catalogStatus" /></el-form-item></el-col>
    <el-col :span="12"><el-form-item label="取得方式"><enum-select v-model="model.profile.originKind" field="originKind" clearable /></el-form-item></el-col>
    <template v-if="kind === 'product'">
      <el-col :span="12"><el-form-item label="使用角色"><enum-select v-model="model.profile.audienceRole" field="audienceRole" clearable /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="题单溯源"><enum-select v-model="model.profile.provenanceStatus" field="provenanceStatus" :disabled="!!model.id" /></el-form-item></el-col>
    </template>
    <el-col :span="12"><el-form-item label="出版年份"><el-input-number v-model="model.profile.publishedYear" :min="1900" :max="2100" controls-position="right" clearable /></el-form-item></el-col>
    <el-col :span="12"><el-form-item label="编制年份"><el-input-number v-model="model.profile.preparedYear" :min="1900" :max="2100" controls-position="right" clearable /></el-form-item></el-col>
    <el-col :span="12"><el-form-item label="作者 / 编者"><el-input v-model="model.profile.authorName" maxlength="200" clearable /></el-form-item></el-col>
    <el-col :span="12"><el-form-item label="出版 / 机构"><el-input v-model="model.profile.publisherName" maxlength="200" clearable /></el-form-item></el-col>
    <el-col v-if="kind === 'source'" :span="12"><el-form-item label="取得时间"><el-date-picker v-model="model.profile.acquiredAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="实际取得时间，可留空" /></el-form-item></el-col>
  </el-row>
  <el-form-item label="内容与用途"><el-input v-model="model.profile.description" type="textarea" :rows="3" maxlength="10000" show-word-limit placeholder="描述内容、教学目标和适用范围；其他类型须明确说明" /></el-form-item>
  <el-divider content-position="left">声明的教材与考点范围</el-divider>
  <outline-scopes v-model="model.outlineScopes" :subject="model.profile.subject" :readonly="readonly" />
  <el-form-item label="声明考点" class="mt16">
    <relation-names v-if="readonly" type="kp" :ids="model.declaredKpIds" />
    <record-picker v-else v-model="model.declaredKpIds" type="kp" :filters="{ subject: model.profile.subject || undefined }" />
  </el-form-item>
  <el-form-item v-if="model.actualKpIds?.length" label="实际题单考点"><relation-names type="kp" :ids="model.actualKpIds" /></el-form-item>
  <el-divider content-position="left">区域（未知可留空）</el-divider>
  <el-row v-for="(region, index) in model.regions" :key="index" :gutter="12" class="region-row">
    <el-col :span="8"><enum-select v-model="region.role" field="regionRole" :include-values="kind === 'product' ? ['APPLICABLE'] : model.profile.resourceType === 'EXAM_PAPER' ? null : ['ORIGIN', 'APPLICABLE']" /></el-col>
    <el-col :span="13"><region-picker v-model="region.regionCode" :name="region.name" :full-name="region.fullName" :disabled="readonly" @change="region.name = $event?.name; region.fullName = $event?.fullName" /></el-col>
    <el-col :span="3"><el-button v-if="!readonly" link type="danger" @click="model.regions.splice(index, 1)">移除</el-button></el-col>
  </el-row>
  <el-button v-if="!readonly" plain size="small" @click="model.regions.push({ role: 'APPLICABLE', regionCode: undefined })">添加区域</el-button>
  <span v-else-if="!model.regions.length">未登记区域</span>
</template>
<script setup>
import EnumSelect from './EnumSelect.vue'
import OutlineScopes from './OutlineScopes.vue'
import RecordPicker from './RecordPicker.vue'
import RelationNames from './RelationNames.vue'
import RegionPicker from './RegionPicker.vue'
defineProps({ model: { type: Object, required: true }, kind: { type: String, required: true }, readonly: Boolean })
</script>
<style scoped>.mt16 { margin-top:16px; }.region-row { margin-bottom:10px;align-items:center; }</style>
