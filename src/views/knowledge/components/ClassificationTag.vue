<template>
  <dict-tag
    v-if="matched"
    :options="options"
    :value="value"
    :show-value="false"
  />
  <span v-else>{{ value ? '未知分类' : '未填写' }}</span>
</template>
<script setup>
const props = defineProps({ field: String, value: [String, Number] })
const type = {
  subject: 'kb_subject',
  questionType: 'kb_question_type',
  difficulty: 'kb_difficulty'
}[props.field]
const loaded = useDict(type)
const options = computed(() => loaded[type]?.value || [])
const matched = computed(() =>
  options.value.some((item) => String(item.value) === String(props.value))
)
</script>
