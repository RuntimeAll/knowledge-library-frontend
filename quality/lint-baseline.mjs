export function parseHunks(diff) {
  return [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(match => ({
    oldStart: Number(match[1]), oldCount: Number(match[2] ?? 1),
    newStart: Number(match[3]), newCount: Number(match[4] ?? 1)
  }))
}

// Only untouched original lines can consume a legacy exception. Replacing a
// line with another violation, or copying it elsewhere, is a new violation.
export function mapUnchangedLine(line, hunks) {
  let offset = 0
  for (const hunk of hunks) {
    if (hunk.oldCount === 0) {
      if (line > hunk.oldStart) offset += hunk.newCount
    } else if (line >= hunk.oldStart && line < hunk.oldStart + hunk.oldCount) {
      return null
    } else if (line >= hunk.oldStart + hunk.oldCount) {
      offset += hunk.newCount - hunk.oldCount
    }
  }
  return line + offset
}

function signature(item) {
  return JSON.stringify([item.file, item.ruleId, item.message, item.line,
    item.column, item.endLine ?? item.line, item.endColumn ?? item.column])
}

export function compareWithBaseline(diagnostics, baseline, diffs) {
  const allowed = new Map()
  for (const item of baseline.entries) {
    const hunks = parseHunks(diffs.get(item.file) || '')
    const originalEnd = item.endLine ?? item.line
    const touched = hunks.some(hunk => hunk.oldCount === 0
      ? hunk.oldStart >= item.line && hunk.oldStart < originalEnd
      : hunk.oldStart <= originalEnd && hunk.oldStart + hunk.oldCount > item.line)
    if (touched) continue
    const line = mapUnchangedLine(item.line, hunks)
    const endLine = mapUnchangedLine(originalEnd, hunks)
    if (line === null || endLine === null || endLine - line !== originalEnd - item.line) continue
    const key = signature({ ...item, line, endLine })
    allowed.set(key, (allowed.get(key) || 0) + 1)
  }
  const violations = []
  let legacy = 0
  for (const item of diagnostics) {
    const key = signature(item)
    const count = allowed.get(key) || 0
    if (count > 0 && !item.fatal) {
      allowed.set(key, count - 1)
      legacy++
    } else violations.push(item)
  }
  return { violations, legacy, resolved: baseline.entries.length - legacy }
}
