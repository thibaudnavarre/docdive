# Agent spike — assumption A4

Tests brief assumption **A4**: "Agents keep IDs consistent given the conventions skill" ([product-brief.md](./product-brief.md) §8, step 3 of §10, "Agent test" criterion of §9). This document **pre-registers** the gate, then records the results.

## Pre-registration (2026-11-15)

Written and frozen **before any held-out run**. Results are reported against this section, not by editing it. Any later change must be appended as a dated amendment, never in place. Per plan, the skill hash (T10) is the only value filled in after this text is written, in the Amendments section.

### Question

Given only a ~30-line conventions skill and a real TypeScript/Node repo, does a fresh coding agent produce a Mermaid doc set that keeps element IDs consistent, as measured by `dyd lint`, after at most one `--fix` cycle?

### Targets

| Role | Repo | Why |
| --- | --- | --- |
| Dev (skill iteration, T09) | `antfu-collective/ni` | 2.4k LOC, MIT, no Mermaid |
| Held-out (gated, T11) | `egoist/tsup` | 4.0k LOC, MIT, no Mermaid, different domain (bundler) |

Owner-approved 2026-11-15. Commit SHAs are pinned in the isolation harness (T08) before any run and recorded here by amendment. The skill is iterated on the dev repo only; the held-out repo is never used before the freeze.

### Runs

- **3** fresh subagent sessions on the held-out repo, harness default model, no memory of other runs.
- Each run receives the same fixed prompt template (T08) naming the skill file and the target repo only.
- One **cycle** = `dyd lint --json` → (optional) `dyd lint --fix` → the agent edits docs once in response to remaining diagnostics → lint again. A run gets **at most one cycle**. The first lint is run by the harness, not the agent; the agent sees its output only in the cycle.
- No re-run of a failed or flaky run. A run that crashes or times out counts as a **fail**.

### Gated errors

Exactly four, taken from brief §6.1. All are computed on the model built by the indexer over the run's output docs folder. Everything else, including `fuzzy-id-candidate`, is a **warning** and is not gated.

| # | Rule | An error is emitted when |
| --- | --- | --- |
| E1 | `unresolved-participant` | A sequence participant `P` is not a global element with a doc or ≥ 2 diagram appearances (the `resolveParticipant` test) **and** `P` is a near-miss of an existing ID `Q`. Near-miss: `normalise(P) === normalise(Q)`, or the `fuzzy.ts` edit-distance test passes (distance ≤ 2 and ≤ 25 % of the longer normalised ID, both ≥ 5 chars, same digit-stripped form excluded), or `P` is an abbreviation of `Q` (normalised `P` has ≥ 4 chars, is shorter than `Q`, starts with the same letter, is a subsequence of `Q` and is ≥ 60 % of `Q`'s length, e.g. `OrderSvc` ⊂ `OrderService`), with `Q` a global element that has a doc or a parent link. `normalise` lowercases and removes `-_.:/` and whitespace. A participant with no near-miss (actors, UI) is allowed, per brief §5.3. |
| E2 | `duplicate-id-siblings` | Two or more docs that share the same `parent` (or both have none) declare the same explicit frontmatter `id`. |
| E3 | `missing-parent` | A doc's `parent:` value is not the explicit `id` of any doc in the set. |
| E4 | `missing-src` | A path in a doc's `src:` does not exist under the target repo root. |

`dyd lint --json` output is the sole source of truth: `{ errors: [...], warnings: [...] }`. The gate counts entries in `errors`.

### `--fix` (minimal, mechanical)

Applied in place; it never invents content.

- **E3**: rewrite `parent:` to the closest existing doc `id` (same normalised / edit-distance test as above) when exactly one candidate qualifies; otherwise leave unchanged.
- **Near-duplicate**: for a `fuzzy-id-candidate` pair with `kind: normalized`, rename the ID with fewer appearances to the one with more (ties: alphabetical) across all docs.
- **E1, E2, E4 are not auto-fixed.** E4 in particular needs the agent.

### Non-vacuity floor

A run counts only if its docs meet **all** of: ≥ 5 docs, ≥ 1 doc with a `parent:` link, ≥ 1 scenario (`sequenceDiagram`), ≥ 5 element IDs appearing in ≥ 2 diagrams. Metrics come from `dyd stats --json`. A run with zero errors that misses the floor is a fail (A1 passed vacuously on an empty model; that must not recur).

### Pass rule

- A **run passes** iff, after at most one cycle, `errors` is empty **and** the floor is met.
- The **gate passes** iff **≥ 2 of 3** runs pass.
- Verdict is binary: `A4 validated` or `A4 not validated`.

### Isolation protocol

- Each run executes in a fresh temp dir **outside this project** containing only a copy of the target repo at the pinned SHA and the frozen skill file. The prompt forbids reading or writing any other path.
- After each run, the transcript and the list of touched paths are checked for any path under this project (`docs/`, `spike/`, the brief) and for any mention of `dyd`'s source. Any leak **voids that run (counts as fail)**.
- The tested agent has no network requirement beyond what the harness permits. It is told the lint command output format only through the skill.

### Secondary, not gated

- **Semantic consistency.** For each run, the top 5 hub elements by diagram count are reviewed manually: does the same ID mean the same concept in every diagram where it appears? Reported as `n/5` per run, with examples. Lint cannot detect this (A1 lesson: `Client` meaning three things).
- Counts of warnings, cycles used (0 or 1), and whether `--fix` changed anything.

### On fail

Record the failure and lower A4 confidence in brief §8. Apply the brief's "If wrong": strengthen lint `--fix` and `init --agent`. **No re-run, no gate change, no new held-out repo.** A new attempt requires a new pre-registration.

### Out of scope

Other assumptions (A2, A3, A5–A7), viewer / web component, MCP server, `init --agent`, a multi-model comparison, re-running A1.

### Invariants

- The skill is frozen (hash recorded) before any held-out run.
- The tested agents never see `docs/`, `spike/` or the brief.
- This section is not edited after the first held-out run.

## Amendments

- 2026-11-15, before any run and before T03 shipped: added the *abbreviation* clause to E1's near-miss definition. The first draft (edit distance only) did not flag the brief's own example `OrderSvc` vs `OrderService` (distance 4). 
- 2026-11-15 (T08): pinned SHAs. `antfu-collective/ni` @ `71e261fd497c9e5f7bc925267ff249f5b9f9bc14`, `egoist/tsup` @ `198479b814f5981032dc0b7cd52c4b9e4b699ac3`. Agent output folder is `repo/docs/architecture/` (both repos may own a `docs/`), so lint runs with `--root <repo> --docs <repo>/docs/architecture`; `src:` paths are relative to the repo root. The skill's hash is recorded here at T10.
- 2026-11-15 (T10): **skill frozen** at v0. `spike/skill/conventions.md` SHA-256 `2554351d5799eeb212a84759e72a08cf3cccf20bf42b99ca7285c69db3622951`. No held-out run existed before this entry.

## Skill revisions (dev repo)

Two fresh dev runs on `ni` with skill **v0** (no revision needed, so none was made):

| Run | Docs | Errors after 0 cycles | Warnings | Floor (parent links / scenarios / shared IDs) |
| --- | --- | --- | --- | --- |
| dev1 | 10 | 0 | 5 | met (9 / 2 / 10) |
| dev2 | 10 | 0 | 35 (11 `edge-not-in-diagram`, 24 `fuzzy-id-candidate`) | met (9 / 2 / 9) |

Caveat noted before the gated runs: the four gated errors are cheap to avoid when the skill states the rules plainly, so a pass on the held-out repo says that agents follow explicit ID rules, not that the model is semantically consistent. That is why the semantic review (T13) is reported next to the gate. Warnings are not gated.

## Results

Held-out repo `egoist/tsup` @ `198479b…`, skill v0 (`2554351d…`, hash re-checked in all three run dirs), 3 fresh isolated `general-purpose` subagents run in parallel (~65–70 s each, harness default model).

| Run | Docs | Cycles used | Gated errors (E1–E4) | Warnings | Floor met | Leak | Pass |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 | 0 | 0 | 45 (44 `edge-not-in-diagram`, 1 `fuzzy-id-candidate`) | yes (9 parent links / 2 scenarios / 8 shared IDs) | no | **pass** |
| 2 | 8 | 0 | 0 | 1 (`edge-not-in-diagram`) | yes (7 / 1 / 7) | no | **pass** |
| 3 | 10 | 0 | 0 | 0 | yes (9 / 2 / 11) | no | **pass** |

### Verdict

**Gate passed: 3/3 runs (rule: ≥ 2/3). A4 is validated for this setup.** No run needed the `--fix` cycle, so `--fix` was not exercised against agent output (it is covered by unit tests only).

### Semantic review (secondary, not gated)

Top 5 hubs per run by diagram count; question: does the same ID mean the same concept in every diagram where it appears?

| Run | Hubs consistent | Notes |
| --- | --- | --- |
| 1 | 5/5 | `BuildOrchestrator` (9 diagrams), `EsbuildRunner`, `ConfigLoader`, `PluginContainer`, `CommandLine` each keep one meaning and one role. |
| 2 | 5/5 | `PluginSystem`, `BuildOrchestrator`, `ConfigLoader`, `DtsGenerator`, `EsbuildRunner`. Hubs are shallower (3–4 diagrams). |
| 3 | 5/5 | Also uses one label per ID everywhere (`Build orchestrator`, `Config loader`, …). Densest, cleanest cross-linking. |

What the review does **not** show:

- **ID drift outside the hubs exists and lint only warned.** Run 1 spells one component `OptionNormalizer` (`command-line.md`) and `OptionsNormalizer` (`build-orchestrator.md`). Neither is a documented element or a scenario participant, so it is outside E1; only `fuzzy-id-candidate` (warning) caught it.
- **Edge accuracy was not reviewed**, only concept identity. Run 1's 44 `edge-not-in-diagram` warnings say scenario steps often have no matching flowchart edge; that is the A1-era informational metric, not a gate.
- **Hub consistency was reviewed by one person (the implementing agent) from diagram edges and labels, not against tsup's code.** The owner review (T16) should spot-check.

### Deviations and limits (reported, not gate-changing)

1. **Transcripts are the agents' final replies only.** The tool-call trace of a subagent is not available to the harness, so the pre-registered leak check ran on the final reply (path and keyword grep) plus a before/after manifest of this project's `docs/` and `spike/`. A subagent reading `docs/` or `spike/` without modifying anything would not be detected. The prompt forbade it and the agents' outputs do not reference those folders, but the protection is weaker than pre-registered.
2. **Agents did not run lint themselves.** The harness linted once after the run (0 errors in all runs), so the "≤ 1 cycle" allowance was never used. Run 1 even stated it did not check `src:` paths after writing; all of its paths existed.
3. **One repo, one model, three runs, one stack.** The result supports "agents follow explicit ID rules on a small TypeScript repo", not generality across languages, repo sizes or models.
4. **The gate is lenient by construction** (see the dev-run caveat). Zero gated errors was reached at v0 on both repos; the skill was never stress-tested, and the gate cannot distinguish a consistent model from one that merely avoids the four lint errors.
