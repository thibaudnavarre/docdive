# COR Plan — A1 redo: pre-registered gate + identity model

## Context

The brownfield spike (`.cor/plan_2_brownfield_spike.md`, `docs/brownfield-findings.md`) failed the A1 gate (best repo 26.2 % vs ≥ 50 % cross-linked) and deferred the decision. This plan **pre-registers** a replacement gate and a revised identity/parent/scenario model, applies them as a ~1-day change to the disposable `spike/` indexer, re-runs on the same pinned corpus, and records a final A1 verdict. If the new gate fails too, the §8 fallback is locked and A1 spiking stops.

### Current state

- First-wins parenting: `el.parent ??=` at `spike/src/model.ts:113` (folder index), `:168` (subgraph), `:176` (doc-children). It turned `Workflow`'s parent into a doc slug and gave `Gitaly` children `C`/`D`/`E`.
- Doc-children rule (`model.ts:174-178`): every flowchart node of a doc becomes a child of the doc's id, including for docs whose id was *inferred* from the filename. The toy's `OrderService` children depend on this rule, but that doc has an explicit `id:`.
- Frontmatter `id` is always treated as an explicit element ID with confidence 1 (`spike/src/infer.ts:38-42`); temporal's Docusaurus `id`s are not element IDs by intent.
- Placeholder IDs (`A`…`J`) are the most "connected" elements in every repo; the report only excludes them in one variant row (`spike/src/report.ts` §2, §7).
- Inferred scenarios are checked against every flowchart containing both endpoints → 1010 `edge-not-in-diagram` diagnostics on gitlab vs 115 truly conflicting steps; 0–12.8 % of steps resolve to an edge because participants and node IDs are two vocabularies.
- Corpus (pinned, git-ignored `spike/corpus/`, reproduce with `spike/scripts/fetch-corpus.sh`): gitlabhq `doc/` @ `d7b9a6176ab4e279465ba3ee09922cde2b74de47`, temporalio/documentation `docs/` @ `882a9dececd9ddcf7d3e18d4934b191c7e82a161`, PostHog/posthog.com `contents/` @ `bdf3ff26372578def9794105bc79b61d194f92a1`.
- Temporal has only 7 candidates with ≥ 3 diagrams and ≥ 3-char IDs (`Workflow`, `Client`, `Temporal`, `Activity`, `Start`, `Records`, `Workers`), two of which are not concepts.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Goal | Decide A1 for good: new gate + identity model + Day-0 promise, then re-run | First gate measured vocabulary reuse, not model quality (Q1) |
| Nature | Decision + model design, small spike change to validate | Learn, don't productionise |
| Open questions | Q1–Q7 all in scope; Q6/Q7 decide-and-record only | Q6/Q7 low risk; Q1–Q5 need design |
| Gate honesty | New gate written down **before** re-running, measured on same SHAs, old 26.2 % number kept alongside | Changing the gate after seeing data is only credible if pre-registered |
| New gate | Top 5 elements per repo by diagram count (≥ 3-char, non-placeholder, global IDs). Each `dyd context` bundle scored on 4 binary fields: `appearsIn` only lists diagrams where the ID means this concept; `parent` absent or a real container; `children` contain no placeholders/doc slugs; `scenarios` involve the element. Bundle passes at ≥ 3/4; repo passes on a majority of its 5; gate passes on ≥ 1 repo | Judges what an agent would actually receive; fits temporal's small hub list |
| Non-concept hubs | `Start`, `Records`, `events`… count **against** the gate — no stop-list, no owner skip | The tool must not present them as hubs; a failing bundle is the honest result |
| Syntax | Frontmatter keys only (e.g. `ids:` scope); Mermaid bodies untouched and render on GitHub | Deletability (brief §7.3) |
| Time box | ~1 day: rules + metrics in the existing spike, re-run, update findings | Decision speed over completeness |
| If gate fails | Lock fallback: Day-0 = render + report + scenarios; `init --agent` normalisation becomes the brownfield path; stop spiking A1 | Brief §8 A1 "if wrong" row |
| Design effort | Q2 identity scoping (highest risk: per-doc default may kill the cross-doc model), then Q1, Q3, Q5, Q4 | Think round 3 |
| Rubric scoring | Report prints the 4 fields per hub (machine-assisted); pass/fail is judged by the owner and recorded in the findings doc | Spike stays disposable; judgement stays human |

### Scope

**In scope:** pre-registration doc, identity classes (global/local/placeholder) with frontmatter opt-in/opt-out, parent-candidate resolution without first-wins, dropping doc-children for undeclared docs, SSG frontmatter-`id` handling, participant→element anchoring metric, report §8 hub bundles + identity counts, unit tests, toy regression, re-run + scoring on 3 corpora, `docs/brownfield-findings-2.md`, product brief updates (§5.1, §5.3, §8 A1, §9), Q1–Q7 decision record.

**Out of scope:** ER/state/gitGraph/block-beta extraction (Q6: decide only), auto-merging fuzzy IDs, `init --agent` prompt implementation, `lint --fix`, web component, SSG wrappers, conventions skill, real package layout, a Mermaid parser dependency, any further A1 iteration after this re-run.

### Invariants

- Pinned corpus SHAs and the three repos are unchanged.
- `spike/` stays disposable: no new runtime deps, no productionising.
- Toy acceptance stays green: `dyd context OrderService` → parent `system`; children `Controller`/`Validator`/`Repository`; 2 `appearsIn`; scenario `checkout-happy-path`; `src/orders/`; `highlight.html` step order.
- Deletability: no change to Mermaid bodies; new frontmatter keys are optional YAML.
- `index.json` and brief §5 concepts **may** change (additions preferred; breaking allowed if recorded).

### Acceptance criteria

- `docs/brownfield-findings-2.md` contains a dated "Pre-registration" section (gate, rubric, rule changes, Q1–Q7 decisions) committed before any indexer change.
- `dyd init` on all 3 corpora completes, prints identity-class counts, the unchanged old cross-linked metric, and a §8 hub-bundle table (top 5, 4 rubric fields each).
- 15 bundles scored by the owner against the rubric; per-repo majority and gate verdict recorded next to the old 26.2 / 11.7 / 22.5 % numbers.
- No placeholder (≤ 2-char) or local ID appears as a hub, parent or child in any shown bundle.
- Inferred scenarios no longer emit `edge-not-in-diagram` diagnostics; participant-resolution % is reported per repo.
- Toy acceptance, extractor tests and new unit tests pass (`npx vitest run` in `spike/`).
- Product brief §5.1/§5.3/§8 A1 row/§9 brownfield criterion updated to the new model and gate; if the gate failed, §4/§6.1 state the locked fallback.

## Tasks

- [x] T01: Write the "Pre-registration" section of `docs/brownfield-findings-2.md` **before any code**: the new gate (top-5 global hubs per repo by diagram count, ≥ 3-char IDs; 4 binary fields `appearsIn`/`parent`/`children`/`scenarios`; bundle passes ≥ 3/4; repo passes on majority; gate passes on ≥ 1 repo; non-concept hubs count against), the identity/parent/scenario rules of T02–T05, and a Q1–Q7 decision table (decided/deferred + one-line reason)
- [x] T02: Identity classes in `spike/src/model.ts`: every ID gets `scope` = `placeholder` (≤ 2 chars), `local` (same ID with conflicting labels across diagrams, or doc frontmatter `ids: local`), or `global` (default). Local/placeholder elements are keyed per diagram and excluded from cross-linking, hubs and hierarchy; frontmatter `ids: { shared: [...] }` forces global. `index.json` elements gain `scope`
- [x] T03: Parent inference in `model.ts`: drop "nodes of a doc are children of the doc" for docs without explicit `id:`; replace every `parent ??=` first-wins with a `parentCandidates` list; set `parent` only when explicit or exactly one candidate; `children` exclude placeholder/local elements; ambiguous parents stay listed in report §5
- [x] T04: Q7 — detect `docusaurus.config.*` / `mkdocs.yml` at or above the indexed folder; when present, frontmatter `id` is an *inferred* doc id (confidence 0.6, no doc-children) instead of an explicit element ID (`spike/src/infer.ts`)
- [x] T05: Scenario anchoring: resolve each participant to a global element (has a doc or ≥ 2 appearances) and compute the % per repo; stop emitting `edge-not-in-diagram` diagnostics for inferred scenarios (edge resolution stays an info-only metric); `dyd context` scenario list unchanged
- [x] T06: Report (`spike/src/report.ts`): add §8 "Hub bundles" printing the top-5 global hubs per repo with the 4 rubric fields and an empty pass/fail column; add global/local/placeholder counts to §2; keep the old "cross-linked (exact ID in ≥ 2 diagrams)" number unchanged alongside
- [x] T07: Unit tests for identity classification, parent-candidate resolution, SSG `id` detection and participant resolution in `spike/src/*.test.ts` [unit]
- [x] T08: Toy regression: `dyd context OrderService` bundle unchanged, extractor tests and full `npx vitest run` green [integration]
- [x] T09: Re-run `dyd init` on the 3 pinned corpora; owner scores the 15 bundles against the rubric; record per-repo metrics, old vs new numbers and the gate verdict in `docs/brownfield-findings-2.md` [UAT]
- [x] T10: Update `docs/product-brief.md`: §5.1/§5.3 identity scope + parent rules, §8 A1 row (new test + outcome), §9 brownfield criterion = new gate
- [x] T11 (N/A — gate passed in T09; caveats recorded in findings-2 and brief §8 A1): If the gate failed in T09: record the fallback lock in `docs/brownfield-findings-2.md` and brief §4/§6.1 (Day-0 = render + report + scenarios; `init --agent` normalisation on the brownfield critical path; A1 spiking closed)
