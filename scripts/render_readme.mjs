// Regenerates README.md and README_zh.md from data/papers.yaml.
// Usage: node scripts/render_readme.mjs [--check]

import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT, loadPapers, loadCategories, groupByCategory, sortForDisplay,
  stats, anchor, displayDate, starBadge, CUTOFF,
} from './lib/catalog.mjs'

const check = process.argv.includes('--check')

const STRINGS = {
  en: {
    file: 'README.md',
    title: '# Awesome RSI',
    lede: 'A curated, evidence-first list of **recursive self-improvement (RSI)** research: AI systems that improve their own weights, prompts, memory, skills, tools, workflows, source code, or the improvement mechanism itself.',
    total: 'Total entries', arxivLine: 'arXiv entries', repoLine: 'Entries with released code',
    window: 'Entries from 2025 onward (excluding foundations)',
    cats: 'Categories', verified: 'Last verified', langLine: 'Language: [English](./README.md) | [中文](./README_zh.md)',
    featured: 'Featured RSI Readings', contents: 'Contents', overview: 'Category Overview',
    catalog: 'Catalog', catHead: 'Category', entHead: 'Entries',
    cols: '| Paper | Link | Stars | Date | Tags | Summary |',
    sep: '| --- | --- | --- | --- | --- | --- |',
    notes: 'Notes:',
    noteList: [
      '`Date` is the first public release (arXiv v1 month for preprints).',
      '`Stars` badges are live: they read the current count from GitHub on every page load, and clicking one opens the repository. A `-` means the work has no official code release.',
      'Entries are sorted by date (newest first) within each category.',
      'Only `Foundations & Theory` carries pre-2025 work; every other category starts at ' + CUTOFF + '.',
      '★ marks a landmark entry that defined or redirected a line of work.',
      'Links and repositories were resolved against their source pages during the last verification pass.',
    ],
    maint: 'Maintenance Notes',
    maintList: [
      'Source of truth: `data/papers.yaml` (taxonomy in `data/categories.yaml`)',
      'Regenerate README files: `node scripts/render_readme.mjs`',
      'Verify catalog and links: `node scripts/verify_catalog.mjs`',
      'Verification history: `reports/verification/`',
    ],
    citation: 'Citation',
  },
  zh: {
    file: 'README_zh.md',
    title: '# Awesome RSI',
    lede: '一份以证据为先的**递归自我改进（RSI）**研究清单：能够改进自身权重、提示、记忆、技能、工具、工作流、源代码，乃至改进机制本身的 AI 系统。',
    total: '条目总数', arxivLine: 'arXiv 条目', repoLine: '已开源代码的条目',
    window: '2025 年及以后的条目（不含基础理论）',
    cats: '分类数', verified: '最近校验', langLine: '语言: [English](./README.md) | [中文](./README_zh.md)',
    featured: '精选 RSI 读物', contents: '目录', overview: '分类概览',
    catalog: '编目', catHead: '分类', entHead: '条目数',
    cols: '| 论文 | 链接 | Stars | 日期 | 标签 | 摘要 |',
    sep: '| --- | --- | --- | --- | --- | --- |',
    notes: '说明：',
    noteList: [
      '`日期` 为首次公开发布时间（预印本取 arXiv v1 月份）。',
      '`Stars` 徽章为实时数据：每次加载页面时从 GitHub 读取当前星数，点击即可跳转到对应仓库。显示 `-` 表示该工作没有官方开源实现。',
      '每个分类内按日期倒序排列（最新在前）。',
      '仅 `基础与理论` 收录 2025 年之前的工作，其余分类均从 ' + CUTOFF + ' 起。',
      '★ 表示开创或改变了某条研究路线的里程碑工作。',
      '所有链接与仓库均在最近一次校验中回源核对。',
    ],
    maint: '维护说明',
    maintList: [
      '数据源：`data/papers.yaml`（分类定义见 `data/categories.yaml`）',
      '重新生成 README：`node scripts/render_readme.mjs`',
      '校验编目与链接：`node scripts/verify_catalog.mjs`',
      '校验历史：`reports/verification/`',
    ],
    citation: '引用',
  },
}

const FEATURED = [
  {
    url: 'https://arxiv.org/abs/2507.21046',
    title: 'A Survey of Self-Evolving Agents',
    en: 'The field map: what an agent evolves, when it evolves, how the update is produced, and how any of it is evaluated.',
    zh: '领域全景图：智能体演化什么、何时演化、如何产生更新，以及如何评估这些更新。',
  },
  {
    url: 'https://arxiv.org/abs/2505.22954',
    title: 'Darwin Gödel Machine',
    en: 'Swaps the Gödel machine\'s proof obligation for empirical benchmark validation, and keeps an open-ended archive instead of a single champion.',
    zh: '用经验性基准验证替代哥德尔机的证明义务，并以开放式档案库取代单一最优个体。',
  },
  {
    url: 'https://arxiv.org/abs/2510.21614',
    title: 'Huxley-Gödel Machine',
    en: 'Shows an agent\'s own benchmark score badly predicts how good its self-modified descendants will be, and ranks lineages by clade productivity instead.',
    zh: '指出智能体自身的基准分数难以预测其后代质量，转而按族系生产力对谱系排序。',
  },
  {
    url: 'https://arxiv.org/abs/2506.10943',
    title: 'Self-Adapting Language Models',
    en: 'Pushes the loop down to the weights: the model writes its own finetuning data and update directives, rewarded by post-update performance.',
    zh: '将自改进闭环下推到权重层：模型自行生成微调数据与更新指令，并以更新后的性能作为奖励。',
  },
  {
    url: 'https://arxiv.org/abs/2506.13131',
    title: 'AlphaEvolve',
    en: 'Evolutionary coding agent that improved a 56-year-old matrix-multiplication bound and recovered fleet-wide compute in production.',
    zh: '进化式编码智能体，改进了尘封 56 年的矩阵乘法上界，并在生产环境中回收了集群算力。',
  },
  {
    url: 'https://arxiv.org/abs/2505.03335',
    title: 'Absolute Zero',
    en: 'Proposer and solver in one model, trained on self-invented tasks with a code executor as the only ground truth.',
    zh: '同一模型兼任出题者与解题者，在自造任务上训练，仅以代码执行器作为唯一事实来源。',
  },
]

const CITATION = `\`\`\`bibtex
@misc{awesomersi2026,
  title={Awesome RSI: A Curated Catalog of Recursive Self-Improvement Research},
  author={Awesome RSI Contributors},
  howpublished={\\url{https://github.com/Token-Rhythm/awesome-rsi}},
  year={2026}
}
\`\`\``

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
}

function encodeUrl(u) {
  return String(u).replace(/\(/g, '%28').replace(/\)/g, '%29')
}

function render(lang, papers, categories, verifiedOn) {
  const T = STRINGS[lang]
  const s = stats(papers, categories)
  const grouped = groupByCategory(papers, categories)
  const nameOf = c => (lang === 'zh' && c.name_zh ? c.name_zh : c.name)
  const descOf = c => (lang === 'zh' && c.description_zh ? c.description_zh : c.description)

  const out = []
  out.push(T.title, '', T.lede, '')
  out.push(`- ${T.total}: **${s.total}**`)
  out.push(`- ${T.arxivLine}: **${s.arxiv} (${s.arxivPct}%)**`)
  out.push(`- ${T.repoLine}: **${s.withRepo} (${s.repoPct}%)**`)
  out.push(`- ${T.window}: **${s.inWindow}/${s.modern} (${s.windowPct}%)**`)
  out.push(`- ${T.cats}: **${s.categories}**`)
  out.push(`- ${T.verified}: **${verifiedOn}**`)
  out.push(`- ${T.langLine}`, '')

  out.push(`<a id="${anchor(STRINGS.en.featured)}"></a>`)
  out.push(`## ${T.featured}`, '')
  for (const f of FEATURED) out.push(`- [${f.title}](${encodeUrl(f.url)}): ${lang === 'zh' ? f.zh : f.en}`)
  out.push('')

  out.push(`## ${T.contents}`, '')
  out.push(`- [${T.overview}](#${anchor(STRINGS.en.overview)})`)
  out.push(`- [${T.featured}](#${anchor(STRINGS.en.featured)})`)
  out.push(`- [${T.catalog}](#${anchor(STRINGS.en.catalog)})`)
  for (const c of categories) out.push(`  - [${nameOf(c)}](#${anchor(c.name)})`)
  out.push(`- [${T.maint}](#${anchor(STRINGS.en.maint)})`)
  out.push(`- [${T.citation}](#${anchor(STRINGS.en.citation)})`, '')

  out.push(`<a id="${anchor(STRINGS.en.overview)}"></a>`)
  out.push(`## ${T.overview}`, '')
  out.push(`| ${T.catHead} | ${T.entHead} |`, '| --- | ---: |')
  for (const c of categories) out.push(`| ${nameOf(c)} | ${grouped.get(c.id).length} |`)
  out.push('')

  out.push(`<a id="${anchor(STRINGS.en.catalog)}"></a>`)
  out.push(`## ${T.catalog}`, '')
  out.push(T.notes)
  for (const n of T.noteList) out.push(`- ${n}`)
  out.push('')

  for (const c of categories) {
    const rows = sortForDisplay(grouped.get(c.id))
    out.push(`<a id="${anchor(c.name)}"></a>`)
    out.push(`### ${nameOf(c)}`, '')
    out.push(descOf(c), '')
    out.push(T.cols, T.sep)
    for (const p of rows) {
      const title = escapeCell(p.title) + (p.landmark ? ' ★' : '')
      const link = `[${p.link_label}](${encodeUrl(p.url)})`
      const stars = p.repo ? starBadge(p.repo) : '-'
      const summary = escapeCell(lang === 'zh' && p.summary_zh ? p.summary_zh : p.summary)
      const tags = (p.tags || []).join(', ')
      out.push(`| ${title} | ${link} | ${stars} | ${displayDate(p.date)} | ${tags} | ${summary} |`)
    }
    out.push('')
  }

  out.push(`<a id="${anchor(STRINGS.en.maint)}"></a>`)
  out.push(`## ${T.maint}`, '')
  for (const m of T.maintList) out.push(`- ${m}`)
  out.push('')
  out.push(`<a id="${anchor(STRINGS.en.citation)}"></a>`)
  out.push(`## ${T.citation}`, '')
  out.push(CITATION, '')

  return out.join('\n')
}

const papers = loadPapers()
const categories = loadCategories()
const verifiedOn = fs.readdirSync(path.join(ROOT, 'reports', 'verification'))
  .filter(f => f.endsWith('.md')).sort().pop()?.replace('.md', '') || 'unverified'

let changed = 0
for (const lang of ['en', 'zh']) {
  const file = path.join(ROOT, STRINGS[lang].file)
  const next = render(lang, papers, categories, verifiedOn)
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (prev === next) { console.log(`unchanged: ${STRINGS[lang].file}`); continue }
  changed++
  if (check) { console.error(`STALE: ${STRINGS[lang].file} differs from data/papers.yaml`); continue }
  fs.writeFileSync(file, next, 'utf8')
  console.log(`wrote: ${STRINGS[lang].file}`)
}
if (check && changed) process.exit(1)
console.log(`${papers.length} entries across ${categories.length} categories (verified ${verifiedOn})`)
