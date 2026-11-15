# Brownfield spike findings — assumption A1

Disposable `spike/` indexer extended with Day-0 inference rules and `dyd init`, run over three public docs corpora. Reproduce with `spike/scripts/fetch-corpus.sh`, then `npx tsx spike/src/cli.ts init spike/corpus/<repo>/<path> [--src spike/corpus/gitlabhq]` (from the repo root: `cd spike`). Full per-repo reports were generated with `dyd init`; the numbers below are copied from them.

## Corpus (pinned)

| Repo | Path | SHA | Docs | Mermaid blocks |
| --- | --- | --- | --- | --- |
| gitlabhq/gitlabhq | `doc/` | `d7b9a6176ab4e279465ba3ee09922cde2b74de47` | 3090 | 335 |
| temporalio/documentation | `docs/` | `882a9dececd9ddcf7d3e18d4934b191c7e82a161` | 808 | 72 |
| PostHog/posthog.com | `contents/` | `bdf3ff26372578def9794105bc79b61d194f92a1` | 4000 | 63 |

## Verdict

**A1 fails the pre-registered gate.** The gate was "≥ 50 % of elements cross-linked (exact ID in ≥ 2 diagrams) on ≥ 1 repo **and** 3 sane `dyd context` bundles per repo". The best repo reaches 26.2 %, so the number gate fails regardless of the bundle judgement. Per the plan, the spike still succeeded: the gap and the most useful rules are recorded below, and the decision is deferred to the next Think.

| Metric | gitlab | temporal | posthog |
| --- | --- | --- | --- |
| Blocks supported / unsupported-type / parse-failed | 298 / 36 / 1 | 71 / 1 / 0 | 56 / 7 / 0 |
| Elements appearing in ≥ 1 diagram | 983 | 366 | 258 |
| **Cross-linked (exact ID in ≥ 2 diagrams)** | **258 (26.2 %)** | **43 (11.7 %)** | **58 (22.5 %)** |
| Same, IDs of ≥ 3 chars only (drops `A`/`B`/`C`) | 199/819 (24.3 %) | 24/299 (8 %) | 30/195 (15.4 %) |
| Same, if case/separator variants were merged | 262/923 (28.4 %) | 46/363 (12.7 %) | 53/247 (21.5 %) |
| With doc text (doc or nearest-section prose) | 281 (28.6 %) | 118 (32.2 %) | 85 (32.9 %) |
| With parent | 805 (81.9 %) | 329 (89.9 %) | 243 (94.2 %) |
| Scenarios (all inferred) / steps resolved to a flowchart edge | 103 / 12.8 % | 32 / 5 % | 13 / 0 % |
| Steps with a conflicting flowchart / no flowchart with both endpoints | 115 / 843 | 65 / 223 | 2 / 79 |
| Fuzzy ID proposals | 224 | 105 | 17 |
| Elements with inferred `src` (gitlab only) | 246 (25 %) | n/a | n/a |

### Bundle sanity (pre-assessment, owner to confirm)

Three bundles per repo were read: gitlab `Gitaly`, `Workhorse`, `MergeRequest`; temporal `Workflow`, `Client`, `Temporal`; posthog `Kafka`, `CAPTURE`, `PostHog`.

- **Useful:** `appearsIn` and the scenario traces for hub concepts. `Workhorse` (16 diagrams) and `Workflow` (16 diagrams) return a usable cross-doc picture of who talks to whom.
- **Not sane:** `parent`/`children`. `Workflow` has parent `non-retryable-errors` (a doc slug), `Workhorse` has parent `Gitaly clients` (a subgraph in one diagram), and `Gitaly` has children `C`, `D`, `E` (placeholder nodes). First-wins parenting turns an accident of one diagram into the concept's identity.
- **Weak:** inferred `src`. Only the 30 namespaced `file` matches look right (`Api::Internal::Base` → `lib/api/internal/base.rb`). Single-word IDs match unrelated files (`Workhorse` → `app/uploaders/workhorse.rb`, `MergeRequest` → a JS util).
- **No bundle was rejected on `appearsIn`/scenarios alone**, so the bundle half of the gate is "partial", not "fail". The verdict does not depend on it.

## Which inference rules helped

1. **Hardening the extractors (T03/T03b) was a precondition, not an inference rule.** The week-1 extractors failed on 72 % (gitlab), 24 % (temporal) and 39 % (posthog) of supported-type blocks. After skip-and-count plus syntax hardening: 1, 0, 0 failures. Before that, any A1 number would have measured the parser.
2. **Any `sequenceDiagram` as a scenario:** 103 / 32 / 13 scenarios for free (the explicit `kind: scenario` rule gave 0). The scenarios are the most valuable output, but few steps resolve to a flowchart edge (see below).
3. **Subgraphs → hierarchy:** 309 / 179 / 81 elements get a parent that is not a doc. Cheap and mostly right when the subgraph is a real grouping.
4. **Nearest-section prose:** 28.6–32.9 % of diagram elements get text. Hit quality is mixed: short or generic IDs/labels match unrelated paragraphs (confidence-scored 0.4–0.6, never above).
5. **Folder-nesting parent for docs:** works where `_index`/`index` docs exist (gitlab, posthog); temporal doc folders are mostly flat.
6. **Fuzzy IDs:** low value. Case/separator merging would move cross-linking by ≤ 2 points. Edit-distance proposals are mostly false positives (`Interactions` ~ `Iterations`).
7. **`src` search:** only namespaced file matches are trustworthy.

## What the implicit model could not express

- **Local vs global identity.** The same ID means different things in different diagrams: `Start` has four unrelated labels in gitlab, `events` is both a table and a question in posthog. 60 / 27 / 36 IDs carry different labels across diagrams (14 / 13 / 13 excluding IDs of ≤ 2 chars). Exact-ID linking cannot tell a shared concept (`Gitaly`) from a coincidence.
- **Placeholder IDs.** `A`…`J` are the most "connected" elements in every repo (up to 105 diagrams). They inflate cross-linking and poison hierarchy. Any real metric must exclude them; the report now shows the ≥ 3-char variant and a top-10 without them.
- **Docs as islands.** temporal has 53 docs with diagrams and 72 blocks; posthog 37 docs and 63 blocks. Each diagram is mostly self-contained, so zero-config linking has little to link. This is the main reason the number is low, and fuzzy merging does not change it.
- **Two vocabularies per scenario.** Sequence participants (`Git on client`, `Rails`, `Workflow`) rarely equal flowchart node IDs, hence 12.8 / 5 / 0 % of steps resolving to an edge.
- **Doc ownership.** Docs without an `id` become elements by filename (confidence 0.6); folder `_index` docs name their folder. Docusaurus `id`s (temporal) are treated as explicit element IDs, which they are not by intent.
- **Unsupported diagram types** (counted, not modelled): gitlab 36 blocks (`gitGraph` 14, `erDiagram` 11, `classDiagram` 2, `stateDiagram` 4, `gantt` 2, `treeView-beta` 2, `xychart-beta` 1); posthog 7 (`block-beta` 5, `gantt` 1, `stateDiagram-v2` 1); temporal 1.
- **Heading nesting** (T06) was stubbed: only folder nesting and subgraphs produce hierarchy.

## Parsing surprises

- Real Mermaid is much looser than the toy: quoted labels (`A["x & y"]`), `:::class` suffixes, `&` inside labels, `A --> |x| B` and `A--text-->B`, multi-line labels, `@{ label: … }` nodes, `accTitle`/`accDescr` in sequence diagrams, participant names with spaces, in-block `---` frontmatter, `A.B` / `A::B` / `GET:Geo` IDs, indented ```` ```mermaid ```` fences, `.mdx`.
- The week-1 line-based extractor split statements on `&`; replaced by a small scanner (still regex/line-oriented, no Mermaid parser dependency).
- Remaining parse failure: a node ID containing `/` (`gitlab-org-sandbox/gitlab-jh-validation`).
- Sections must be tracked with proper fence matching (length + character); a naive toggle on ```` ``` ```` desynchronised on one posthog blog post and surfaced Mermaid source as "prose".
- The corpus clone is sparse (`doc/` only for gitlab). `git ls-tree` gives the whole tree without blobs, so `src` path matching works; the `class|module|def` content search only sees checked-out files, so it ran against nothing on gitlab and is untested on real data.
- Inferred scenarios multiply `edge-not-in-diagram` diagnostics (gitlab 1010 vs 115 truly conflicting steps), because each flowchart containing both endpoints is checked. Inference needs a confidence-aware lint before it is shown to users.
- `spike/corpus/<name>` includes repo-root files; index the subfolder (`doc/`, `docs/`, `contents/`).

## A3 (scenario trace, parallel edges)

Still not exercised: no corpus diagram needed message IDs for the checks done. Status unchanged: untested.

## Open questions for the next Think

1. **Is "exact ID in ≥ 2 diagrams" the right gate?** On docs sites where each diagram is a local illustration, it measures vocabulary reuse, not model quality. Consider gating on bundles for hub concepts (≥ 3 diagrams, ≥ 3-char IDs) instead.
2. **Scope of identity.** Per-doc IDs by default, with an opt-in (frontmatter or a convention) for shared IDs? Treat IDs of ≤ 2 chars as local by default?
3. **Parent inference.** Drop "nodes of a doc are children of the doc" for undeclared docs; keep subgraph and folder hierarchy; keep first-wins out of any shown bundle.
4. **The §8 fallback.** Given 8–26 % linking, lower the Day-0 promise to "render + report + scenarios", and put `init --agent` normalisation (rename placeholders, declare IDs) on the critical path.
5. **Scenarios as the lead feature.** Inferred scenarios are plentiful but weakly anchored. Is the real win linking scenario participants to docs/elements rather than to flowcharts?
6. **Diagram coverage.** `erDiagram`/`gitGraph`/`stateDiagram`/`block-beta` are 11 % of gitlab blocks and posthog blocks each; decide whether Day-0 extraction should cover ER/state.
7. **Is Docusaurus/MkDocs frontmatter `id` an element ID?** Probably not; the wrappers should map it differently.
