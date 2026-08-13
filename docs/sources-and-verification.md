# Sources and verification

## How entries are found

Candidates come from four independent sweeps, kept separate so that a gap in one shows up as a gap only in that sweep:

1. **Topic sweeps** — arXiv and web search across thirteen angles (training-level self-improvement, self-play, agent memory and skills, self-modifying code, prompt and workflow optimization, automated AI research, open-endedness, multi-agent co-evolution, continual learning, surveys, limits, safety, benchmarks).
2. **Citation expansion** — forward and backward references from survey papers and from the Gödel-machine lineage.
3. **Venue sweeps** — recent ICML, ICLR, NeurIPS, ACL, COLM, TMLR, and Nature/Science listings.
4. **Community indexes** — awesome-lists and lab blogs, used only as leads; nothing is admitted on a secondary source alone.

## How entries are checked

Every candidate is resolved against its source page before it enters `data/papers.yaml`:

- The title on the landing page must match the record.
- `date` is taken from the v1 submission date on arXiv, or the publication date for journal and conference records — not the date of the latest revision.
- `venue` records the peer-reviewed venue when one exists; otherwise the preprint or software host.
- The summary is written after reading the paper's method and results, not from the abstract alone.
- `repo` is accepted only after loading the repository and confirming that its README or description corresponds to that specific paper. Several papers promise a URL that is still empty or returns 404; those are recorded as having no code rather than linked optimistically. Third-party reimplementations and companion paper-lists are not accepted as code releases.

## Star counts

Star badges are rendered from shields.io's live GitHub endpoint, so the number in the table is read from GitHub when the page loads rather than baked into a snapshot that silently ages. The trade-off is that a badge depends on shields.io being reachable, and a renamed or deleted repository shows as an error badge instead of a stale number — `verify_catalog.mjs --repos` catches that case by looking for a "repo not found" response.

## Automated checks

`node scripts/verify_catalog.mjs` validates:

- required fields, kebab-case ids and tags, `https` URLs, and `YYYY-MM` dates
- duplicate ids, URLs, and titles
- the 2025 date window outside `Foundations & Theory`
- category membership and per-category minimums
- summary length and style

`node scripts/verify_catalog.mjs --links` additionally re-resolves every URL. Hosts that answer `403` or `429` are recorded as throttled rather than broken, since those responses mean the host is refusing automated traffic, not that the page is gone.

`node scripts/verify_catalog.mjs --report` writes a dated report into `reports/verification/`.

## Known limitations

- Star counts and citation counts are deliberately not tracked; they age badly and say little about a paper's place in a research map.
- Preprint dates can shift when authors withdraw and resubmit; the recorded date is what the source page showed at verification time.
- Coverage of non-English venues is thin.
