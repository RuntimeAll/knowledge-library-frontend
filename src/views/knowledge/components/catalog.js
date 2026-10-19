const profileFields = ['description', 'subject', 'resourceType', 'originKind', 'publishedYear', 'preparedYear', 'authorName', 'publisherName', 'acquiredAt', 'catalogStatus', 'audienceRole', 'provenanceStatus']
const examFields = ['examPurpose', 'examYear', 'grade', 'schoolName', 'scopeNote', 'entranceStage', 'organizerLevel', 'paperNature', 'examDate', 'academicYearStart', 'term', 'sessionLabel', 'paperCode', 'organizerName', 'evidenceAssetId', 'verificationNote']
export function pickFields(object, fields) {
  return Object.fromEntries(fields.filter(key => object?.[key] !== undefined).map(key => [key, object[key]]))
}
export function prepareCatalog(record, kind) {
  const result = structuredClone(record || {})
  result.profile = { resourceType: 'UNKNOWN', catalogStatus: 'DRAFT', ...result.profile }
  if (kind === 'product') result.profile = { audienceRole: null, provenanceStatus: 'UNKNOWN', ...result.profile }
  result.outlineScopes ||= []
  result.declaredKpIds ||= []
  result.regions ||= []
  if (kind === 'source') {
    result.examDetail ||= pickFields(result, ['examYear', 'grade', 'schoolName', 'scopeNote', 'verificationNote'])
    result.examDetail.examPurpose ||= result.examType || null
    result.profile.subject ||= result.subject || null
  }
  return result
}
export function catalogPayload(record, kind) {
  const payload = {
    profile: Object.fromEntries(profileFields.map(field => [field, record.profile?.[field] ?? null])),
    outlineScopes: (record.outlineScopes || []).map(scope => ({ outlineId: scope.outlineId, scopeKind: scope.scopeKind, nodeIds: scope.scopeKind === 'CHAPTERS' ? scope.nodeIds || [] : [], note: scope.note || '' })),
    declaredKpIds: record.declaredKpIds || [],
    regions: (record.regions || []).map(region => ({ role: region.role, regionCode: region.regionCode }))
  }
  if (kind === 'source' && record.profile?.resourceType === 'EXAM_PAPER') payload.examDetail = Object.fromEntries(examFields.map(field => [field, record.examDetail?.[field] ?? null]))
  return payload
}
export function sourceKind(resourceType) {
  return { EXAM_PAPER: 'EXAM', HANDOUT: 'HANDOUT', WORKBOOK: 'WORKBOOK' }[resourceType] || 'OTHER'
}
export function nodeTree(nodes) {
  const rows = (nodes || []).map(node => ({ ...node, id: String(node.id), children: [] }))
  const byId = new Map(rows.map(row => [row.id, row]))
  const roots = []
  rows.forEach(row => {
    const parent = byId.get(String(row.parentId))
    if (parent && parent !== row) parent.children.push(row)
    else roots.push(row)
  })
  return roots
}
