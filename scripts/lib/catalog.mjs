// Shared catalog loading, taxonomy, and derived statistics.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePapersYaml } from './yaml.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DATA_FILE = path.join(ROOT, 'data', 'papers.yaml')
export const TAXONOMY_FILE = path.join(ROOT, 'data', 'categories.yaml')

export const FIELD_ORDER = [
  'id', 'title', 'url', 'link_label', 'date', 'venue', 'authors',
  'category', 'tags', 'landmark', 'summary', 'summary_zh',
]

export const REQUIRED = ['id', 'title', 'url', 'link_label', 'date', 'category', 'tags', 'summary']

// Only this category may hold pre-2025 work; everything else is 2025 onward.
export const LEGACY_CATEGORY = 'foundations-theory'
export const CUTOFF = '2025-01'

export function loadCategories() {
  return parsePapersYaml(fs.readFileSync(TAXONOMY_FILE, 'utf8'))
}

export function loadPapers() {
  return parsePapersYaml(fs.readFileSync(DATA_FILE, 'utf8'))
}

export function anchor(name) {
  return name.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ +/g, '-')
}

export function displayDate(d) {
  const m = String(d).match(/^(\d{4})(?:-(\d{2}))?$/)
  if (!m) return String(d)
  return m[2] ? `${m[1]}.${m[2]}` : m[1]
}

// Newest first; ties broken by title so the render is deterministic.
export function sortForDisplay(papers) {
  return [...papers].sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title))
}

export function groupByCategory(papers, categories) {
  const map = new Map(categories.map(c => [c.id, []]))
  for (const p of papers) {
    if (!map.has(p.category)) throw new Error(`unknown category "${p.category}" on ${p.id}`)
    map.get(p.category).push(p)
  }
  return map
}

export function stats(papers, categories) {
  const arxiv = papers.filter(p => /arxiv\.org/i.test(p.url)).length
  const modern = papers.filter(p => p.category !== LEGACY_CATEGORY)
  const inWindow = modern.filter(p => String(p.date) >= CUTOFF).length
  const pct = n => (papers.length ? (100 * n / papers.length).toFixed(1) : '0.0')
  return {
    total: papers.length,
    arxiv,
    arxivPct: pct(arxiv),
    modern: modern.length,
    inWindow,
    windowPct: modern.length ? (100 * inWindow / modern.length).toFixed(1) : '100.0',
    categories: categories.length,
    landmarks: papers.filter(p => p.landmark).length,
  }
}
