// Minimal YAML reader/writer for data/papers.yaml.
//
// The catalog uses a deliberately narrow subset of YAML so the toolchain stays
// dependency-free: a top-level sequence of mappings whose values are quoted
// strings, bare scalars, booleans, or inline `[a, b, c]` arrays. Anything
// outside that subset is a parse error rather than a silent misread.

const BARE_SAFE = /^[A-Za-z0-9][A-Za-z0-9 ._@/+-]*$/

function parseScalar(raw, where) {
  const s = raw.trim()
  if (s === '') return ''
  if (s === 'true') return true
  if (s === 'false') return false
  if (s.startsWith('[')) {
    if (!s.endsWith(']')) throw new Error(`${where}: unterminated inline array`)
    const inner = s.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map(x => parseScalar(x, where))
  }
  if (s.startsWith('"')) {
    if (!s.endsWith('"') || s.length < 2) throw new Error(`${where}: unterminated quoted string`)
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  if (s.includes(': ') || s.endsWith(':')) throw new Error(`${where}: unquoted value contains a colon`)
  return s
}

export function parsePapersYaml(text) {
  const out = []
  let cur = null
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const where = `line ${i + 1}`
    if (!line.trim() || line.trim().startsWith('#')) continue
    const item = line.match(/^- (\w[\w-]*):\s?(.*)$/)
    if (item) {
      if (cur) out.push(cur)
      cur = {}
      cur[item[1]] = parseScalar(item[2], where)
      continue
    }
    const field = line.match(/^ {2}(\w[\w-]*):\s?(.*)$/)
    if (field) {
      if (!cur) throw new Error(`${where}: field outside of a record`)
      if (field[1] in cur) throw new Error(`${where}: duplicate field "${field[1]}"`)
      cur[field[1]] = parseScalar(field[2], where)
      continue
    }
    throw new Error(`${where}: unsupported syntax -> ${JSON.stringify(line.slice(0, 60))}`)
  }
  if (cur) out.push(cur)
  return out
}

function emitScalar(v) {
  if (typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return '[' + v.map(x => emitScalar(x)).join(', ') + ']'
  const s = String(v)
  if (s !== '' && BARE_SAFE.test(s) && !/^(true|false)$/.test(s)) return s
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

export function stringifyPapersYaml(records, fieldOrder) {
  const chunks = []
  for (const r of records) {
    const keys = fieldOrder.filter(k => k in r).concat(Object.keys(r).filter(k => !fieldOrder.includes(k)))
    chunks.push(keys.map((k, idx) => (idx === 0 ? '- ' : '  ') + k + ': ' + emitScalar(r[k])).join('\n'))
  }
  return chunks.join('\n') + '\n'
}
