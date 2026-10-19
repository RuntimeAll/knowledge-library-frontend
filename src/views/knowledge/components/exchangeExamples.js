const metadata = (questionType, layoutMode = 'PLAIN', unitKind = 'SINGLE', paginationMode = 'FLOW', layoutNote = '') => ({
  contentKind: 'EXERCISE', subject: 'MATH', questionType, layoutMode, unitKind, paginationMode, layoutNote, kpIds: []
})
const diagram = (title, shape) => `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100" role="img" aria-label="${title}"><title>${title}</title>${shape}</svg>`
const calculations = ['8 + 7', '9 + 6', '12 − 5', '6 × 3', '24 ÷ 4', '7 + 8', '20 − 9', '5 × 4', '36 ÷ 6', '13 − 8']
const calculationAnswers = [15, 15, 7, 18, 6, 15, 11, 20, 6, 5]

// Each example is a single content record. Group members keep keys inside that record.
export const exchangeExamples = [
  {
    key: 'application', label: '简洁应用题',
    metadata: { ...metadata('APPLICATION'), title: '格式示例：购买笔记本' },
    stem: '<p>每本笔记本 6 元，小明买了 4 本，付给售货员 30 元。应找回多少元？</p>',
    answer: '<p>6 元。</p>', analysis: '<p>30 − 6 × 4 = 6（元）。</p>'
  },
  {
    key: 'choice', label: '图片选项选择题',
    metadata: { ...metadata('CHOICE', 'STRUCTURED', 'SINGLE', 'KEEP_TOGETHER'), title: '格式示例：识别三角形' },
    stem: '<p>下列图形中，哪个是三角形？</p>',
    options: `<div data-option-key="A">${diagram('三角形', '<polygon points="75,10 135,85 15,85" fill="none" stroke="black" stroke-width="2"/>')}</div>
<div data-option-key="B">${diagram('长方形', '<rect x="20" y="20" width="110" height="65" fill="none" stroke="black" stroke-width="2"/>')}</div>
<div data-option-key="C">${diagram('圆形', '<circle cx="75" cy="50" r="38" fill="none" stroke="black" stroke-width="2"/>')}</div>
<div data-option-key="D">${diagram('五边形', '<polygon points="75,8 135,38 112,88 38,88 15,38" fill="none" stroke="black" stroke-width="2"/>')}</div>`,
    answer: '<p>A。</p>', analysis: '<p>三角形由三条线段首尾相接围成。</p>'
  },
  {
    key: 'group', label: '10 道口算作为一组',
    metadata: { ...metadata('CALCULATION', 'STRUCTURED', 'GROUP', 'KEEP_TOGETHER'), title: '格式示例：口算一组（10 项）' },
    stem: `<p>直接写出得数。</p><div data-kb-role="group" data-columns="2">${calculations.map((item, index) => `<div data-item-key="${index + 1}"><p>（${index + 1}）${item} = ______</p></div>`).join('')}</div>`,
    answer: `<div data-kb-role="group" data-columns="2">${calculationAnswers.map((answer, index) => `<div data-item-key="${index + 1}"><p>（${index + 1}）${answer}</p></div>`).join('')}</div>`, analysis: ''
  },
  {
    key: 'inquiry', label: '探究题与分页说明',
    metadata: { ...metadata('INQUIRY', 'STRUCTURED', 'SINGLE', 'ALLOW_SPLIT', '题干和实验数据尽量同页；允许第 2 问从下一页开始，保留完整答题空间。'), subject: 'SCIENCE', title: '格式示例：探究水温与溶解时间' },
    stem: '<p>探究水温是否影响等量食盐完全溶解所需的时间。各组使用相同容器和水量，并以相同方式搅拌。</p><table><thead><tr><th>水温</th><th>20 ℃</th><th>40 ℃</th><th>60 ℃</th></tr></thead><tbody><tr><th>溶解时间</th><td>120 秒</td><td>75 秒</td><td>40 秒</td></tr></tbody></table><p>（1）指出本实验的自变量和需要控制的两个条件。</p><p>（2）根据数据得出结论，并说明重复实验的作用。</p>',
    answer: '<p>（1）自变量为水温。控制水量、食盐质量等条件相同。（2）在本次实验条件下，水温越高，完全溶解所需时间越短。重复实验有助于降低偶然误差。</p>', analysis: '<p>结论限定在实验条件与测量范围内。</p>'
  }
]
