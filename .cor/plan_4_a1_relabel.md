# COR Plan — A1 relabel: "gate passed, assumption not validated"

## Context

The A1 redo (`.cor/plan_3_a1_redo.md`) passed its pre-registered hub-bundle gate on 3/3 repos, but the pass is vacuous: `parent`/`children` pass by absence on all 15 bundles and the 5 `appearsIn` failures changed no verdict (`docs/brownfield-findings-2.md` "Gate verdict"). Calling A1 "passed" misrepresents reality. This plan relabels the verdict honestly and aligns the product brief's Day-0 promise with what the spike showed. Docs only.

### Current state

- `docs/brownfield-findings-2.md` "Gate verdict": "A1 passes the pre-registered gate, literally" + 5 caveats; no relabel.
- `docs/product-brief.md`:
  - §3 D8 (line ~61): "Day 0 works on raw brownfield Mermaid" — "useful" undefined.
  - §6.1 `dyd init` (line ~223): adoption report headlines "% cross-linked" (the discredited Run 1 metric).
  - §6.1 "Inference (brownfield Day 0)" (line ~229): "Infer hierarchy from folder structure and Markdown heading nesting" — not supported by the spike (hub parents empty).
  - §7.4: "Plug-and-play on brownfield … useful (if partial) model".
  - §8 A1 row (line ~279): confidence "Medium"; result text says "passed … but weakly".
  - §9 brownfield criterion (line ~292): "Result: passed (see the caveats in §8 A1)".
  - Last decision row is D10 → new row is D11.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Pre-registration | Binding: no re-gate, no re-run; only relabel/reinterpret | Changing the gate after seeing data is not credible |
| Verdict label | "Gate passed, assumption not validated" — literal result kept, vacuity on `parent`/`children` stated | Honest without rewriting the record |
| Record form | Dated "Verdict addendum" in findings-2 (original text intact) + new D11 row in brief §3 | Preserve the audit trail |
| D8 / §7.4 | Kept; "useful" redefined as render + `appearsIn` + scenarios + honest report | Brownfield stays a hard constraint, with a promise the evidence supports |
| Hierarchy inference | Out of the Day-0 promise; explicit-frontmatter feature only | Spike returned no parent/children on hubs |
| Adoption report | Headline = identity-class counts (global/local/placeholder) + top hub bundles; "% cross-linked" kept as a secondary line | Old metric measured vocabulary reuse, not model quality |
| A1 confidence | "Low (gate passed vacuously; not validated)" | Matches the evidence |
| §5.1 Parent row | Unchanged | Describes the model rule (unambiguous single candidate), not the Day-0 promise |

### Scope

**In scope:** `docs/brownfield-findings-2.md`, `docs/product-brief.md` (§3, D8, §6.1, §7.4, §8 A1, §9).
**Out of scope:** any `spike/` code change, re-running the indexer, new gates, triggering the fallback lock, §5.1 Parent row, other assumptions (A2–A7).

### Invariants

- The old 26.2 / 11.7 / 22.5 % numbers stay visible.
- Original "Gate verdict" text in findings-2 is not edited.

### Acceptance criteria

- Reading/grepping the brief finds no Day-0 promise of hierarchy inference and no claim that A1 is validated.
- findings-2 carries the relabel in a dated addendum.
- Owner reviews the diff.

## Tasks

- [x] T01: Add a dated "Verdict addendum" to `docs/brownfield-findings-2.md` relabelling A1 as "gate passed, assumption not validated" (vacuous on `parent`/`children`; `appearsIn` failures changed no verdict); original verdict text untouched
- [x] T02: Add D11 row to brief §3 recording the relabel and that the pre-registration is binding (no re-gate/re-run)
- [x] T03: Update brief D8 and §7.4 so Day-0 "useful" = render + `appearsIn` + scenarios + honest report
- [x] T04: Brief §6.1 inference: remove folder/heading hierarchy inference from the Day-0 promise; hierarchy is explicit-frontmatter only
- [x] T05: Brief §6.1 `dyd init`: adoption report headline = identity-class counts + top hub bundles; "% cross-linked" as secondary line
- [x] T06: Brief §8 A1 row: confidence "Low (gate passed vacuously; not validated)" + aligned result text; align §9 brownfield criterion wording
- [x] T07: Grep/read the brief for Day-0 hierarchy promises or "validated" A1 claims; owner reviews the diff [UAT]
