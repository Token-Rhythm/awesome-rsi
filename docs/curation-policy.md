# Curation policy

## Scope

An entry qualifies when the work is primarily about **an AI system improving itself or another AI system** — its weights, prompts, memory, skills, tools, workflows, source code, or the mechanism that produces those improvements.

Four levels are used to decide scope:

| Level | What persists | Included |
| --- | --- | :---: |
| Self-refinement | Nothing; the next task starts from the same state | no |
| Persistent learning | Weights, memory, or skill libraries that outlive the episode | yes |
| Scaffold evolution | The agent's own tools, workflows, and source code | yes |
| Meta-improvement | The procedure that proposes, selects, and applies improvements | yes |

Single-pass self-critique that resets every task is out of scope. The test is not whether a system modified itself once, but whether the modification persists and changes what the system can do next.

## Date window

- Every category except `Foundations & Theory` starts at **2025-01**. Older work is excluded regardless of influence, so the catalog reflects the current state of the field rather than its history.
- `Foundations & Theory` is the one place where pre-2025 work belongs: the formal results, self-referential architectures, and safety arguments that later systems are built on and still cite.
- `verify_catalog.mjs` enforces this rule; a pre-2025 entry outside `Foundations & Theory` fails the build.

## What gets rejected

- Generic agent, RAG, or reasoning papers with no persistent self-modification loop.
- Systems whose only "improvement" is more inference-time sampling.
- Preprints whose claims cannot be checked against a resolvable source page.
- Duplicate records of the same work (preprint plus journal version) — the canonical version is kept and the other title noted in the summary when it is well known.

## Landmark entries

`landmark: true` is reserved for work that defined or redirected a line of research. It is a judgement about influence, not benchmark numbers, and it is applied sparingly — roughly one entry in six.

## Summaries

Each summary is one sentence stating the mechanism and what it achieves. Written from the paper's own method and results sections rather than paraphrased from the abstract, and kept under 40 words. Marketing adjectives, "this paper", and unexplained acronyms are not accepted.
