// Validates data/papers.yaml and (optionally) re-resolves every link and repository.
// Usage: node scripts/verify_catalog.mjs [--links] [--repos] [--report]

import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT, loadPapers, loadCategories, groupByCategory, stats,
  REQUIRED, LEGACY_CATEGORY, CUTOFF,
} from './lib/catalog.mjs'

const doLinks = process.argv.includes('--links')
const doRepos = process.argv.includes('--repos')
const writeReport = process.argv.includes('--report')

const papers = loadPapers()
const categories = loadCategories()
const errors = []
const warnings = []
const seenId = new Map()
const seenUrl = new Map()
const seenTitle = new Map()
const seenRepo = new Map()

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
  if (p.repo !== undefined) {
    if (!/^[A-Za-z0-9][\w.-]*\/[\w.-]+$/.test(String(p.repo))) errors.push(`${where}: repo must be "owner/name"`)
    if (seenRepo.has(p.repo)) warnings.push(`${where}: repo shared with ${seenRepo.get(p.repo)}`)
    else seenRepo.set(p.repo, where)
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

// The star badges are only useful if the repositories behind them still exist.
// shields.io answers 200 even for a missing repo, so the SVG text is the signal.
let repoFailures = []
if (doRepos) {
  const repos = [...new Set(papers.filter(p => p.repo).map(p => p.repo))]
  const queue = [...repos]
  const worker = async () => {
    while (queue.length) {
      const r = queue.shift()
      try {
        const c = new AbortController()
        const timer = setTimeout(() => c.abort(), 20000)
        const res = await fetch(`https://img.shields.io/github/stars/${r}?style=flat-square`, { signal: c.signal, headers: { 'User-Agent': 'awesome-rsi repo check' } })
        clearTimeout(timer)
        const svg = await res.text()
        if (/repo not found|invalid|inaccessible/i.test(svg)) repoFailures.push([r, 'repo not found'])
      } catch (e) {
        warnings.push(`repo check failed for ${r}: ${e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 30)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}

const s = stats(papers, categories)
console.log(`entries: ${s.total} | arXiv: ${s.arxiv} (${s.arxivPct}%) | with code: ${s.withRepo} (${s.repoPct}%) | landmarks: ${s.landmarks} | categories: ${s.categories}`)
console.log(`2025+ outside foundations: ${s.inWindow}/${s.modern} (${s.windowPct}%)`)
if (doLinks) console.log(`links checked: ${new Set(papers.map(p => p.url)).size}, failures: ${linkFailures.length}`)
if (doRepos) console.log(`repos checked: ${new Set(papers.filter(p => p.repo).map(p => p.repo)).size}, failures: ${repoFailures.length}`)
for (const [u, st] of linkFailures) console.error(`  LINK ${st}: ${u}`)
for (const [r, st] of repoFailures) console.error(`  REPO ${st}: ${r}`)
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
    `- With an official code repository: ${s.withRepo} (${s.repoPct}%)`,
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
    `- Repository resolution: ${doRepos ? (repoFailures.length ? `FAIL (${repoFailures.length})` : 'pass') : 'not run'}`,
    `- Warnings: ${warnings.length}`, '',
  ]
  fs.writeFileSync(path.join(dir, `${today}.md`), lines.join('\n'), 'utf8')
  console.log(`wrote reports/verification/${today}.md`)
}

process.exit(errors.length || linkFailures.length || repoFailures.length ? 1 : 0)
