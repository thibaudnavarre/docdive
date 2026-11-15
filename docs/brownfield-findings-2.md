# Brownfield spike 2 — assumption A1 redo

Follow-up to [brownfield-findings.md](./brownfield-findings.md), which failed the A1 gate (best repo 26.2 % cross-linked vs ≥ 50 %) and deferred the decision. This document **pre-registers** a replacement gate and a revised identity model, then records the re-run on the same pinned corpus.

## Pre-registration (2026-11-15)

Written and frozen **before any indexer change**. Results, if they differ from expectations, are reported against this section, not by editing it. Any later edit to the gate, rubric or rules must be appended as a dated amendment, never in place.

### Why a new gate

The first gate ("≥ 50 % of elements cross-linked by exact ID in ≥ 2 diagrams") measures vocabulary reuse across diagrams, not the quality of what `dyd context` returns. On docs sites where each diagram is a local illustration it fails regardless of model quality. The new gate judges the bundle an agent would actually receive. The old number (26.2 / 11.7 / 22.5 %) is kept in every report next to the new result.

### Corpus (unchanged)

| Repo | Path | SHA |
| --- | --- | --- |
| gitlabhq/gitlabhq | `doc/` | `d7b9a6176ab4e279465ba3ee09922cde2b74de47` |
| temporalio/documentation | `docs/` | `882a9dececd9ddcf7d3e18d4934b191c7e82a161` |
| PostHog/posthog.com | `contents/` | `bdf3ff26372578def9794105bc79b61d194f92a1` |

### Gate

1. **Hub selection.** Per repo, take the top 5 elements by diagram count, restricted to *global* IDs of ≥ 3 characters that are not placeholders. Ties are broken by ID, alphabetically.
2. **Bundle scoring.** For each hub, `dyd context <id>` is scored on 4 binary fields:

   | Field | Pass when |
   | --- | --- |
   | `appearsIn` | lists only diagrams where the ID means this concept |
   | `parent` | absent, or a real container of the concept (not a doc slug, not an accident of one diagram) |
   | `children` | contain no placeholders (≤ 2-char IDs) and no doc slugs |
   | `scenarios` | every listed scenario involves the element |

3. **Bundle passes** at ≥ 3 of 4 fields.
4. **Repo passes** when a majority (≥ 3) of its 5 bundles pass. A repo with fewer than 5 eligible hubs is scored on the hubs it has; the majority is computed on that count and the shortfall is reported.
5. **Gate passes** when ≥ 1 repo passes.

Rules for honesty:

- **Non-concept hubs count against the gate.** `Start`, `Records`, `events`… are not filtered by a stop-list or an owner skip. The tool must not present them as hubs; a failing bundle is the honest result.
- The report prints the 4 fields per hub (machine-assisted) with an empty pass/fail column. **Pass/fail is judged by the owner** and recorded in this document. The spike does not auto-score.
- Same SHAs, same three repos, no corpus substitution.

### Rule changes applied to the spike (T02–T05)

**Identity classes (T02).** Every element ID gets a `scope`:

- `placeholder`: ID of ≤ 2 characters.
- `local`: the same ID carries conflicting labels across diagrams, or the doc's frontmatter declares `ids: local`.
- `global`: everything else (default).

Local and placeholder elements are keyed per diagram and excluded from cross-linking, hubs and hierarchy. Frontmatter `ids: { shared: [...] }` forces the listed IDs to `global`. `index.json` elements gain `scope`. Mermaid bodies are untouched; the opt-in/out lives in optional YAML frontmatter only.

**Parent inference (T03).**

- "Nodes of a doc are children of the doc" is dropped for docs **without** an explicit `id:` (inferred-from-filename docs no longer own their nodes).
- Every first-wins `parent ??=` is replaced by a `parentCandidates` list.
- `parent` is set only when explicit, or when exactly one candidate exists. Ambiguous parents stay listed in report §5.
- `children` exclude placeholder and local elements.

**SSG frontmatter `id` (T04).** When `docusaurus.config.*` or `mkdocs.yml` exists at or above the indexed folder, frontmatter `id` is an *inferred* doc id (confidence 0.6, no doc-children) rather than an explicit element ID (confidence 1).

**Scenario anchoring (T05).**

- Each sequence participant is resolved to a global element (has a doc, or ≥ 2 appearances). The % resolved is reported per repo.
- Inferred scenarios no longer emit `edge-not-in-diagram` diagnostics. Edge resolution stays an info-only metric.
- The `dyd context` scenario list is unchanged.

### Invariants

- Pinned corpus SHAs and repos unchanged.
- `spike/` stays disposable: no new runtime dependencies, no Mermaid parser, no productionising.
- Toy acceptance stays green: `dyd context OrderService` → parent `system`; children `Controller`/`Validator`/`Repository`; 2 `appearsIn`; scenario `checkout-happy-path`; `src/orders/`; `highlight.html` step order.
- `index.json` additions are preferred; breaking changes are allowed if recorded here.
- No further A1 iteration after this re-run.

### Pre-registered fallback

If the gate fails, the §8 fallback is locked and A1 spiking stops: Day-0 = render + report + scenarios; `init --agent` normalisation (rename placeholders, declare IDs) becomes the brownfield critical path.

### Q1–Q7 decisions

| # | Question | Status | Decision / reason |
| --- | --- | --- | --- |
| Q1 | Is "exact ID in ≥ 2 diagrams" the right gate? | **Decided** | No. Replaced by the hub-bundle gate above; the old metric is kept for comparison only. |
| Q2 | Scope of identity | **Decided** | Three classes (`global` / `local` / `placeholder`); ≤ 2-char IDs and conflicting-label IDs are not global; frontmatter opt-in `ids: { shared }` and opt-out `ids: local`. Global stays the default so the cross-doc model is not killed. |
| Q3 | Parent inference | **Decided** | No first-wins; explicit or a single candidate only; doc-children only for docs with an explicit `id:`. |
| Q4 | §8 fallback | **Decided (conditional)** | Locked as above if the gate fails; no further A1 spiking. |
| Q5 | Scenarios as the lead feature | **Decided** | Anchor participants to global elements instead of flowchart edges; measure the resolution %; drop edge-conflict diagnostics for inferred scenarios. |
| Q6 | Diagram coverage (ER/state/gitGraph/block-beta) | **Deferred** | Not Day-0. Counted as unsupported, not modelled; revisit only after the gate verdict. Low risk (≈ 11 % of blocks in gitlab and posthog). |
| Q7 | Is SSG frontmatter `id` an element ID? | **Decided** | No: inferred doc id (0.6) when an SSG config is detected; explicit element ID otherwise. |

## Results (2026-11-15)

Re-run with `npx tsx src/cli.ts init corpus/<repo>/<path>` in `spike/` (gitlab with `--src corpus/gitlabhq`), on the pinned SHAs above (verified with `git rev-parse HEAD`).

### Metrics, old vs new

| Metric | gitlab | temporal | posthog |
| --- | --- | --- | --- |
| Old gate metric — exact ID in ≥ 2 diagrams (unchanged definition, raw IDs) | 258 (26.2 %) | 43 (11.7 %) | 58 (22.5 %) |
| Identity, elements in ≥ 1 diagram: global / local (distinct IDs) / placeholder (distinct IDs) | 805 / 83 (14) / 953 (164) | 286 / 33 (13) / 117 (67) | 182 / 36 (13) / 197 (63) |
| Global elements with a parent (old: with any parent) | 25.3 % (81.9 %) | 45.5 % (89.9 %) | 34.1 % (94.2 %) |
| Ambiguous parents (≥ 2 candidates, none chosen) | 23 | 0 | 0 |
| Scenarios (inferred) | 103 | 32 | 13 |
| Participants anchored to a global element | 235/507 (46.4 %) | 45/109 (41.3 %) | 15/40 (37.5 %) |
| Steps resolved to a flowchart edge (info only) | 12.8 % | 5 % | 0 % |
| `edge-not-in-diagram` diagnostics for inferred scenarios (old: 1010 on gitlab) | 0 | 0 | 0 |
| Docs treated as SSG (frontmatter `id` inferred) | no | yes (`docusaurus.config.js`) | no |

The parent coverage dropped sharply by design: first-wins parenting is gone, placeholder and local IDs no longer take part in the hierarchy, and doc-children apply only to docs with an explicit `id:`. No placeholder, local ID or doc slug appears as a hub, parent or child in any bundle.

### Hub bundles scored

The owner delegated the `appearsIn` judgement to the assistant ("how am I supposed to know?"); it was scored by reading the neighbours and labels of the node in every listed diagram. `parent`, `children` and `scenarios` were scored mechanically from the report. For `scenarios` an empty list passes (no listed scenario fails to involve the element), the literal reading of the rubric.

| Repo | Hub (diagrams) | appearsIn | parent | children | scenarios | Bundle |
| --- | --- | --- | --- | --- | --- | --- |
| gitlab | Gitaly (22) | pass | pass (none; 2 ambiguous candidates) | pass (`GitalyServer`) | pass (16) | **pass** |
| gitlab | Client (16) | **fail**: Git client, web browser, Geo secondary client, API client | pass (none) | pass (none) | pass (15) | **pass** (3/4) |
| gitlab | User (14) | pass: the end-user actor | pass (none) | pass (none) | pass (11) | **pass** |
| gitlab | Redis (12) | pass | pass (none) | pass (none) | pass (9) | **pass** |
| gitlab | MergeRequest (9) | pass | pass (none) | pass (none) | pass (7) | **pass** |
| temporal | Workflow (16) | pass | pass (none) | pass (none) | pass (13) | **pass** |
| temporal | Client (11) | pass | pass (none) | pass (none) | pass (10) | **pass** |
| temporal | Temporal (8) | **fail**: the service in sequences, a "Worker Deployment" box in one flowchart | pass (none) | pass (none) | pass (7) | **pass** (3/4) |
| temporal | Activity (5) | pass | pass (none) | pass (none) | pass (4) | **pass** |
| temporal | API (3) | **fail**: external API vs. an unrelated participant | pass (none) | pass (none) | pass (3) | **pass** (3/4) |
| posthog | User (4) | **fail**: actor in 3 diagrams, a "User Message" node in the 4th | pass (none) | pass (none) | pass (3) | **pass** (3/4) |
| posthog | ClickHouse (3) | pass | pass (none) | pass (none) | pass (0, vacuous) | **pass** |
| posthog | Client (3) | **fail**: PostHog client, OAuth client, MCP client | pass (none) | pass (none) | pass (3) | **pass** (3/4) |
| posthog | CLIENT (3) | pass: "Client Library" ×3 | pass (none) | pass (none) | pass (0, vacuous) | **pass** |
| posthog | Kafka2 (3) | pass: label "Kafka" ×3 | pass (none) | pass (none) | pass (0, vacuous) | **pass** |

Per repo: gitlab 5/5, temporal 5/5, posthog 5/5.

### Gate verdict

**A1 passes the pre-registered gate, literally: 3 of 3 repos pass (majority required on ≥ 1).** The old number stays at 26.2 / 11.7 / 22.5 % and is not what was gated.

**The pass is weak, and should not be read as "the model works on brownfield docs":**

1. **The gate is vacuous on two fields.** Every one of the 15 bundles has `parent` = none and `children` = none (or only a real child, `GitalyServer`), so those fields pass by absence. Together with `scenarios` (true by construction, or empty), a bundle reaches 3/4 without `appearsIn`. The 5 `appearsIn` failures did not change a single bundle verdict.
2. **The hierarchy is effectively gone on brownfield docs.** The honest consequence of "no first-wins" is that the tool returns almost no parent/children for hubs; the value of the bundle on these corpora is `appearsIn` + scenarios only.
3. **`appearsIn` is judged on a generic vocabulary.** 5 of 15 hubs (`Client` ×3, `User`, `API`, `Temporal`) are generic or non-concept IDs whose cross-diagram identity is mixed. The model flags the label conflicts only when two non-ID labels disagree; one label plus ID-only occurrences (e.g. `Temporal`, `User`) is not detected.
4. **Small, duplicated base.** posthog hubs have 3–4 diagrams each, and `ClickHouse`, `CLIENT` and `Kafka2` come from the same architecture picture copied into three pages. `Kafka2` is a non-concept hub that passed because it is consistently labelled "Kafka".
5. **Scenarios stay weakly anchored:** 37–46 % of participants resolve to a global element (a doc or ≥ 2 appearances); edge resolution stays at 0–13 %.

Per the pre-registration there is no further A1 iteration: the fallback lock (T11) is **not** triggered because the gate did not fail, but the caveats above are carried into the product brief (T10) as the known limits of the Day-0 promise.

### Verdict addendum (2026-11-15): gate passed, assumption not validated

Relabel only. The gate, the data and the verdict text above are unchanged; the pre-registration stays binding (no re-gate, no re-run).

**A1 label: "gate passed, assumption not validated".** The literal result (3 of 3 repos pass) stands, and the 26.2 / 11.7 / 22.5 % numbers stay visible. The pass is not evidence that A1 holds:

- **Vacuous on `parent` / `children`.** Both fields pass by absence on all 15 hub bundles (caveat 1); they measure nothing about hierarchy inference.
- **`appearsIn` failures changed no verdict.** The 5 failing hubs did not flip a single bundle verdict, so the one informative field had no influence on the outcome.
- **What the spike does show:** `appearsIn` + scenarios on hub bundles, with an honest report. It does not show hierarchy inference on brownfield docs.

Consequence: A1 confidence is "Low (gate passed vacuously; not validated)" and the Day-0 promise carries no hierarchy inference (see product brief D11).
