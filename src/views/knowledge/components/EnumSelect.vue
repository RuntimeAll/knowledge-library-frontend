<template>
  <el-select
    :model-value="modelValue"
    :clearable="clearable"
    :value-on-clear="null"
    :placeholder="placeholder"
    :loading="optionStates[field] === 'loading'"
    :allow-create="allowCreate"
    filterable
    default-first-option
    style="width: 100%"
    @update:model-value="$emit('update:modelValue', $event)"
    @visible-change="refreshFailedOptions"
  >
    <el-option
      v-if="modelValue && !options.some((item) => item.value === modelValue)"
      :value="modelValue"
      :label="label(field, modelValue)"
      :disabled="!allowCreate"
    />
    <el-option
      v-for="item in options"
      :key="item.value"
      :value="item.value"
      :label="item.label"
    />
  </el-select>
</template>
<script setup>
import { loadDictionary, optionLists, optionStates, label } from './labels'
const props = defineProps({
  modelValue: String,
  field: String,
  clearable: { type: Boolean, default: false },
  includeValues: { type: Array, default: null },
  excludeValues: { type: Array, default: () => [] },
  allowCreate: { type: Boolean, default: false },
  placeholder: { type: String, default: '请选择' }
})
watch(() => props.field, field => loadDictionary(field), { immediate: true })
function refreshFailedOptions(visible) { if (visible && optionStates[props.field] === 'error') loadDictionary(props.field, true) }
const options = computed(() => (optionLists[props.field] || [])
  .filter(item => (!props.includeValues || props.includeValues.includes(item.value))
    && !props.excludeValues.includes(item.value)))
defineEmits(['update:modelValue'])
</script>
