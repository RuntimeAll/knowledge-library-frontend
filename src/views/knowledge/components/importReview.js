export function calculationPreflight({ questionType, unitKind }, intent, itemCount, exceptionId) {
  if (questionType !== 'CALCULATION' || intent === 'update' || exceptionId) return ''
  if (unitKind !== 'GROUP' || itemCount < 3) return '新计算练习默认需一条 GROUP 包含至少 3 个完整小题。真实母题不足 3 题时，请先取得专项数量批准，并在 article 中保留 data-granularity-exception-id；当前原文件保留，不会创建题目编号。'
  return ''
}

export function derivePreflight(dataset, parent = null) {
  if (dataset.intent !== 'derive') return ''
  if (!/^\d+$/.test(dataset.expectedParentRowVersion || '') || !/^[a-f0-9]{64}$/.test(dataset.expectedParentStemHash || '') || !/^[a-f0-9]{64}$/.test(dataset.expectedParentContentHash || '')) return '变式缺少冻结的母题版本、题干或完整内容哈希，请重新导出当前母题或下载变式模板'
  if (parent && (String(parent.id) !== dataset.parentId || String(parent.rowVersion) !== dataset.expectedParentRowVersion || parent.stemHash !== dataset.expectedParentStemHash || parent.contentHash !== dataset.expectedParentContentHash)) return '变式引用的母题版本或完整内容哈希与当前查看版本不一致，请重新核对母题后制作'
  return ''
}
