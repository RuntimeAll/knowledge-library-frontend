// These DTO-shaped fixtures are checked against the adjacent backend source contract.
export const sourceLocator = { physicalPage: '12', printedPage: '10', questionNo: '3', note: '原书题号3，完整母题边界' }
export const sourceRecord = { id: '501', rowVersion: '3', title: '来源原件测试', assetIds: ['881'] }
export const detailContentHash = 'c'.repeat(64)
export const withQuestionDetail = row => ({ ...row, contentHash: detailContentHash })
