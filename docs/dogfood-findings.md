# A6 dogfood — docdive documents itself, deep-link copy through the loop

Tests brief assumption **A6**: "Click-to-context is a sufficient v1 agent handoff without a live endpoint" ([product-brief.md](./product-brief.md) §8, "Dogfood" criterion of §9). One real change goes end-to-end on docdive's own architecture docs: diagram click → Copy context → fresh agent → docs and code updated. The real change is **deep-link copy** in `<docdive-diagram>`. This document **pre-registers** the gate, then records the results. Plan: `.cor/plan_12_a6_dogfood.md`.

## Pre-registration (2026-11-16)

Written and frozen **before any run** (T02 onward). Results are reported against this section, not by editing it. Any later change is a dated entry in *Amendments*, never an in-place edit.

### Question

Is the pasted context bundle (`contexts.json` entry for the clicked element), plus a one-line task, enough for a fresh agent to find the right files and ship a real change with code, test and docs, without a live endpoint?

### Setup under test

| Subject | Fixed value |
| --- | --- |
| Corpus | docdive's own architecture in `docs/architecture/` (CLI, element, adapters), written by a fresh subagent with `packages/docdive/skill/conventions.md` (T02), reviewed by the owner (T03) |
| Host | `apps/docs-site` (Docusaurus, local only) under `npm run docs:dev` (T04) |
| Context source | "Copy context" on the `<docdive-diagram>` element that owns the change, taken from the docs-site (not from `docdive context`) |
| Loop agent | A fresh, isolated subagent with repo access that receives **only** the pasted context and the one-line task below. No hints, no file names, no spec |
| Test gaps | cor-code fills only what the subagent missed; each gap is recorded as a **miss** |

### The real change: deep-link copy (spec)

The element panel gets a "Copy link" action. The copied URL, opened in a new tab, restores the same view.

| # | Behavior |
| --- | --- |
| D1 | The panel of a selected element has a "Copy link" action that writes a URL to the clipboard and reports success or the error name, like "Copy context" |
| D2 | The URL is the current page URL plus the selected element ID and, when a trace is active (step ≥ 1), the existing `docdive-scenario` and `docdive-step` params |
| D3 | On load, the element named in the URL is selected and its panel is open. The trace is restored paused, as today |
| D4 | On a page with several `<docdive-diagram>`, only a diagram that contains the element selects it; the others ignore it silently |
| D5 | An ID that no diagram contains (stale link) shows no error and no panel; the page behaves as without the param |
| D6 | Existing params (`docdive-scenario`, `docdive-step`, `docdive-interval`), "Copy context" and "Open" keep their behavior |

The name of the new URL param and of the new `data-docdive-*` hooks is the agent's choice. It is recorded in the results, and the owner judges naming in T09.

### Subagent prompt template (frozen)

Everything the loop agent receives, with `<PASTE>` replaced by the clipboard content of "Copy context":

```text
<PASTE>

Task: add a "Copy link" action to this element's panel that copies a URL restoring this same selection (and the active trace), with an e2e test.
```

### Gated checklist

Binary items, evaluated on the loop agent's change before any gap fill (T08).

| # | Item | Pass when |
| --- | --- | --- |
| 1 | Right files from the context alone | The agent edits the element source, adds an e2e spec and updates the `docs/architecture` page of the element, and needs no hint from the harness or owner. Files it opened are recorded |
| 2 | Code works | `npm run typecheck`, `npm run lint`, `npm test`, `uvx ruff check .`, the new deep-link e2e, `npm run e2e`, `npm run e2e:ssg` and `npm run e2e:dev` pass. A failure fixed in cor-code is a miss |
| 3 | Docs updated in the same change | The `docs/architecture` page for the element describes the new behavior, and `npm run docdive -- lint --root . --docs docs/architecture` reports 0 errors |

### Final gate

The owner walks through D1–D5 in the docs-site (copy link → open in a new tab → same element, panel and trace step) and answers **yes/no**: "Would this handoff do for my real Doc-as-Code changes, without a live endpoint?"

| Outcome | Meaning |
| --- | --- |
| All 3 checklist items pass **and** owner yes | A6 holds for v1 |
| Any checklist item fails **or** owner no | A6 fails. Apply the brief's "If wrong": prioritize a dev-mode endpoint. No re-run, no gate change. A new attempt needs a new pre-registration |
| Checklist passes only after gap fills | A6 holds only if the owner says yes; the misses are carried into the brief as known limits |

### Threats to validity (declared up front)

- One change, one agent, one repo: a pass is an existence proof, not a rate.
- The corpus author (T02) and the loop agent (T07) are the same model family.
- Subagent tool-call traces may be unavailable, so "files opened" can rely on its final report plus `git diff`.

## Amendments

_None yet._

## Run log

### T02 — architecture docs (2026-11-16)

Fresh subagent with `packages/docdive/skill/conventions.md` wrote `docs/architecture/` (system, CLI, element, 2 adapters, 2 scenarios; 34 elements, 7 diagrams). Lint: 0 errors, 2 `edge-not-in-diagram` warnings. Conventions gaps it reported (skill is frozen, not changed here):

- Scenario files need an `id`; without it the indexer silently skips them. The skill only describes `id` for elements.
- Self-messages in sequence diagrams trigger `edge-not-in-diagram`; the agent removed them.
- The skill does not say how to model an element's internals.

### T04 — docs-site (2026-11-16)

`apps/docs-site` (Docusaurus 3.10.2, theme-mermaid, `docusaurus-theme-docdive` with `src: ../..`, docs path `../../docs/architecture`) has no `build` script, so `npm run build` ignores it. Root scripts: `docs:dev`, `docs:build`. Both verified (build clean; dev serves `/docdive/index.json` and `contexts.json`). The docs are served at `/`, which needed `slug: /` in `docs/architecture/system.md` to avoid broken-link warnings; lint stays at 0 errors, 0 warnings.

### T07 — the loop (2026-11-16)

- **Paste:** the owner clicked `InfoPanel` on the `DocdiveElement` page and copied the context. It had no `src` (`Source: (none)`, `doc: (none)`, confidence 0.5): `InfoPanel` is a node without its own doc, so the bundle carried only the parent, the diagram location and a truncated "nearest section" (the first ~600 chars of the parent's bullet list, cut mid-sentence at `…`).
- **Isolation:** the prompt was the frozen template, verbatim. To keep the spec out of reach, `docs/dogfood-findings.md` and the plan file were moved out of the working tree during the run and restored afterwards. A before/after manifest of the repo was kept; the rest of the repo (including `docs/*.md` findings and `.claude/rules/`) stayed readable.
- **Hints:** none needed. The subagent ran to completion in one go, with no questions.
- **Files opened:** the tool-call trace is unavailable (declared threat). The final reply and `git diff` show it touched `packages/docdive-element/src/element.ts`, `e2e/trace-context.pw.ts` and the `InfoPanel` bullet of `docs/architecture/docdive-element.md`, and it read `.claude/rules/dyd-element.md` (path-scoped rule file, which it reported as stale: it still points at `spike/...`).
- **What it built:** a "Copy link" button (`data-docdive-copy-link`, status `data-docdive-copy-link-status`), URL param `docdive-select=<id>` plus the existing `docdive-scenario` / `docdive-step` when step ≥ 1, `restoreSelection()` on load (ignored unless the element is a node of this diagram), and e2e test T10 in `e2e/trace-context.pw.ts` (both SSGs). It ran typecheck, lint and `e2e:ssg` (38 specs). It did not run `npm run e2e` or `e2e:dev`.

### T08 — verification of the loop agent's change (2026-11-16)

All run on the change as delivered, **no gap fill needed, zero misses**:

| Check | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm test` (82), `uvx ruff check .` | pass |
| `npm run examples:build` | pass |
| `npm run e2e` (10) | pass |
| `npm run e2e:ssg` (38, incl. new T10 on both SSGs) | pass |
| `npm run e2e:dev` (1) | pass |
| `docdive lint --root . --docs docs/architecture` | 0 errors, 0 warnings |

Gaps seen (not misses against the gate): the agent did not run `e2e` and `e2e:dev` itself, and `.claude/rules/dyd-element.md` still points at `spike/...` paths (pre-existing, reported by the agent). Spec items D1–D3 and D5 are covered by T10; D4 (several diagrams, only the owner of the element selects) is implemented by the `restoreSelection()` guard but has no dedicated spec.

### T09 — owner walkthrough and A6 verdict (2026-11-16)

Walked through on the docs-site (`npm run docs:dev`, `http://localhost:3000/`), no page errors:

| Item | Observed |
| --- | --- |
| D1 | `DocdiveCli` selected on `/`, scenario `CopyContextScenario` at step 2, "Copy link" → status `ok` |
| D2 | Clipboard: `http://localhost:3000/?docdive-select=DocdiveCli&docdive-scenario=CopyContextScenario&docdive-step=2` |
| D3 | New tab on that link: panel open on `DocdiveCli` (parent `system`), picker on `CopyContextScenario`, step 2 (`User ->> DocdiveElement: click Copy context`), `DocdiveElement` highlighted, trace paused (still step 2 after 2.5 s) |
| D4 | Not exercised: no architecture page has two fences (covered by the `restoreSelection()` guard only, as noted in T08) |
| D5 | `/DocdiveElement?docdive-select=DocdiveCli` (element not in that diagram): no panel, no error. `/?docdive-select=MkdocsAdapter`: panel only, step 0 |

**Naming:** `docdive-select`, `data-docdive-copy-link`, `data-docdive-copy-link-status` — kept as is (consistent with the `docdive-scenario`/`docdive-step` params and the `data-docdive-copy`/`-copy-status` pair).

**A6 answer: yes.** The owner would use this handoff for real Doc-as-Code changes without a live endpoint.

Reservations recorded with the yes: the paste the loop agent received (T07) had no `src` and a nearest-section cut mid-sentence at ~600 chars, because `InfoPanel` is a node without its own doc. The agent still found the right files with zero hints, so the handoff held, but the context bundle for undocumented nodes is thinner than the brief assumes. Carried as a known limit.

## Results against the gate (2026-11-16)

| # | Item | Result |
| --- | --- | --- |
| 1 | Right files from the context alone | **Pass.** The agent edited `packages/docdive-element/src/element.ts`, added the e2e spec T10 in `e2e/trace-context.pw.ts` and updated the `InfoPanel` bullet of `docs/architecture/docdive-element.md`, with no hint and no question (T07) |
| 2 | Code works | **Pass, zero misses.** Typecheck, lint, tests, ruff, new T10 on both SSGs, `e2e`, `e2e:ssg`, `e2e:dev` all green with no gap fill (T08) |
| 3 | Docs updated in the same change | **Pass.** The element page describes "Copy link" and `docdive-select`; docs lint 0 errors, 0 warnings (T08) |
| Owner | Walkthrough D1, D2, D3, D5 and A6 yes/no | **Yes** (T09). D4 was not exercised in the browser: no architecture page has two fences |

**Verdict: A6 holds for v1** (all 3 items pass, owner yes), validated narrowly.

Known limits carried into the brief:

- **Thin context for undocumented nodes (addressed afterwards).** The excerpt now ends at the matching list item or paragraph, and the bundle shows inferred `src` and the nearest ancestor's doc and `src`. The pasted bundle for `InfoPanel` had no `src`, `doc: (none)`, and a nearest-section snippet cut mid-sentence at about 600 characters. The agent still found the files, but the bundle is thinner than the brief assumed for nodes without their own doc.
- **One change, one agent, one repo**, with a corpus author and a loop agent from the same model family. An existence proof, not a rate.
- **Not a week of use.** The brief's "one week" dogfood was replaced by one end-to-end change.
- **D4 untested end to end:** multi-diagram pages rely on the `restoreSelection()` guard, with no dedicated spec.
- **Isolation was partial.** The spec file was hidden, but the rest of the repo stayed readable and the tool-call trace is unavailable.
- **Skill gaps (T02):** scenario files need an `id`, self-messages trigger `edge-not-in-diagram`, and the skill does not say how to model an element's internals.
- **Stale rule file:** `.claude/rules/dyd-element.md` still points at `spike/...` paths.
