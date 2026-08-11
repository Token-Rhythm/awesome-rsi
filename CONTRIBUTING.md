# Contributing

Additions, corrections, and removals are all welcome. Read [`docs/curation-policy.md`](docs/curation-policy.md) first — most rejected suggestions are out of scope rather than wrong.

## The README is generated

Do not edit `README.md` or `README_zh.md` by hand; both are rendered from `data/papers.yaml`. A pull request that edits them directly will fail verification.

```bash
node scripts/render_readme.mjs      # regenerate both README files
node scripts/verify_catalog.mjs     # schema, duplicates, date window, style
node scripts/verify_catalog.mjs --links   # additionally re-resolve every URL
```

Only Node.js 18+ is required; the toolchain has no dependencies.

## Adding an entry

Append a record to `data/papers.yaml`:

```yaml
- id: darwin-godel-machine
  title: "Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents"
  url: https://arxiv.org/abs/2505.22954
  link_label: arXiv
  date: 2025-05
  venue: arXiv
  authors: Zhang et al.
  category: self-modifying-agents
  tags: [self-modifying-code, open-ended-archive, coding-agents]
  landmark: true
  summary: "Rewrites its own codebase and keeps every variant in an open-ended archive rather than a single champion, lifting SWE-bench Verified from 20.0% to 50.0%."
  summary_zh: "改写自身代码库，并将所有变体保留在开放式档案库中而非只保留最优个体，将 SWE-bench Verified 从 20.0% 提升到 50.0%。"
```

Field rules:

- `id` — kebab-case, unique, stable once merged.
- `url` — `https`, pointing at the canonical landing page (`arxiv.org/abs/...`, a publisher page, or the project repository). Not a PDF.
- `date` — `YYYY-MM` of first public release; arXiv v1, not the newest revision.
- `category` — one of the ids in `data/categories.yaml`. Anything outside `foundations-theory` must be dated `2025-01` or later.
- `tags` — two to four kebab-case tags. Reuse existing tags where one fits.
- `landmark` — omit unless the work defined or redirected a line of research.
- `summary` — one sentence, under 40 words, stating the mechanism and what it achieves. No "this paper", no marketing adjectives.
- `summary_zh` — Chinese translation of the summary. If you cannot write one, say so in the pull request and it will be filled in.

Then run the two commands above and commit the regenerated README files alongside your data change.

## Corrections

Issues reporting a dead link, a wrong date, a miscategorized entry, or a summary that misstates a paper's contribution are as useful as new entries. Include the source page that shows the correct value.

## Removals

Argue from the curation policy: which level of the scope table the work fails, or which claim cannot be verified against its source.
