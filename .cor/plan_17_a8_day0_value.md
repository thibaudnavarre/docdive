# COR Plan — A8: Day-0 value of `docdive init` output on a brownfield repo

## Context

A1 is closed by D11 ("gate passed, assumption not validated"; no re-gate, no re-run). This plan asks a **different** question, added to the brief as **A8**: does the Day-0 output docdive promises in D8 (render + `appearsIn` + scenarios + honest report, no conventions applied) help a fresh agent do a real documentation task on a brownfield repo better than the agent does on its own? It measures task outcome, not inferred-model quality. A1 and D11 are not touched.

### Current state

- Brief §11 tidied (naming, tech stack, Mermaid parsing, diagram types resolved); `init --agent` ranking tested and rejected (`docs/ranking-findings.md`).
- Three pinned corpora (gitlabhq, temporal, posthog) were all used to build or tune the indexer; none is held out.
- New held-out corpus, censused on 2026-11-16 among 10 public docs repos (only two had > 10 fenced Mermaid blocks): `cloudflare/cloudflare-docs` `src/content/docs` @ `bb8a4aa14e222f5796c6038e64d365a0fcd3cede` — 7194 docs, 201 blocks (190 supported, 1 unsupported-type, 10 parse-failed), 171 flowcharts, 19 sequence diagrams. Added to `scripts/fetch-corpus.sh`.
- `docdive init` on it: 269 elements in ≥ 1 diagram, 145 cross-linked (37.5 %), 19 inferred scenarios.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Question | Task outcome on a brownfield repo, Day-0 output only | The only A1-adjacent question D11 leaves open |
| Corpus | cloudflare-docs, pinned SHA above, held out | Largest fenced-Mermaid corpus found; never used to tune anything |
| Element selection | Top 3 global IDs of ≥ 3 chars by **distinct files** in `appearsIn`, ties by diagram count then ID order | Fixed before looking at results; the diagram-count order used by hub bundles is dominated by one 12-diagram file |
| Task | Rename-impact: "node ID X is renamed; list every Mermaid block to edit" | Real doc task; objective ground truth; exercises `appearsIn`, the Day-0 field that carries the value |
| Ground truth | Hand-labeled by the owner **before** any agent run: every fenced Mermaid block where X is a node/participant ID (not a label, not prose), keyed `file#block` (0-based over all fences in the file, parse-failed included, same as docdive) | Gradeable, same key space as docdive |
| Arms | A: repo copy + pasted `docdive context X` bundle; B: repo copy only, grep allowed. One fresh isolated `general-purpose` subagent per arm per element, same one-line task, harness default model, run in parallel | Mirrors the A4/A6 protocol |
| Metrics | Recall and precision against ground truth per element and arm; wall time | Recall is the value; precision guards against `appearsIn` identity mixing |
| Gate | Pass if arm A recall ≥ arm B recall on ≥ 2 of 3 elements **and** arm A has no false positive that comes from the bundle (a location listed in `appearsIn` where X is not that node). Non-vacuity: every ground truth spans ≥ 2 files | Fixed before runs |
| Failure | Record, update brief A8 + §8 "If wrong", nothing shipped | Evidence either way |
| Code changes | None to `packages/*` | This is a measurement, not a feature |

### Scope

**In scope:** `scripts/fetch-corpus.sh` (4th corpus), `docs/day0-findings.md`, brief §8 (A8 row) and §9 (criterion), this plan.

**Out of scope:** any indexer/CLI/element change, re-running the A1 gate, other corpora, other models, fixing the 10 parse-failed blocks (they stay in the result as a Day-0 limit).

### Invariants

- No file under `packages/`, `apps/`, `examples/` changes.
- Agents run in a temp dir outside this project holding only the corpus docs folder; the prompt forbids other paths.

### Acceptance criteria

- Pre-registration (question, corpus, selection rule, task text, ground truth, arms, gate) written in `docs/day0-findings.md` before the first agent run.
- Ground truth labeled and recorded before the first agent run.
- 6 runs recorded with raw outputs, recall, precision, wall time.
- Verdict applied as pre-registered; brief §8 A8 and §9 updated either way.

## Tasks

- [x] T01: Write the pre-registration in `docs/day0-findings.md` (question, corpus + SHA + census, selection rule and the 3 selected elements, exact task text for both arms, ground-truth rule, gate, non-vacuity, limits known in advance)
- [x] T02: Label the ground truth for the 3 elements (grep inside fences, then read each hit) and record it in `docs/day0-findings.md` [UAT: owner confirms before runs]
- [x] T03: Prepare the run dirs: copy the corpus docs folder to a temp dir per run; generate `docdive context X` for arm A
- [x] T04: Run the 6 subagents in parallel; store raw replies under `docs/day0-runs/` (or inline when short)
- [x] T05: Score recall/precision/time, apply the gate, record the verdict and limits in `docs/day0-findings.md`
- [x] T06: Brief: add A8 row in §8 and a "Day-0 value" criterion in §9 with the result; CHANGELOG untouched (no code)
