<template>
  <el-select
    :model-value="modelValue"
    :clearable="clearable"
    :placeholder="placeholder"
    filterable
    default-first-option
    style="width: 100%"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-option
      v-if="modelValue && !options.some((item) => item.value === modelValue)"
      :value="modelValue"
      label="未知分类（请重新选择）"
      disabled
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
import { dictionaries } from './labels'
const props = defineProps({
  modelValue: String,
  field: String,
  clearable: { type: Boolean, default: false },
  placeholder: { type: String, default: '请选择' }
})
const dictType = {
  subject: 'kb_subject',
  examType: 'kb_exam_type',
  operation: 'kb_derivation_operation',
  questionType: 'kb_question_type',
  difficulty: 'kb_difficulty'
}[props.field]
const loaded = dictType ? useDict(dictType) : {}
const options = computed(() =>
  dictType
    ? loaded[dictType]?.value || []
    : Object.entries(dictionaries[props.field] || {}).map(([value, label]) => ({
        value,
        label
      }))
)
defineEmits(['update:modelValue'])
</script>
