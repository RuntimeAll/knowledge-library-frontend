// Layout is selected by protocol attributes; imported CSS is never applied.
export const questionLayoutCss = `
[data-kb-role="options"]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px;margin:12px 0}
[data-option-key]{min-width:0;break-inside:avoid}
[data-option-key]::before{content:attr(data-option-key) ". ";font-weight:600}
[data-kb-role="group"]{display:grid;grid-template-columns:1fr;gap:14px 24px;margin:12px 0}
[data-kb-role="group"][data-columns="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
[data-kb-role="group"][data-columns="3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
[data-kb-role="group"][data-columns="4"]{grid-template-columns:repeat(4,minmax(0,1fr))}
[data-item-key]{min-width:0;break-inside:avoid}
[data-kb-role="vertical"] table{font-family:monospace;text-align:right}
[data-kb-role="vertical"] td{min-width:1.5em;text-align:right}
[data-kb-role="puzzle"] table{font-family:monospace;text-align:center}
[data-kb-role="puzzle"] td{min-width:2em;height:2em;text-align:center}
[data-pagination-mode="KEEP_TOGETHER"]{break-inside:avoid;page-break-inside:avoid}
[data-pagination-mode="ALLOW_SPLIT"]{break-inside:auto;page-break-inside:auto}
@media screen and (max-width:600px){[data-kb-role="group"][data-columns],[data-kb-role="options"]{grid-template-columns:1fr}}
`

export function cleanPreviewAttributes(container) {
  const allowedData = new Set(['data-latex', 'data-display', 'data-asset-id', 'data-kb-role', 'data-option-key', 'data-columns', 'data-item-key'])
  for (const node of container.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase()
      if (/^on/.test(name) || ['style', 'class', 'srcdoc', 'srcset', 'href', 'xlink:href'].includes(name)
        || /url\s*\(|expression\s*\(/i.test(attribute.value)
        || (name.startsWith('data-') && !allowedData.has(name))) node.removeAttribute(attribute.name)
    }
    if (node.hasAttribute('data-kb-role') && !['options', 'group', 'vertical', 'puzzle'].includes(node.dataset.kbRole)) node.removeAttribute('data-kb-role')
    if (node.hasAttribute('data-columns') && (node.dataset.kbRole !== 'group' || !['2', '3', '4'].includes(node.dataset.columns))) node.removeAttribute('data-columns')
    if (node.hasAttribute('data-option-key') && !/^[A-Z]$/.test(node.dataset.optionKey)) node.removeAttribute('data-option-key')
    if (node.hasAttribute('data-item-key') && !/^[A-Za-z0-9._-]{1,64}$/.test(node.dataset.itemKey)) node.removeAttribute('data-item-key')
    if (/^\s*(javascript|vbscript):/i.test(node.getAttribute('src') || '')) node.removeAttribute('src')
  }
}
