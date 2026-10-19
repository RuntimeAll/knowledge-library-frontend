export function defaultTemplate() {
  return {
    schemaVersion: 'kb-layout-template/v1', status: 'DRAFT', changeNote: '', assets: [],
    fieldSchema: [
      { key: 'title', type: 'TEXT', label: '主标题', required: true, max: 200 },
      { key: 'subtitle', type: 'TEXT', label: '副标题', required: false, max: 200 },
      { key: 'instructions', type: 'TEXT', label: '说明', required: false, max: 2000 },
      { key: 'studentFields', type: 'STRING_LIST', label: '学生信息栏', required: false }
    ],
    defaultValues: { title: '专项练习', subtitle: '', instructions: '认真审题，完成后检查。', studentFields: ['姓名', '日期'] },
    definition: {
      html: '<header><h1 data-kb-field="title"></h1><p data-kb-field="subtitle"></p><p data-kb-field="studentFields"></p><p data-kb-field="instructions"></p></header>\n<div data-kb-slot="sections"></div>',
      css: 'h1 { text-align: center; font-size: 20pt; }\nheader { margin-bottom: 8mm; }',
      page: { size: 'A4', orientation: 'portrait', marginTopMm: 15, marginRightMm: 15, marginBottomMm: 15, marginLeftMm: 15, fontSizePt: 12, lineHeight: 1.5, columns: 1, questionGapMm: 5, answerSpaceMm: 16 },
      organization: { sectionPageBreak: false, dayPageBreak: false, numbering: 'CONTINUOUS' },
      content: { optionColumns: 1, showAnalysis: false, imageMaxWidthPercent: 100 }
    }
  }
}

// An isolated authoring preview, with no scripts, remote resources or navigation.
// The backend and renderer remain authoritative for publication and print validation.
export function templatePreview(definition = {}, values = {}) {
  const doc = new DOMParser().parseFromString(definition.html || '', 'text/html')
  doc.querySelectorAll('script,style,link,iframe,object,embed,form,input,button,base,meta,svg,math').forEach(node => node.remove())
  doc.querySelectorAll('*').forEach(node => {
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || ['src', 'srcset', 'href', 'action', 'formaction', 'style'].includes(attr.name)) node.removeAttribute(attr.name)
    }
  })
  doc.querySelectorAll('[data-kb-field]').forEach(node => {
    const value = values[node.getAttribute('data-kb-field')]
    node.textContent = Array.isArray(value) ? (node.getAttribute('data-kb-field') === 'studentFields' ? value.map(item => `${item}：________`).join('　') : value.join('、')) : String(value ?? '')
  })
  doc.querySelectorAll('[data-kb-slot="sections"]').forEach(node => {
    node.innerHTML = '<section><h2>栏目标题</h2><p>1. 这里按顺序装配已选题目的正文、选项与图片。</p><div class="preview-space"></div><p>2. 题组作为一个内容单位整体装配。</p></section>'
  })
  doc.querySelectorAll('img').forEach(node => { const note = doc.createElement('span'); note.textContent = '［模板固定图片］'; node.replaceWith(note) })
  const css = String(definition.css || '').replace(/<\/style/gi, '').replace(/@import[^;]*;?/gi, '').replace(/url\([^)]*\)/gi, 'none')
  const page = definition.page || {}
  const size = Math.max(8, Math.min(36, Number(page.fontSizePt) || 12))
  const lineHeight = Math.max(1, Math.min(3, Number(page.lineHeight) || 1.5))
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><style>body{background:white;margin:24px;font-family:sans-serif;font-size:${size}pt;line-height:${lineHeight}}.preview-space{height:60px;border-bottom:1px dashed #ddd}${css}</style></head><body>${doc.body.innerHTML}</body></html>`
}
