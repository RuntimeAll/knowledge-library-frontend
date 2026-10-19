<template>
  <div class="template-fields">
    <el-form-item v-for="field in fields" :key="field.key" :label="field.label || field.key" :required="field.required">
      <el-switch v-if="field.type === 'BOOLEAN'" :model-value="Boolean(modelValue[field.key])" @update:model-value="set(field.key, $event)" />
      <el-input-number v-else-if="field.type === 'NUMBER'" :model-value="modelValue[field.key]" :min="field.min ?? -Infinity" :max="field.max ?? Infinity" @update:model-value="set(field.key, $event)" />
      <el-select v-else-if="field.options?.length || field.type === 'STRING_LIST'" :model-value="modelValue[field.key]" :multiple="field.type === 'STRING_LIST'" :allow-create="!field.options?.length" filterable default-first-option style="width:100%" @update:model-value="set(field.key, $event)">
        <el-option v-for="option in field.options || []" :key="option" :label="option" :value="option" />
      </el-select>
      <el-input v-else :model-value="modelValue[field.key]" :type="field.key === 'instructions' ? 'textarea' : 'text'" :maxlength="field.max" show-word-limit @update:model-value="set(field.key, $event)" />
    </el-form-item>
    <el-empty v-if="!fields.length" description="当前模板没有需要填写的动态字段" :image-size="60" />
  </div>
</template>
<script setup>
const props = defineProps({ fields: { type: Array, default: () => [] }, modelValue: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update:modelValue'])
function set(key, value) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
</script>
