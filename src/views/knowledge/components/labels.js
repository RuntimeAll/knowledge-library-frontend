import { reactive } from 'vue'
import { getDicts } from '@/api/system/dict/data'
import { knowledgeRequest } from '@/api/knowledge'

// Protocol codes stay stable; textbook options come from outlines, other classifications from dictionaries.
export const dictionaryTypes = {
  "status": "kb_question_status",
  "sourceKind": "kb_source_kind",
  "extractionStatus": "kb_extraction_status",
  "authenticityStatus": "kb_verification_status",
  "verificationStatus": "kb_verification_status",
  "matchStatus": "kb_verification_status",
  "comparisonStatus": "kb_comparison_status",
  "creationKind": "kb_creation_kind",
  "selectionMode": "kb_selection_mode",
  "operation": "kb_derivation_operation",
  "subject": "kb_subject",
  "examType": "kb_exam_type",
  "questionType": "kb_question_type",
  "contentKind": "kb_content_kind",
  "layoutMode": "kb_layout_mode",
  "unitKind": "kb_unit_kind",
  "paginationMode": "kb_pagination_mode",
  "difficulty": "kb_difficulty",
  "catalogKind": "kb_outline_kind",
  "outlineStatus": "kb_outline_status",
  "importStatus": "kb_import_status",
  "importItemStatus": "kb_import_item_status",
  "assetStatus": "kb_asset_status",
  "attachmentRole": "kb_attachment_role",
  "resourceType": "kb_resource_type",
  "originKind": "kb_origin_kind",
  "catalogStatus": "kb_catalog_status",
  "audienceRole": "kb_audience_role",
  "provenanceStatus": "kb_provenance_status",
  "scopeKind": "kb_scope_kind",
  "regionRole": "kb_region_role",
  "examPurpose": "kb_exam_type",
  "entranceStage": "kb_entrance_stage",
  "organizerLevel": "kb_organizer_level",
  "paperNature": "kb_paper_nature",
  "collectionKind": "kb_collection_kind",
  "experienceType": "kb_experience_type",
  "experienceStatus": "kb_experience_status",
  "experienceVersionStatus": "kb_experience_version_status",
  "renderStatus": "kb_render_status"
}
export const dictionaries = reactive({})
export const optionLists = reactive({})
export const optionStates = reactive({})
const outlineFields = { grade: 'grades', term: 'terms', textbookVersion: 'textbookVersions' }
const pending = new Map()
export function loadDictionary(field, refresh = false) {
  if (outlineFields[field]) return loadOutlineOptions(refresh)
  const type = dictionaryTypes[field]
  if (refresh) pending.delete(type)
  if (!type || pending.has(type)) return pending.get(type)
  const fields = Object.keys(dictionaryTypes).filter(name => dictionaryTypes[name] === type)
  fields.forEach(name => { optionStates[name] = 'loading' })
  const request = getDicts(type).then(({ data }) => {
    const options = (data || []).map(item => ({ value: item.dictValue, label: item.dictLabel }))
    fields.forEach(name => setOptions(name, options))
  }).catch(() => { fields.forEach(name => { optionStates[name] = 'error' }) })
  pending.set(type, request)
  return request
}
function setOptions(field, options) {
  optionLists[field] = options
  dictionaries[field] = Object.fromEntries(options.map(item => [item.value, item.label]))
  optionStates[field] = 'ready'
}
export function loadOutlineOptions(refresh = false) {
  if (refresh) pending.delete('outline-options')
  if (pending.has('outline-options')) return pending.get('outline-options')
  Object.keys(outlineFields).forEach(field => { optionStates[field] = 'loading' })
  const request = knowledgeRequest('/outline/options').then(({ data }) => {
    Object.entries(outlineFields).forEach(([field, key]) => setOptions(field, data?.[key] || []))
  }).catch(() => { Object.keys(outlineFields).forEach(field => { optionStates[field] = 'error' }) })
  pending.set('outline-options', request)
  return request
}
export const label = (field, value) => {
  loadDictionary(field)
  if (value === undefined || value === null || value === '') return '未填写'
  if (dictionaries[field]?.[value]) return dictionaries[field][value]
  if (optionStates[field] !== 'ready') return optionStates[field] === 'error' ? '选项加载失败' : '加载中…'
  return field === 'textbookVersion' ? String(value) : '历史值（当前未启用）'
}
export const resourceNames = {
  question: '题目', source: '来源', product: '成品', kp: '考点', outline: '大纲', material: '专项'
}
