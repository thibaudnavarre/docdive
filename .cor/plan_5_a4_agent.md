# COR Plan — A4 spike: conventions skill + agent test

## Context

Validate product-brief assumption **A4** ("Agents keep IDs consistent given the conventions skill", `docs/product-brief.md` §8, currently "High", untested) with a binding, pre-registered gate. This is step 3 of the brief's validation plan (§10) and the "Agent test" success criterion (§9).

### Current state

- `spike/src/cli.ts` has only `index`, `init`, `context`: **no `lint`, no `--fix`**.
- Reusable pieces: `Diagnostic` (`spike/src/model.ts:40`), `resolveParticipant` (`spike/src/model.ts:290`), `lintEdgeNotInDiagram` (`spike/src/model.ts:296`), `proposeFuzzyIds` (`spike/src/fuzzy.ts:25`), `inferSrc` (`spike/src/src.ts:44`), `loadDocs` (`spike/src/loader.ts:102`).
- **No conventions skill exists.** The brief (§4, §6.1) describes it as ~30 lines: ID rules, frontmatter keys, subgraph-vs-document rule, scenario authoring, how to read lint output.
- Lint rules as listed in the brief (§6.1): unresolved participant, duplicate ID across siblings, missing parent, missing `src` path, label/ID near-duplicates.
- §5.3 says unmatched participants (actors, UI) are **allowed**, which conflicts with "unresolved participant" as an error. The conflict is resolved below.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Assumption | A4 only | Next step in brief §10; A1 spiking is closed |
| Gate | Binding, pre-registered before any held-out run; no re-gate, no re-run | Same discipline as A1 Run 2; a gate changed after seeing data is not credible |
| Target repos | Small real public TypeScript/Node repos, 2–10k LOC, ≥ 3 modules, no existing Mermaid; one **dev** repo + one **held-out** repo; agent proposes candidates, owner approves | Real code without existing diagrams to copy from; same stack keeps the variable constant |
| Skill iteration | Iterate on the dev repo only, then freeze (hash recorded) and gate once on the held-out repo | §10's "iterate until clean" would overfit if done on the gated repo |
| Runs | 3 fresh subagent sessions (harness default model), gate passes on ≥ 2/3 runs | Variance across runs; majority avoids one flaky run deciding |
| Isolation | Each run in a temp dir outside the project containing only the target repo + skill file; prompt forbids other paths; transcripts and touched paths checked for leaks | The tested agent must not see `docs/` or `spike/` |
| Gated lint errors | Only the four errors from §6.1: unresolved participant, duplicate ID among siblings, missing parent, missing `src` path | Near-duplicates are a heuristic; kept as a warning |
| Unresolved participant | Error **only** when a scenario participant is a near-miss of a documented or parented ID (e.g. `OrderSvc` vs documented `OrderService`); plain actors/UI stay allowed | Keeps §5.3 ("unmatched participants are allowed") while catching real ID drift |
| `--fix` | Minimal and mechanical: missing parent → closest existing ID; near-duplicate rename. Gate allows ≤ 1 lint → `--fix` → agent cycle per run | §9 allows one `--fix` cycle; missing `src` cannot be auto-fixed, so the agent fixes it in its cycle |
| Non-vacuity floor (per run) | ≥ 5 docs, ≥ 1 `parent:` link, ≥ 1 scenario, ≥ 5 IDs appearing in ≥ 2 diagrams | A1 passed vacuously; zero errors on an empty model must not count |
| Semantic consistency | Manual review of hub bundles (same ID = same concept), reported as a secondary metric, **not gated** | Lint can't detect `Client` meaning three things (A1 lesson) |
| On gate fail | Record failure, lower A4 confidence, apply brief's "If wrong" (strengthen lint `--fix` / `init --agent`); no re-run | Pre-registration is binding |
| Code home | Extend `spike/` (lint in `spike/src`), throwaway quality; skill file under `spike/` | Spike, not v1 |
| Deliverable | `docs/agent-findings.md` (pre-registration + results) and brief §8/§9/§10 update | Same record shape as A1 |

### Scope

**In scope:** `spike/src` (lint, `--fix`, stats, tests), conventions skill file, isolation script + prompt template, `docs/agent-findings.md`, `docs/product-brief.md` (§8 A4 row, §9 agent test, §10 step 3, D12 only if a decision changes).
**Out of scope:** other assumptions (A2, A3, A5–A7), viewer/web component, MCP, `init --agent`, real v1 package, multi-model comparison, re-running A1, editing past findings docs.

### Invariants

- Existing `index` / `init` / `context` commands and their tests keep working (`npx vitest run`, `npx tsc --noEmit` in `spike/`).
- The skill is frozen (hash recorded) before any held-out run; the pre-registration text is not edited after the first held-out run (addenda only, dated).
- The tested agents never see `docs/`, `spike/` or the product brief.

### Acceptance criteria

- Pre-registration committed in `docs/agent-findings.md` before T11, including exact rule definitions, floor, pass rule, isolation protocol, on-fail.
- `dyd lint --json [--fix] --root <repo>` and `dyd stats --json` work and are unit-tested.
- 3 held-out runs executed, scored, leak-checked; verdict = pass iff ≥ 2/3 runs have 0 gated errors after ≤ 1 fix cycle **and** meet the floor.
- Semantic drift review reported alongside (not gated).
- Brief §8/§9/§10 reflect the verdict; owner has reviewed.

## Tasks

- [x] T01: Shortlist 3–4 public TS/Node repos (2–10k LOC, ≥ 3 modules, no Mermaid); propose dev + held-out pair; owner approves [UAT]
  - Approved 2026-11-15: **dev = `antfu-collective/ni`** (2.4k LOC), **held-out = `egoist/tsup`** (4.0k LOC), both MIT, 0 Mermaid files. Pin commit SHAs at T08. Alternates: consola (3.0k), markdoc (6.0k).
- [x] T02: Write pre-registration in `docs/agent-findings.md`: exact definitions of the 4 gated errors (incl. near-miss rule for unresolved participant), floor, 3 runs / ≥ 2 pass, ≤ 1 fix cycle, isolation protocol, on-fail rule
- [x] T03: Add `dyd lint --json [--root <repo>]` to `spike/src` (4 gated errors + near-duplicate warning), reusing `Diagnostic`, `resolveParticipant`, `proposeFuzzyIds`
- [x] T04: Add minimal `--fix` (missing parent → closest ID; near-duplicate rename), applied in place
- [x] T05: Add `dyd stats --json` computing the floor metrics (docs, parent links, scenarios, IDs in ≥ 2 diagrams)
- [x] T06: Unit tests for lint rules, `--fix` and stats on small fixture doc sets [unit]
- [x] T07: Write conventions skill v0 (~30 lines) under `spike/`
- [x] T08: Isolation harness: script creating a temp dir with only target repo + skill, fixed agent prompt template, leak check over transcript and touched paths
- [x] T09: Iterate the skill on the dev repo (agent run → lint → revise); log each revision and its reason in `docs/agent-findings.md`
- [x] T10: Freeze the skill; record its hash in the pre-registration
- [x] T11: Run 3 fresh isolated subagents on the held-out repo, each with ≤ 1 lint → `--fix` → agent cycle; save outputs and transcripts
- [x] T12: Score each run against the gate (lint + stats) and run the leak check [integration]
- [x] T13: Manual semantic review of hub bundles per run (same ID = same concept); report, not gated
- [x] T14: Write verdict and results in `docs/agent-findings.md`
- [x] T15: Update brief §8 A4 row, §9 agent test, §10 step 3; add D12 only if the verdict changes a decision
- [x] T16: Owner reviews findings and brief diff [UAT]
