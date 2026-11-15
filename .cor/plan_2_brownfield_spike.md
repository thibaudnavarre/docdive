# COR Plan — Brownfield spike (A1)

## Context

Decide assumption A1 of `docs/product-brief.md` (§8, "riskiest"): is raw brownfield Mermaid consistent enough that zero-config inference shows value on first run? Extend the disposable `spike/` indexer with Day-0 inference rules and a `dyd init` adoption report, run it over the docs of three public repos, and record the verdict for the next Think.

### Current state

- `spike/` is the week-1 throwaway (485 lines TS, 7 files; `.cor/plan.md` T01–T14 done). Toy acceptance passes; findings in `docs/spike-findings.md`.
- `spike/src/loader.ts:24` walks `.md` only — temporalio/documentation is 100% `.mdx`, posthog.com is 29/43 `.mdx`. `loader.ts:33` only matches unindented ```` ```mermaid ```` fences (6 indented ones in gitlab `doc/`). No handling of Mermaid's in-block `---` frontmatter (used by temporal/otel).
- `spike/src/model.ts:40-41` recognises only `flowchart|graph` and `sequenceDiagram`; other types (`stateDiagram-v2`, `erDiagram`, `classDiagram`, `gantt`) are silently dropped, not counted.
- `spike/src/flowchart.ts:27,30,60` and `spike/src/sequence.ts:34` `throw` on unknown syntax — one bad block aborts a whole run.
- Hierarchy today: explicit `parent:` + "nodes of a doc's flowcharts are children of the doc's `id`" (`model.ts:70-74`, `87-90`). Scenarios only from `kind: scenario` (`model.ts:65`). No fuzzy IDs, subgraphs, folder/heading inference, nearest-section prose, or `src` search.
- Corpus measured (sparse clones, 2026-11-14):

  | Repo | Path | Files w/ mermaid | Blocks | sequence | flowchart | subgraph | Code in repo |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | gitlabhq/gitlabhq `d7b9a61` | `doc/` | 165 | 335 | 106 | 202 | 178 | yes |
  | temporalio/documentation `882a9de` | `docs/` | 53 | 72 | 32 | 40 | 75 | no |
  | PostHog/posthog.com `bdf3ff2` | `contents/` | 43 | 63 | 13 | 43 | 32 | no |

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Goal | A1 decision gate, not report polish or rule discovery | Brief §10 step 2; riskiest assumption |
| Repos | gitlab `doc/`, temporal `docs/`, posthog `contents/` at pinned SHAs above | Highest volume + sequence diagrams; one repo with code for `src` |
| Corpus access | `fetch-corpus` script, sparse clones into git-ignored `spike/corpus/`; report records SHAs | 85/16/37 MB — too big to vendor; reproducible via SHAs |
| Code lifetime | Extend disposable `spike/`; still throwaway | Brief: ~100-line indexer; real layout comes after findings |
| Inference scope | All seven Day-0 rules (§6.1): exact ID, fuzzy ID, folder/heading, subgraph, scenario-from-any-sequence, nearest section, `src` | Learn which rules pay off on real data |
| Fuzzy IDs | Propose candidates with confidence; never auto-merge; metric counts exact matches only | Avoid false positives corrupting the A1 number |
| `src` inference | gitlab only (behind `--src <repoRoot>`); N/A for docs-only repos | Only one chosen repo ships code |
| Unsupported Mermaid | Skip block, count as `unsupported-type` / `parse-failed`; never crash | Brownfield must run zero-config to completion |
| "Cross-linked" | Element whose exact ID appears in ≥ 2 diagrams (any docs, same doc counts) | Shows the model connects something |
| Report | New `dyd init <folder> [--json]` printing Markdown to stdout; 7 metric groups (counts, elements, scenarios, fuzzy, conflicts, src, top-10 sample) | Prototypes the real §6.1 feature |
| A1 verdict | ≥ 50 % cross-linked on ≥ 1 repo **and** 3 eyeballed `dyd context` bundles per repo look sane | Number alone can be gamed by generic IDs |
| A1 failure | Spike still succeeds: record gap + most useful rules; decision deferred to next Think | Brief §8 fallback is "lower Day-0 promise to render + report" |
| Time box | 2–3 sessions; stub rules rather than overrun | Learning speed over completeness |

### Scope

**In scope:** corpus fetch script, loader hardening (`.mdx`, indented fences, in-block frontmatter), never-crash indexing with counts, seven inference rules, `dyd init` report, unit tests, toy regression, UAT on three corpora, `docs/brownfield-findings.md`.

**Out of scope:** auto-merging fuzzy IDs, ER/class/state extraction, `init --agent` normalisation prompt, `lint --fix`, `watch`, web component, SSG wrappers, conventions skill, real package layout, vendoring corpus files, iterating inference rules past the time box.

### Invariants

- Toy acceptance still passes unchanged: `dyd context OrderService` bundle (parent `system`; children `Controller`/`Validator`/`Repository`; 2 appearsIn; 1 scenario; `src/orders/`) and `highlight.html` step order.
- `index.json` keeps the §5.5 top-level shape (`version`, `elements`, `diagrams`, `scenarios`, `diagnostics`); additions only.
- D1 (zero non-Mermaid syntax beyond doc frontmatter) and D2 (no central model file) hold.
- `dyd index` / `dyd init` do no network I/O; cloning is a separate step.
- Parsing stays regex / line-based; no dependency on mermaid's own parser.

### Acceptance criteria

- `spike/scripts/fetch-corpus` reproduces the three corpora at the pinned SHAs into `spike/corpus/`.
- `dyd init spike/corpus/<repo>` completes without error on all three repos and prints the seven metric groups; `--json` emits the same data.
- Metric "% cross-linked" is computed as exact-ID-in-≥2-diagrams; fuzzy candidates are listed but not counted.
- A1 verdict recorded: pass if ≥ 50 % on ≥ 1 repo and 3 `dyd context` bundles per repo are judged sane by the owner; otherwise fail with gap recorded.
- `docs/brownfield-findings.md` exists with per-repo metrics, SHAs, verdict, most useful rules, inexpressibles, parsing surprises, open questions.
- Existing extractor tests and toy acceptance still pass. Solo validation by owner.

## Tasks

- [x] T01: Add `spike/scripts/fetch-corpus.sh`: sparse-clone gitlabhq/gitlabhq `doc/` @ `d7b9a6176ab4e279465ba3ee09922cde2b74de47`, temporalio/documentation `docs/` @ `882a9dececd9ddcf7d3e18d4934b191c7e82a161`, PostHog/posthog.com `contents/` @ `bdf3ff26372578def9794105bc79b61d194f92a1` into git-ignored `spike/corpus/<name>/`; print SHAs
- [x] T02: Loader: walk `.mdx` as well as `.md`, accept indented ```` ```mermaid ```` fences, strip Mermaid in-block `---` frontmatter (keep its `title`), and record each block's diagram-type header
- [x] T03: Never-crash indexing: wrap extractors in try/catch; classify every block as `supported` / `unsupported-type` / `parse-failed`; record counts and `parse-failed` diagnostics instead of aborting
- [x] T03b: Harden extractors for the top brownfield parse failures (quoted labels, `:::class` suffixes, `&` inside labels, space before `|label|`, `accTitle`/`accDescr`, parentheses in unquoted labels); keep loud failure for genuinely unknown syntax; re-measure parse-failed rate on the 3 corpora
- [x] T04: Inference — treat any `sequenceDiagram` as a scenario when the doc has no `kind: scenario` (id from doc id or path slug + block index), tagged `inferred: true`
- [x] T05: Inference — hierarchy from `subgraph` blocks in the flowchart extractor (subgraph id = element, members = children, nested subgraphs supported)
- [x] T06: Inference — default element `id` from filename/H1 when frontmatter has none, and `parent` from folder nesting / heading nesting when frontmatter has none; confidence < 1
- [x] T07: Inference — nearest-section prose: attach a heading-to-heading excerpt mentioning the element ID or label to elements without a doc, with confidence and source location
- [x] T08: Inference — fuzzy ID proposals: normalised (case/separator) match + edit distance → `fuzzy-id-candidate` diagnostics with confidence; never merge elements
- [x] T09: Inference — `src` symbol search behind `--src <repoRoot>` (gitlab only): path/dirname match and `class|module|def X` grep, confidence-scored
- [x] T10: `dyd init <folder> [--json] [--src <root>]`: adoption report with counts, elements (% cross-linked = exact ID in ≥ 2 diagrams, % with doc text, % with parent), scenarios (% steps resolved to an edge), fuzzy proposals, conflicts (duplicate IDs with different labels, ambiguous parents), src hits, top-10 most-connected elements
- [x] T11: Unit tests: `.mdx` / indented-fence / in-block-frontmatter loading, skip-and-count on bad blocks, subgraph extraction, fuzzy proposals, cross-linked metric [unit]
- [x] T12: Toy regression: extractor tests, `dyd context OrderService` bundle and `highlight.html` still pass unchanged [integration]
- [x] T13: Run `dyd init` on the three corpora; eyeball 3 `dyd context` bundles per repo; decide A1 (≥ 50 % on ≥ 1 repo AND bundles sane) [UAT]
- [x] T14: Write `docs/brownfield-findings.md`: per-repo metrics, corpus SHAs, A1 verdict, which inference rules helped most, inexpressibles, parsing surprises, open questions for the next Think
