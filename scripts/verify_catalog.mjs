// Validates data/papers.yaml and (optionally) re-resolves every link.
// Usage: node scripts/verify_catalog.mjs [--links] [--report]

import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT, loadPapers, loadCategories, groupByCategory, stats,
  REQUIRED, LEGACY_CATEGORY, CUTOFF,
} from './lib/catalog.mjs'

const doLinks = process.argv.includes('--links')
const writeReport = process.argv.includes('--report')

const papers = loadPapers()
const categories = loadCategories()
const errors = []
const warnings = []
const seenId = new Map()
const seenUrl = new Map()
const seenTitle = new Map()

const catIds = new Set(categories.map(c => c.id))
const normTitle = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '')

for (const p of papers) {
  const where = p.id || p.title || '(unnamed)'
  for (const f of REQUIRED) {
    if (p[f] === undefined || p[f] === '' || (Array.isArray(p[f]) && !p[f].length)) errors.push(`${where}: missing "${f}"`)
  }
  if (p.id && !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) errors.push(`${where}: id must be kebab-case`)
  if (seenId.has(p.id)) errors.push(`${where}: duplicate id (also ${seenId.get(p.id)})`)
  seenId.set(p.id, where)

  if (p.url && !/^https:\/\//.test(p.url)) errors.push(`${where}: url must be https`)
  if (seenUrl.has(p.url)) errors.push(`${where}: duplicate url (also ${seenUrl.get(p.url)})`)
  seenUrl.set(p.url, where)

  const nt = normTitle(p.title)
  if (seenTitle.has(nt)) errors.push(`${where}: duplicate title (also ${seenTitle.get(nt)})`)
  seenTitle.set(nt, where)

  if (p.date && !/^\d{4}(-\d{2})?$/.test(String(p.date))) errors.push(`${where}: date must be YYYY or YYYY-MM`)
  if (p.category && !catIds.has(p.category)) errors.push(`${where}: unknown category "${p.category}"`)
  if (p.category && p.category !== LEGACY_CATEGORY && String(p.date) < CUTOFF) {
    errors.push(`${where}: ${p.date} predates ${CUTOFF} outside ${LEGACY_CATEGORY}`)
  }
  if (Array.isArray(p.tags)) {
    if (p.tags.length < 2 || p.tags.length > 4) warnings.push(`${where}: ${p.tags.length} tags (expected 2-4)`)
    for (const t of p.tags) if (!/^[a-z0-9][a-z0-9-]*$/.test(t)) errors.push(`${where}: tag "${t}" must be kebab-case`)
  }
  const words = String(p.summary).trim().split(/\s+/).length
  if (words > 42) warnings.push(`${where}: summary is ${words} words (aim <= 40)`)
  if (/^(This paper|This work|We )/i.test(String(p.summary))) warnings.push(`${where}: summary should not open with "This paper/We"`)
  if (!p.summary_zh) warnings.push(`${where}: missing summary_zh (README_zh falls back to English)`)
}

const grouped = groupByCategory(papers, categories)
for (const c of categories) {
  const n = grouped.get(c.id).length
  if (n === 0) errors.push(`category ${c.id}: no entries`)
  else if (n < 4) warnings.push(`category ${c.id}: only ${n} entries`)
}

let linkFailures = []
if (doLinks) {
  const urls = [...new Set(papers.map(p => p.url))]
  const queue = [...urls]
  const worker = async () => {
    while (queue.length) {
      const u = queue.shift()
      let status = null
      for (const method of ['HEAD', 'GET']) {
        try {
          const c = new AbortController()
          const timer = setTimeout(() => c.abort(), 20000)
          const r = await fetch(u, { method, redirect: 'follow', signal: c.signal, headers: { 'User-Agent': 'awesome-rsi link check' } })
          clearTimeout(timer)
          if (r.status < 400) { status = null; break }
          status = r.status
        } catch (e) {
          status = e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 40)
        }
      }
      // 403/429 mean the host is refusing automation, not that the page is gone.
      if (status && ![403, 429].includes(status)) linkFailures.push([u, status])
      else if (status) warnings.push(`link check throttled (${status}): ${u}`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}

const s = stats(papers, categories)
console.log(`entries: ${s.total} | arXiv: ${s.arxiv} (${s.arxivPct}%) | landmarks: ${s.landmarks} | categories: ${s.categories}`)
console.log(`2025+ outside foundations: ${s.inWindow}/${s.modern} (${s.windowPct}%)`)
if (doLinks) console.log(`links checked: ${new Set(papers.map(p => p.url)).size}, failures: ${linkFailures.length}`)
for (const [u, st] of linkFailures) console.error(`  LINK ${st}: ${u}`)
for (const w of warnings) console.warn(`  warn: ${w}`)
for (const e of errors) console.error(`  ERROR: ${e}`)

if (writeReport) {
  const today = new Date(fs.statSync(path.join(ROOT, 'data', 'papers.yaml')).mtime).toISOString().slice(0, 10)
  const dir = path.join(ROOT, 'reports', 'verification')
  fs.mkdirSync(dir, { recursive: true })
  const lines = [
    `# Verification report — ${today}`, '',
    '## Catalog', '',
    `- Entries: ${s.total}`,
    `- arXiv-hosted: ${s.arxiv} (${s.arxivPct}%)`,
    `- Categories: ${s.categories}`,
    `- Landmark entries: ${s.landmarks}`,
    `- 2025-onward outside \`${LEGACY_CATEGORY}\`: ${s.inWindow}/${s.modern} (${s.windowPct}%)`, '',
    '## Per-category counts', '',
    '| Category | Entries |', '| --- | ---: |',
    ...categories.map(c => `| ${c.name} | ${grouped.get(c.id).length} |`), '',
    '## Checks', '',
    `- Schema and required fields: ${errors.length ? 'FAIL' : 'pass'}`,
    '- Duplicate id / url / title: ' + (errors.some(e => e.includes('duplicate')) ? 'FAIL' : 'pass'),
    `- Date window rule: ${errors.some(e => e.includes('predates')) ? 'FAIL' : 'pass'}`,
    `- Link resolution: ${doLinks ? (linkFailures.length ? `FAIL (${linkFailures.length})` : 'pass') : 'not run'}`,
    `- Warnings: ${warnings.length}`, '',
  ]
  fs.writeFileSync(path.join(dir, `${today}.md`), lines.join('\n'), 'utf8')
  console.log(`wrote reports/verification/${today}.md`)
}

process.exit(errors.length || linkFailures.length ? 1 : 0)
