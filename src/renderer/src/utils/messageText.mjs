// Decode only the backend's legacy plain-text encoding. Rendering always uses
// Vue text nodes; decoded markup is never sent through innerHTML.
export function messageText(value) {
  return String(value ?? '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/&(lt|gt|quot|apos|amp);/g, (_, entity) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[entity])
}

export function highlightText(value, query) {
  const text = String(value ?? '')
  const needle = String(query ?? '')
  if (!needle) return [{ text, match: false }]
  const lower = text.toLocaleLowerCase(), term = needle.toLocaleLowerCase(), result = []
  let start = 0, index = lower.indexOf(term)
  while (index !== -1) {
    if (index > start) result.push({ text: text.slice(start, index), match: false })
    result.push({ text: text.slice(index, index + needle.length), match: true })
    start = index + needle.length
    index = lower.indexOf(term, start)
  }
  if (start < text.length || !result.length) result.push({ text: text.slice(start), match: false })
  return result
}
