import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createServer as createNetServer } from 'node:net'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { detailContentHash, sourceLocator, sourceRecord, withQuestionDetail } from './review-fixtures.mjs'

// All business calls are fulfilled here; no credentials, database or OSS is used.
const probe = createNetServer()
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise(resolve => probe.close(resolve))
const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true, open: false }, logLevel: 'error' })
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await context.addCookies([{ name: 'Admin-Token', value: 'isolated-ui-fixture', url: base }])
const reportDir = path.resolve('../.runtime/work/prd-010/frontend-ui')
await mkdir(reportDir, { recursive: true })
const page = await context.newPage()
page.setDefaultTimeout(15000)
const pageErrors = [], requests = [], actions = []
page.on('pageerror', error => pageErrors.push(error.message))
const question = (id, status = 'DRAFT') => ({ id, rowVersion: '7', title: `审核样例 ${id}`, status, contentKind: 'EXERCISE', subject: 'MATH', questionType: 'CALCULATION', unitKind: 'GROUP', itemCount: 3, layoutMode: 'PLAIN', paginationMode: 'FLOW', creationKind: 'ORIGINAL', kpIds: [], assetIds: [], stemHtml: '<div data-kb-role="group"><div data-item-key="1">2 + 3 =</div><div data-item-key="2">3 + 4 =</div><div data-item-key="3">4 + 5 =</div></div>', answerHtml: '<div data-kb-role="group"><div data-item-key="1">5</div><div data-item-key="2">7</div><div data-item-key="3">9</div></div>', stemHash: 'a'.repeat(64), readinessReasons: [] })
const rows = ['90071992547409931', '90071992547409932', '90071992547409933'].map(id => question(id))
const changedQuestions = new Map()
const currentQuestion = id => changedQuestions.get(id) || question(id, id === '101' ? 'READY' : 'DRAFT')
let grantedPermissions = ['*:*:*']
let candidateUnavailable = false, sourceForbidden = false, sourceEmpty = false
const originalSource = '<!doctype html><html><body>测试原书第12页，第3题：计算12 + 7。</body></html>'
async function downloadedText(download) {
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}
let releaseSlowList
let batchCalls = 0, approveCalls = 0, candidateKind = 'FAKE', candidateCurrent = true, exceptionCalls = 0, exceptionReceipt = null, htmlCalls = 0
const dictionaries = {
  kb_selection_mode: { MIXED: '混合选题', EXAM_ONLY: '仅真题' },
  kb_import_status: { SUCCESS: '导入成功', PARTIAL: '部分成功', FAILED: '导入失败' },
  kb_import_item_status: { SUCCESS: '成功', FAILED: '失败' },
  kb_question_status: { DRAFT: '草稿', READY: '正常', DELETED: '已删除', RETIRED: '历史停用' },
  kb_content_kind: { EXERCISE: '练习', KNOWLEDGE: '知识内容' },
  kb_subject: { MATH: '数学', SCIENCE: '科学' },
  kb_question_type: { CALCULATION: '计算题' },
  kb_unit_kind: { GROUP: '组合内容', SINGLE: '单条内容' },
  kb_layout_mode: { PLAIN: '普通内容' },
  kb_pagination_mode: { FLOW: '自然分页' },
  kb_creation_kind: { ORIGINAL: '原题', DERIVED: '变式' }
}
const json = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
await context.route('**/dev-api/**', async route => {
  const request = route.request(), url = new URL(request.url()), pathname = url.pathname.replace('/dev-api', '')
  requests.push({ method: request.method(), path: pathname, params: Object.fromEntries(url.searchParams) })
  if (pathname === '/getInfo') return json(route, { code: 200, user: { userId: 'ui-reviewer', userName: 'ui-reviewer', nickName: '页面审核测试' }, roles: ['admin'], permissions: grantedPermissions })
  if (pathname === '/getRouters') return json(route, { code: 200, data: [{ path: '/knowledge', component: 'Layout', name: 'Knowledge', meta: { title: '知识库管理' }, children: [{ path: 'question', component: 'knowledge/question/index', name: 'KnowledgeQuestion', meta: { title: '题库' } }, { path: 'material', component: 'knowledge/material/index', name: 'KnowledgeMaterial', meta: { title: '专项' } }] }] })
  if (pathname.startsWith('/system/dict/data/type/')) return json(route, { code: 200, data: Object.entries(dictionaries[pathname.split('/').at(-1)] || {}).map(([dictValue, dictLabel]) => ({ dictValue, dictLabel })) })
  if (pathname === '/knowledge/outline/options') return json(route, { code: 200, data: { grades: [], terms: [], textbookVersions: [] } })
  if (pathname === '/knowledge/question/list') {
    if (url.searchParams.get('title') === 'slow') await new Promise(resolve => { releaseSlowList = resolve })
    if (['slow', 'fast'].includes(url.searchParams.get('title'))) return json(route, { code: 200, rows: [{ ...question('102', 'READY'), title: `响应 ${url.searchParams.get('title')}` }], total: 1 })
    const selected = url.searchParams.has('ids') ? rows.filter(row => url.searchParams.get('ids').split(',').includes(row.id)) : url.searchParams.get('purpose') === 'NORMAL' ? [question('101', 'READY')] : rows
    assert.ok(selected.every(row => !Object.hasOwn(row, 'contentHash')), '列表响应不能伪造详情才计算的完整哈希')
    return json(route, { code: 200, rows: selected, total: selected.length })
  }
  if (pathname === '/knowledge/question/approve-batch') {
    const body = request.postDataJSON(); actions.push({ path: pathname, body }); batchCalls++
    return json(route, { code: 200, data: { items: body.items.map((item, index) => ({ questionId: item.questionId, operationId: item.operationId, outcome: batchCalls === 1 ? ['SUCCESS', 'CONFLICT', 'PENDING'][index] : 'SUCCESS', message: batchCalls === 1 ? ['已批准', '版本已变化，请重新查看', '账册待对账'][index] : '原操作已确认', receipt: index === 0 || batchCalls > 1 ? { currentRowVersion: '8', rowVersion: '8', currentStatus: 'READY', reason: '核对完成' } : null, nextAction: index === 2 ? 'RETRY_SAME_OPERATION' : null })) } })
  }
  if (/\/knowledge\/question\/\d+\/readiness$/.test(pathname)) {
    const id = pathname.split('/').at(-2), current = currentQuestion(id)
    return json(route, { code: 200, data: { questionId: id, rowVersion: current.rowVersion, status: current.status, contentHash: detailContentHash, eligible: current.status === 'READY', canApprove: current.status === 'DRAFT', checks: [{ code: 'Q01', message: '内容与资源完整', passed: true }], impact: { materialCount: 2, productCount: 1, childCount: 1 }, approvalReceipt: null } })
  }
  if (/\/knowledge\/question\/\d+\/(approve|soft-delete|restore|return-to-draft)$/.test(pathname)) {
    const body = request.postDataJSON(), action = pathname.split('/').at(-1), id = pathname.split('/').at(-2)
    actions.push({ path: pathname, body })
    if (action === 'approve' && ++approveCalls === 1) return json(route, { code: 503, msg: '审批仍在核对，请按原操作编号查回', data: { retryable: true } })
    const current = currentQuestion(id)
    const next = { ...current, rowVersion: String(BigInt(current.rowVersion) + 1n), status: { approve: 'READY', 'soft-delete': 'DELETED', restore: 'DRAFT', 'return-to-draft': 'DRAFT' }[action] }
    changedQuestions.set(id, next)
    return json(route, { code: 200, data: { operationId: body.operationId, outcome: 'CONFIRMED', questionId: id, status: next.status, rowVersion: next.rowVersion, currentStatus: next.status, currentRowVersion: next.rowVersion, reasonCategory: body.reasonCategory, affectedQuestionIds: body.reasonCategory === 'CONTENT_ERROR' ? ['923'] : [] } })
  }
  if (/\/knowledge\/question\/\d+$/.test(pathname)) return json(route, { code: 200, data: withQuestionDetail(currentQuestion(pathname.split('/').at(-1))) })
  if (pathname === '/knowledge/question' && request.method() === 'PUT') { const body = request.postDataJSON(); actions.push({ path: pathname, body }); const current = { ...question(body.id), rowVersion: '8' }; changedQuestions.set(body.id, current); return json(route, { code: 200, data: withQuestionDetail(current) }) }
  if (pathname.startsWith('/knowledge/review/runs/') && candidateUnavailable) return json(route, { code: 503, msg: '候选服务暂不可用' })
  if (pathname === '/knowledge/source/501') return json(route, sourceForbidden ? { code: 403, msg: '来源读取被拒绝' } : { code: 200, data: { ...sourceRecord, assetIds: sourceEmpty ? [] : sourceRecord.assetIds } })
  if (pathname === '/knowledge/asset/881') return json(route, { code: 200, data: { assetId: '881', originalName: 'source-original.html', contentType: 'text/html', fileSize: Buffer.byteLength(originalSource) } })
  if (pathname === '/knowledge/asset/881/content') return route.fulfill({ contentType: 'text/html;charset=utf-8', body: originalSource })
  if (pathname.startsWith('/knowledge/review/runs/')) return json(route, { code: 200, data: { schemaVersion: 'pipeline-candidate/v1', runId: 'ui-run', groupKey: 'g1', role: 'ORIGINAL', candidateKey: 'ui-candidate', candidateRevision: 1, clientKey: 'ui:one', candidateHash: 'b'.repeat(64), current: candidateCurrent, workerKind: candidateKind, granularityExceptionReceipt: exceptionReceipt, sourceId: '501', sourceLocator, evidenceRefs: [], record: { metadata: { title: '真实母题数量例外候选', subject: 'MATH', questionType: 'CALCULATION', contentKind: 'EXERCISE', kpIds: [] }, stem: '计算 12 + 7。', answer: '19。' } } })
  if (pathname === '/knowledge/question/granularity-exceptions') {
    actions.push({ path: pathname, body: request.postDataJSON() })
    if (++exceptionCalls <= 2) return json(route, { code: 503, msg: '数量例外回执待确认' })
    exceptionReceipt = { exceptionId: 'exception-ui-1', operationId: request.postDataJSON().operationId, candidateHash: 'b'.repeat(64) }
    return json(route, { code: 200, data: exceptionReceipt })
  }
  if (pathname === '/knowledge/import/html') {
    actions.push({ path: pathname, body: request.postData() })
    if (++htmlCalls === 1) return json(route, { code: 503, msg: '上传结果未知，请保留原输入' })
    return json(route, { code: 200, data: { batchId: '701', status: 'SUCCESS', successCount: 1, failureCount: 0, items: [{ clientKey: 'ui-calculation', status: 'SUCCESS', questionId: '801', intent: 'create', message: '草稿已保存' }] } })
  }
  if (pathname === '/knowledge/import/schema') return json(route, { code: 200, data: { schemaVersion: 'kb-question-html/v1', instanceId: 'ui-instance' } })
  if (pathname === '/knowledge/material/list') return json(route, { code: 200, rows: [{ id: '601', rowVersion: '1', title: '失效引用专项', selectionMode: 'MIXED', questionCount: 1 }], total: 1 })
  if (pathname === '/knowledge/material' && request.method() === 'PUT') return json(route, { code: 200, data: { ...request.postDataJSON(), rowVersion: '2', questions: [rows[0]], unavailableQuestionIds: [rows[0].id], selectionValid: false } })
  if (pathname === '/knowledge/material/601/candidates') return json(route, { code: 200, rows: [question(url.searchParams.get('pageNum') === '2' ? '902' : '901', 'READY')], total: 23 })
  if (pathname === '/knowledge/material/601') return json(route, { code: 200, data: { id: '601', rowVersion: '1', title: '失效引用专项', selectionMode: 'MIXED', questionIds: [rows[0].id], questions: [rows[0]], unavailableQuestionIds: [rows[0].id], selectionValid: false, referenceSources: [] } })
  return json(route, { code: 200, data: [], rows: [], total: 0 })
})

try {
  await page.goto(`${base}/knowledge/question`)
  await page.getByRole('button', { name: '审核样例 101', exact: true }).waitFor()
  const initial = requests.filter(request => request.path === '/knowledge/question/list')
  assert.equal(initial.length, 1)
  assert.equal(initial[0].params.purpose, 'NORMAL')
  const titleInput = page.locator('.app-container > .el-form .el-form-item').filter({ hasText: '题目名称' }).getByRole('textbox')
  await titleInput.fill('slow')
  const slowStarted = page.waitForRequest(request => new URL(request.url()).searchParams.get('title') === 'slow')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await slowStarted
  await titleInput.fill('fast')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.getByRole('button', { name: '响应 fast', exact: true }).waitFor()
  const slowResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('title') === 'slow')
  releaseSlowList()
  await slowResponse
  await page.evaluate(() => new Promise(resolve => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))))
  assert.equal(await page.getByRole('button', { name: '响应 slow', exact: true }).count(), 0)
  await page.getByRole('button', { name: '响应 fast', exact: true }).waitFor()
  await titleInput.fill('')
  await page.locator('.el-radio-button').filter({ hasText: '草稿' }).click()
  await page.getByRole('button', { name: `审核样例 ${rows[0].id}`, exact: true }).waitFor()
  assert.equal(requests.filter(request => request.path === '/knowledge/question/list').at(-1).params.purpose, 'MAINTENANCE')
  await page.locator('.resource-toolbar').getByRole('button', { name: '逐题批准所选' }).waitFor()
  await page.locator('.app-container .el-table__header-wrapper').first().locator('.el-checkbox').click()
  await page.getByRole('button', { name: '逐题批准所选', exact: true }).click()
  const batch = page.getByRole('dialog', { name: '逐题批准正常', exact: true })
  assert.equal(await batch.getByRole('checkbox').isDisabled(), true)
  for (const row of rows) {
    await batch.getByRole('row').filter({ hasText: row.id }).getByRole('button', { name: '查看', exact: true }).click()
    const viewed = page.getByRole('dialog', { name: `内容详情 · 审核样例 ${row.id}`, exact: true })
    await viewed.frameLocator('iframe').first().getByText('2 + 3 =', { exact: true }).waitFor()
    await viewed.locator('.el-drawer__close-btn').click()
    await viewed.waitFor({ state: 'hidden' })
  }
  await batch.getByRole('textbox').fill('已逐题核对题干、答案和真实来源')
  await batch.locator('.el-checkbox').click()
  await batch.getByRole('button', { name: '逐题批准', exact: true }).click()
  await batch.getByText('版本已变化，请重新查看', { exact: true }).waitFor()
  await batch.getByRole('button', { name: '按原请求重试未确认项', exact: true }).click()
  await batch.getByText('已批准 2 项，冲突 1 项，未通过 0 项', { exact: true }).waitFor()
  const batchRequests = actions.filter(action => action.path.endsWith('approve-batch'))
  assert.equal(batchRequests[1].body.items.length, 1)
  assert.deepEqual(batchRequests[1].body.items[0], batchRequests[0].body.items[2])
  assert.equal(typeof batchRequests[0].body.items[0].questionId, 'string')
  assert.ok(batchRequests[0].body.items.every(item => item.expectedContentHash === detailContentHash))
  await batch.getByRole('button', { name: '关闭', exact: true }).click()

  await page.goto(`${base}/knowledge/question?questionId=${rows[0].id}`)
  const detail = page.getByRole('dialog', { name: `内容详情 · 审核样例 ${rows[0].id}`, exact: true })
  await detail.getByRole('button', { name: '编辑元数据', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '编辑内容元数据', exact: true })
  assert.equal(await editor.locator('.el-form-item').filter({ hasText: '当前状态' }).getByRole('combobox').count(), 0)
  await editor.getByRole('button', { name: '保存元数据', exact: true }).click()
  await editor.waitFor({ state: 'hidden' })
  assert.equal(Object.hasOwn(actions.find(action => action.path === '/knowledge/question').body, 'status'), false)

  await detail.getByRole('button', { name: '批准正常', exact: true }).click()
  const approveDialog = page.getByRole('dialog', { name: '批准正常', exact: true })
  await approveDialog.getByRole('textbox').fill('已核对完整内容、来源和考点')
  await approveDialog.locator('.el-checkbox').click()
  await approveDialog.getByRole('button', { name: '批准正常', exact: true }).click()
  await detail.getByText('审批仍在核对，请按原操作编号查回', { exact: true }).waitFor()
  await approveDialog.getByRole('button', { name: '按原请求重试查回', exact: true }).click()
  await approveDialog.waitFor({ state: 'hidden' })
  await detail.getByRole('button', { name: '退回草稿', exact: true }).waitFor()
  const approvals = actions.filter(action => action.path.endsWith('/approve'))
  assert.deepEqual(approvals[0].body, approvals[1].body)
  assert.equal(approvals[0].body.expectedRowVersion, '8')
  assert.equal(approvals[0].body.expectedContentHash, detailContentHash)
  await detail.getByRole('button', { name: '退回草稿', exact: true }).click()
  const returnDialog = page.getByRole('dialog', { name: '退回草稿', exact: true })
  await returnDialog.getByText('本次只停用当前题目，保留既有派生的状态。', { exact: true }).waitFor()
  await returnDialog.getByRole('textbox').fill('只停用母题以待补充资料')
  await returnDialog.getByRole('button', { name: '退回草稿', exact: true }).click()
  await returnDialog.waitFor({ state: 'hidden' })
  assert.equal(actions.find(action => action.path.endsWith('/return-to-draft')).body.reasonCategory, 'STOP_USE')
  await detail.getByRole('button', { name: '软删除', exact: true }).click()
  const deleteDialog = page.getByRole('dialog', { name: '软删除', exact: true })
  await deleteDialog.getByText(/现有引用：专项 2 个、派生 1 道、成品 1 个/).waitFor()
  await deleteDialog.locator('.el-select').click()
  await page.getByRole('option', { name: '题目内容有误，同时退回受影响派生', exact: true }).click()
  await deleteDialog.getByRole('textbox').fill('发现内容错误，需要同时复核派生')
  await deleteDialog.getByRole('button', { name: '软删除', exact: true }).click()
  await deleteDialog.waitFor({ state: 'hidden' })
  await detail.getByText('此次操作已将受影响派生题退回草稿：923', { exact: true }).waitFor()
  assert.equal(actions.find(action => action.path.endsWith('/soft-delete')).body.reasonCategory, 'CONTENT_ERROR')
  await detail.getByRole('button', { name: '恢复为草稿', exact: true }).click()
  const restoreDialog = page.getByRole('dialog', { name: '恢复为草稿', exact: true })
  await restoreDialog.getByRole('textbox').fill('恢复后重新审查')
  await restoreDialog.getByRole('button', { name: '恢复为草稿', exact: true }).click()
  await restoreDialog.waitFor({ state: 'hidden' })
  await detail.getByRole('button', { name: '批准正常', exact: true }).waitFor()
  assert.equal(changedQuestions.get(rows[0].id).status, 'DRAFT')
  await page.locator('.el-notification').last().waitFor({ state: 'hidden' })
  await page.locator('.el-message').last().waitFor({ state: 'hidden' })
  await page.screenshot({ path: path.join(reportDir, 'question-review.png'), fullPage: true, animations: 'disabled' })

  await page.goto(`${base}/knowledge/review/runs/ui-run/candidates/ui-candidate`)
  const sourceEvidence = page.locator('.candidate-source')
  await sourceEvidence.getByText('source-original.html', { exact: true }).waitFor()
  const sourceDownload = page.waitForEvent('download')
  await sourceEvidence.getByRole('button', { name: '下载', exact: true }).click()
  const sourceFile = await sourceDownload
  assert.equal(sourceFile.suggestedFilename(), 'source-original.html')
  assert.equal(await downloadedText(sourceFile), originalSource)
  assert.ok(requests.some(request => request.path === '/knowledge/source/501'))
  assert.ok(requests.some(request => request.path === '/knowledge/asset/881/content'))
  const exception = page.getByRole('button', { name: '批准当前候选的数量例外', exact: true })
  await exception.waitFor()
  assert.equal(await exception.isDisabled(), true)
  candidateKind = 'CODEX'
  await page.getByRole('button', { name: '刷新候选', exact: true }).click()
  await page.getByRole('textbox').fill('原书该题只有一道完整小题，已核对第12页第3题')
  await page.locator('.candidate-page .el-checkbox').click()
  await exception.click()
  await page.locator('.candidate-page').getByText('数量例外回执待确认', { exact: true }).waitFor()
  candidateCurrent = false
  await page.getByRole('button', { name: '刷新候选', exact: true }).click()
  await page.getByText('此候选已过期或当前修订未确认，请从运行待办打开最新审核链接。', { exact: true }).waitFor()
  const exceptionRetry = page.getByRole('button', { name: '按原请求重试查回', exact: true })
  assert.equal(await exceptionRetry.isDisabled(), false)
  await exceptionRetry.click()
  await page.locator('.candidate-page').getByText('数量例外回执待确认', { exact: true }).waitFor()
  candidateUnavailable = true
  await page.reload()
  await page.locator('.candidate-page').getByText('候选服务暂不可用', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '批准当前候选的数量例外', exact: true }).count(), 0)
  await page.getByRole('button', { name: '按原请求重试查回', exact: true }).click()
  await page.getByText(/数量例外已确认：exception-ui-1/).waitFor()
  candidateUnavailable = false
  const exceptionRequests = actions.filter(action => action.path.endsWith('granularity-exceptions'))
  assert.equal(exceptionRequests.length, 3)
  assert.deepEqual(exceptionRequests[0].body, exceptionRequests[1].body)
  assert.deepEqual(exceptionRequests[0].body, exceptionRequests[2].body)
  await page.getByRole('button', { name: '刷新候选', exact: true }).click()
  await page.getByText(/数量例外已确认：exception-ui-1/).waitFor()
  const exceptionRequest = actions.find(action => action.path.endsWith('granularity-exceptions')).body
  assert.equal(exceptionRequest.candidateHash, 'b'.repeat(64))
  assert.equal(Object.hasOwn(exceptionRequest, 'questionId'), false)
  await page.frameLocator('iframe').first().getByText('计算 12 + 7。', { exact: true }).waitFor()
  await page.frameLocator('iframe').nth(2).getByText('暂无内容', { exact: true }).waitFor()
  await page.locator('.el-notification').last().waitFor({ state: 'hidden' })
  await page.screenshot({ path: path.join(reportDir, 'candidate-content.png'), fullPage: true, animations: 'disabled' })
  await page.getByText(/数量例外已确认：exception-ui-1/).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(reportDir, 'candidate-receipt.png'), fullPage: true, animations: 'disabled' })

  sourceForbidden = true
  await sourceEvidence.getByRole('button', { name: '重新读取来源原件', exact: true }).click()
  await sourceEvidence.getByText('无法读取来源原件：来源读取被拒绝', { exact: true }).waitFor()
  assert.equal(await sourceEvidence.getByText('source-original.html', { exact: true }).count(), 0)
  sourceForbidden = false; sourceEmpty = true
  await sourceEvidence.getByRole('button', { name: '重新读取来源原件', exact: true }).click()
  await sourceEvidence.getByText('此来源尚未关联原件资产，当前只有来源身份与位置记录；请补充可核验原件后审查。', { exact: true }).waitFor()
  await page.goto(`${base}/knowledge/question`)
  const schemaResponse = page.waitForResponse(response => response.url().endsWith('/knowledge/import/schema'))
  await page.getByRole('button', { name: '上传变式', exact: true }).click()
  const deriveDialog = page.getByRole('dialog', { name: '上传 HTML 新建变式', exact: true })
  await schemaResponse
  const templateDownload = page.waitForEvent('download')
  await deriveDialog.getByRole('button', { name: '下载变式模板', exact: true }).click()
  const templateHtml = await downloadedText(await templateDownload)
  assert.ok(templateHtml.includes(`data-expected-parent-content-hash="${detailContentHash}"`))
  assert.ok(templateHtml.includes('data-expected-parent-row-version="7"'))
  assert.ok(templateHtml.includes(`data-expected-parent-stem-hash="${'a'.repeat(64)}"`))
  assert.ok(requests.some(request => request.path === '/knowledge/question/101'))
  await deriveDialog.locator('input[type="file"]').first().setInputFiles({ name: 'derive.html', mimeType: 'text/html', buffer: Buffer.from(templateHtml) })
  await deriveDialog.getByText('本地内容元数据（1 条）', { exact: true }).waitFor()
  assert.equal(await deriveDialog.getByRole('button', { name: '上传并导入', exact: true }).isEnabled(), true)
  await deriveDialog.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '导入 / 回流 HTML', exact: true }).click()
  const importer = page.getByRole('dialog', { name: '上传 HTML 新建题目 / 导出回流', exact: true })
  const htmlFile = count => ({ name: 'calculation.html', mimeType: 'text/html', buffer: Buffer.from(`<!doctype html><meta name="kb-schema" content="kb-question-html/v1"><article data-client-key="ui-calculation" data-intent="create"><script type="application/json" data-kb-metadata>{"title":"计算测试","questionType":"CALCULATION","subject":"MATH","unitKind":"GROUP"}</script><section data-part="stem"><div data-kb-role="group">${Array.from({length: count}, (_, index) => `<div data-item-key="${index + 1}">1 + ${index + 1} =</div>`).join('')}</div></section></article>`) })
  await importer.locator('input[type="file"]').first().setInputFiles(htmlFile(2))
  await importer.getByText(/新计算练习默认需一条 GROUP 包含至少 3 个完整小题/).waitFor()
  assert.equal(await importer.getByRole('button', { name: '上传并导入', exact: true }).isDisabled(), true)
  await importer.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '导入 / 回流 HTML', exact: true }).click()
  await importer.locator('input[type="file"]').first().setInputFiles(htmlFile(3))
  await importer.getByRole('button', { name: '上传并导入', exact: true }).click()
  await importer.getByText('上传结果未知，请保留原输入', { exact: true }).waitFor()
  const frozenKey = await importer.locator('.el-form-item').filter({ hasText: '提交标识' }).getByRole('textbox').inputValue()
  assert.equal(await importer.locator('.el-form-item').filter({ hasText: '提交标识' }).getByRole('textbox').isDisabled(), true)
  await importer.getByRole('button', { name: '按原请求重试上传', exact: true }).click()
  await importer.getByText(/批次编号：701/).waitFor()
  const htmlRequests = actions.filter(action => action.path.endsWith('/import/html'))
  assert.ok(htmlRequests[0].body.includes(frozenKey) && htmlRequests[1].body.includes(frozenKey))

  await page.goto(`${base}/knowledge/material`)
  await page.getByRole('button', { name: '失效引用专项', exact: true }).click()
  await page.getByText('当前不可用，保留原引用', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: `审核样例 ${rows[0].id}`, exact: true }).count(), 1)
  assert.deepEqual(pageErrors, [])
  await page.screenshot({ path: path.join(reportDir, 'material-invalid-reference.png'), fullPage: true, animations: 'disabled' })
  const materialDialog = page.getByRole('dialog', { name: '编辑专项 / 组织选题', exact: true })
  await materialDialog.getByRole('button', { name: '保存并打开候选题', exact: true }).click()
  const candidates = page.getByRole('dialog', { name: '专项候选题（服务端分页）', exact: true })
  await candidates.getByRole('button', { name: '审核样例 901', exact: true }).waitFor()
  await candidates.getByRole('button', { name: '下一页', exact: true }).click()
  await candidates.getByRole('button', { name: '审核样例 902', exact: true }).waitFor()
  await candidates.getByRole('textbox').first().fill('重新检索')
  await candidates.getByRole('button', { name: '搜索', exact: true }).click()
  await candidates.getByRole('button', { name: '审核样例 901', exact: true }).waitFor()
  const candidateRequests = requests.filter(request => request.path === '/knowledge/material/601/candidates')
  assert.deepEqual(candidateRequests.map(request => request.params.pageNum), ['1', '2', '1'])
  assert.ok(candidateRequests.every(request => request.params.purpose === 'NORMAL' && request.params.pageSize === '10'))
  assert.equal(await candidates.getByRole('button', { name: '审核样例 902', exact: true }).count(), 0)
  await candidates.getByText('共 23 条', { exact: true }).waitFor()
  grantedPermissions = ['knowledge:question:list', 'knowledge:question:query']
  await page.goto(`${base}/knowledge/question?questionId=${rows[0].id}`)
  await page.getByRole('dialog', { name: `内容详情 · 审核样例 ${rows[0].id}`, exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '批准正常', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '软删除', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '专项数量批准', exact: true }).count(), 0)
  assert.deepEqual(pageErrors, [])
  console.log('页面回归通过：正常首入单请求、A慢B快旧响应隔离、维护查询、逐题批审部分成功及同键恢复、深链接详情、编辑禁写状态、单题未知结果同键查回/仅停用退回/内容错误软删及影响题号/恢复草稿、FAKE禁批/候选GET503仍原键查回/例外回读、真实来源DTO原件下载/403/无原件、详情哈希变式模板下载与上传预检、计算数量阻断与冻结输入重传、专项失效引用保留/候选分页总数及检索回首屏、缺审批权限按钮隐藏；全部业务请求为夹具，未调用真实服务。')
} catch (error) {
  console.error({ url: page.url(), text: (await page.textContent('body')).slice(0, 5000), requests: requests.slice(-20), pageErrors })
  throw error
} finally {
  await context.close()
  await browser.close()
  await server.close()
}
