<template>
  <dict-tag
    v-if="matched"
    :options="options"
    :value="value"
    :show-value="false"
  />
  <span v-else>{{ label(field, value) }}</span>
</template>
<script setup>
import { loadDictionary, optionLists, label } from './labels'
const props = defineProps({ field: String, value: [String, Number] })
watch(() => props.field, loadDictionary, { immediate: true })
const options = computed(() => optionLists[props.field] || [])
const matched = computed(() =>
  options.value.some((item) => String(item.value) === String(props.value))
)
</script>
