export const dictionaries = {
  status: { DRAFT: '草稿', READY: '可用', RETIRED: '停用' },
  sourceKind: {
    EXAM: '考试卷',
    HANDOUT: '讲义',
    WORKBOOK: '练习册',
    AUTHORED: '自编资料',
    OTHER: '其他来源'
  },
  extractionStatus: {
    ORIGINAL_ONLY: '仅保存原件',
    PARTIAL: '部分抽题',
    EXTRACTED: '已完成抽题'
  },
  authenticityStatus: {
    UNVERIFIED: '待核实',
    VERIFIED: '已核实',
    REJECTED: '核实不通过'
  },
  verificationStatus: {
    UNVERIFIED: '待核实',
    VERIFIED: '已核实',
    REJECTED: '核实不通过'
  },
  matchStatus: {
    UNVERIFIED: '待核实',
    VERIFIED: '已核实',
    REJECTED: '核实不通过'
  },
  comparisonStatus: {
    ORIGINAL_ONLY: '仅原件',
    NOT_EXAM: '非考试来源',
    SOURCE_UNVERIFIED: '来源待核实',
    NO_KNOWLEDGE_POINTS: '暂无训练考点',
    NO_VERIFIED_QUESTIONS: '暂无有效核实题目',
    COMPARED_PARTIAL: '已比较部分题目',
    COMPARED_EXTRACTED: '已比较已抽题目'
  },
  creationKind: {
    UNKNOWN: '未分类',
    EXTRACTED: '抽取原题',
    AUTHORED: '自编题',
    DERIVED: '变式题'
  },
  selectionMode: { MIXED: '混合选题', EXAM_ONLY: '仅限参考范围内已核实真题' },
  operation: {
    NUMBER: '改数值',
    CONDITION: '改条件',
    QUESTION: '改设问',
    OTHER: '其他'
  }
}
export const label = (field, value) =>
  dictionaries[field]?.[value] || (value ? '未知分类' : '未填写')
export const resourceNames = {
  question: '题目',
  source: '来源',
  product: '成品',
  kp: '考点',
  outline: '大纲',
  material: '专项'
}
