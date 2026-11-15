# Viewer spike — brief §9 toy test (assumptions A2, A3)

Tests the brief's **toy test** ([product-brief.md](./product-brief.md) §9, step 4 of §10) and assumptions **A2** (deep dive via `id`/`parent` frontmatter) and **A3** (scenario trace via sequence participants). This document **pre-registers** the checklist, then records the results.

## Pre-registration (2026-11-15)

Written and frozen **before the verification run** (T11). Results are reported against this section, not by editing it. Any later change is a dated entry in *Amendments*, never an in-place edit.

### Question

On the toy system, do **deep dive + scenario trace + info panel** work with zero non-Mermaid syntax beyond frontmatter, and does clicking `OrderService` then selecting `checkout-happy-path` feel like understanding the system?

### Toy corpus under test

The 3-file toy extended (T02) with exactly two additions, fixed here so the checklist is concrete:

- **One deeper level.** `architecture/validator.md`: `id: Validator`, `parent: OrderService`, flowchart `SchemaCheck --> StockCheck`. Hierarchy: `system` → `OrderService` → `Validator`.
- **One parallel-edge case.** `system.md` gains a second `OrderService -->|capture| PaymentGateway` edge next to the existing one; `scenarios/checkout.md` gains `OrderService->>PaymentGateway: capture()` and `PaymentGateway-->>OrderService: ok` after the first `ok`. Resulting scenario steps (6): API→OrderService, OrderService→PaymentGateway (`charge()`), PaymentGateway→OrderService (return), OrderService→PaymentGateway (`capture()`), PaymentGateway→OrderService (return), OrderService→OrdersDB.

No other toy change. Frontmatter keys stay within `id`, `parent`, `src`, `kind`.

### Observable contract

The viewer exposes these hooks (a throwaway page, but the spec needs stable selectors):

| Hook | Meaning |
| --- | --- |
| `[data-dyd-node="<ID>"]` | The rendered SVG element of element `<ID>` in the current flowchart |
| `[data-dyd-active]` | Present on the node(s), edge(s) or message currently highlighted by the trace |
| `[data-dyd-breadcrumb] [data-dyd-crumb="<doc id>"]` | One crumb per ancestor/current doc, in order |
| `[data-dyd-back]` | Back button |
| `[data-dyd-panel]` with `[data-dyd-field="<name>"]` | Info panel and its fields: `parent`, `children`, `appearsIn`, `scenarios`, `src` |
| `[data-dyd-scenario-picker]`, `[data-dyd-step]`, `[data-dyd-next]`, `[data-dyd-prev]`, `[data-dyd-play]`, `[data-dyd-pause]` | Trace controls; `[data-dyd-step]` holds the current step number (0 = not started) |
| `[data-dyd-through="<ID>"]` | "Scenario passes through `<ID>`" indicator in a child diagram |

The play interval is overridable with `?interval=<ms>` so the spec is not timing-fragile.

### Gated checklist

All items are binary, are verified headlessly (Playwright, Chromium) against the viewer served locally with `index.json` produced by `dyd index`, and are expected values taken from `index.json`, not hard-coded guesses.

| # | Item | Pass when |
| --- | --- | --- |
| C1 | Render + ID mapping | The `system` flowchart renders; every `diagrams[].nodes` ID has exactly one `data-dyd-node` element; no render error is shown |
| C2 | Deep dive | Clicking `OrderService` in `system` shows its diagram (nodes `Controller`, `Validator`, `Repository`); clicking `Validator` there shows the `Validator` diagram (`SchemaCheck`, `StockCheck`) (three levels). Clicking `API` (no child doc) does not navigate |
| C3 | Breadcrumb and back | At `Validator` the breadcrumb reads `system › OrderService › Validator`; clicking the `OrderService` crumb returns to that diagram; Back returns to the previously shown diagram |
| C4 | Info panel, documented element | Selecting `OrderService` shows `parent` = `system`, `children` = `Controller, Validator, Repository`, `appearsIn` = the `index.json` list, `scenarios` = `checkout-happy-path`, `src` = `src/orders/` |
| C5 | Info panel, undocumented element | Selecting `PaymentGateway` shows `appearsIn` and `scenarios`; no `parent`/`children`/`src` fields rendered; no error |
| C6 | Trace on the flowchart | The picker lists `checkout-happy-path`. Next ×6 highlights, per step, the nodes `from`/`to` from `index.json`; return steps highlight the same pair as the forward step; Prev steps back; after step 6 Next is disabled or a no-op |
| C7 | Play / pause | With `?interval=200`, Play raises `[data-dyd-step]` by ≥ 2 within 2 s; after Pause the value is unchanged for 600 ms |
| C8 | Trace across diagrams | With the trace active, in the `OrderService` and `Validator` diagrams `[data-dyd-through="OrderService"]` is present exactly on steps where `OrderService` is a `from` or `to`, and absent otherwise; the step number is preserved when navigating between diagrams |
| C9 | Trace on the sequence diagram | Viewing the `checkout-happy-path` sequence diagram, at each step 1–6 exactly one message is `data-dyd-active` and its text equals that step's `label` |
| C10 | Zero extra syntax | Every toy `.md` consists only of YAML frontmatter and ` ```mermaid ` fences, with frontmatter keys ⊆ {`id`, `parent`, `src`, `kind`}; the viewer needs nothing else |

C1–C5 and C10 bear on **A2**; C6–C9 bear on **A3**.

### Recorded, not gated

- **A3 parallel edges.** For steps 2 (`charge()`) and 4 (`capture()`), which `L_OrderService_PaymentGateway_<n>` edge the viewer highlights, and whether it is the correct one. Result is reported as *correct* or *ambiguous (documented)*; it does not affect the verdict.
- **Sequence-SVG mapping reliability.** How messages are mapped (DOM order, text match), and any case where Mermaid's output made the mapping unreliable (return arrows, duplicate labels, notes/loops). Reported as observations.
- Any mismatch between index IDs and rendered SVG IDs not covered above.

### Qualitative question (owner, T12)

*"Does clicking `OrderService` and selecting `checkout-happy-path` feel like understanding the system?"* Yes / No, with a one-line reason.

### Pass rule

**Pass** iff every gated item C1–C10 passes **and** the owner answers *yes*. **Fail** otherwise. A single run; no retry of a failed item.

### On fail

Record the failure and lower the confidence of the affected assumption(s) in brief §8 (A2 for C1–C5/C10, A3 for C6–C9). Apply the brief's "If wrong": A2 → add a frontmatter key, not syntax; A3 → message IDs (deferred item). **No re-gate, no checklist change.** A new attempt requires a new pre-registration.

### Out of scope

Click-to-context / click-to-source, `<dyd-diagram>` packaging, live reload, A5 sub-step expansion (scenarios stay at participant level; inside a child diagram the viewer only says the scenario passes through the parent), SSG wrappers (A7), MCP, dogfood (A6).

### Invariants

- Toy docs stay pure Mermaid + frontmatter and render on GitHub.
- Existing CLI commands and tests keep passing; `index.json` may be extended, never broken.
- This section is not edited after the verification run.

## Amendments

- 2026-11-15, during T07, before the verification run: **C5 clarified.** The text "no `parent`/`children`/`src` fields rendered" for `PaymentGateway` contradicts `index.json`, where undocumented elements get `parent` from diagram membership (`PaymentGateway.parent = system`). The viewer renders a field iff its `index.json` value is non-empty. C5 therefore passes when `PaymentGateway` shows `parent` = `system`, `appearsIn` and `scenarios` from `index.json`, **no `children` and no `src` field**, and no error. Info-panel values are exposed in `[data-dyd-field="<name>"] [data-dyd-value]` (comma-joined).
- 2026-11-15, during T09, before the verification run: contract additions needed by the spec, no checklist change. `[data-dyd-show-sequence]` opens the selected scenario's sequence diagram. In the sequence diagram each message's text and line carry `data-dyd-message="<n>"` (1-based); C9's "exactly one message is `data-dyd-active`" means all active elements share one `data-dyd-message` value.

## Results

### Verification run (2026-11-15, T11)

`npm --prefix spike run viewer:build && npx playwright test` (Playwright 1.65.1, Chromium headless, Mermaid 12.3.0, spec `spike/e2e/viewer.pw.ts` SHA-256 `724905e6…`), against `spike/toy/index.json` as produced by `dyd index`. The spec was run once informally at the end of T10 with identical results and no change to the spec or viewer between that run and this one; the verification run is the second execution, not a retry after a fix.

| # | Item | Result |
| --- | --- | --- |
| C1 | Render + ID mapping | pass |
| C2 | Deep dive (3 levels, no-op on `API`) | pass |
| C3 | Breadcrumb + back | pass |
| C4 | Info panel, documented element | pass |
| C5 | Info panel, undocumented element (as clarified in Amendments) | pass |
| C6 | Trace on the flowchart, 6 steps | pass |
| C7 | Play / pause | pass |
| C8 | Trace across diagrams ("passes through parent") | pass |
| C9 | Trace on the sequence diagram | pass |
| C10 | Zero extra syntax | pass |

**Automated gate: 10/10.** Verdict still needs the owner's qualitative answer (T12).

### Recorded, not gated

- **A3 parallel edges: correct on the toy, by heuristic.** `charge()` highlighted `OrderService>PaymentGateway#0` (`L_…_0`) and its return the same edge; `capture()` highlighted `#1` (`L_…_2`, the edge labelled `capture`) and its return the same edge. The mapping is positional: the k-th forward message of an ordered pair maps to the k-th edge of that pair in the diagram. It is right here only because the flowchart declares the edges in the same order as the scenario sends the messages; the index carries no edge labels or message IDs to verify that, so an author who reverses the order gets a silently wrong highlight. Message IDs (deferred item) remain the fix if this matters; this spike does not show that they are needed for the toy, and does not show the heuristic is safe in general.
- **Sequence-SVG mapping: reliable on the toy.** DOM-order mapping with a guard (counts and labels must agree) worked for all 6 steps, including two identical `ok` returns. Not exercised: self-messages, `alt`/`loop` blocks, notes, activations, `autonumber`, participant aliases.
- **Return messages** have no flowchart edge of their own; they reuse the forward edge, so the highlight cannot show direction.
- **Link-numbering surprise:** see build-time observations (`_0`, `_2`). Any viewer that assumes `_0,_1` would highlight nothing for the second parallel edge.
- **Scale/perf:** the bundle is large (Mermaid + all diagram chunks, `elk` 3.3 MB) because esbuild splits every Mermaid diagram type; irrelevant for the spike, relevant for packaging (`<dyd-diagram>`).
- **Not tested:** scenarios touching a diagram where a participant is drawn only in a deeper diagram (no sub-step expansion, A5 deferred), diagrams with subgraphs, clicking elements in the sequence diagram.

### Owner walkthrough (T12, 2026-11-15)

*"Does clicking `OrderService` and selecting `checkout-happy-path` feel like understanding the system?"* **Yes** — owner reason: "Good". The first attempt hit a `Failed to fetch` render error: the throwaway dev server crashed on a 404 (`/favicon.ico`, headers written before the file read). Fixed in `spike/scripts/serve-viewer.mjs`; the walkthrough was then redone and this answer is from the second attempt. The reason is one word, so it supports only a weak reading: it says nothing about which of deep dive, trace or info panel carried the feeling.

## Verdict

**Pass** under the pre-registered rule: C1–C10 all pass and the owner answered yes. **A2** supported on the toy (deep dive via `id`/`parent` frontmatter, three levels, no grammar change; undocumented elements get a parent from diagram membership, per the earlier spike). **A3** supported on the toy for participant-based trace with the recorded caveats: parallel edges rely on authoring-order alignment, and returns reuse the forward edge. Limits: one toy of 4 docs, one author, one owner, one browser, a gate written by the same person who built the viewer, and a dev run of the spec before the verification run (identical result, no changes between).

### Build-time observations (before the verification run)

- **Sequence SVG mapping.** Mermaid 12.3 gives messages no ids. Each message is a `text.messageText` followed by a `line.messageLine0` (solid) or `messageLine1` (dashed/return), all in source order (self-messages would be `path`, not exercised). The viewer maps by DOM order and refuses to annotate (shows an error) unless text count, line count and index message count agree and each text equals the step label. Duplicate labels (`ok` twice) are fine because mapping is positional, not by text.

- Mermaid resolved to **12.3.0** (the plan assumed 11). Flowchart SVG ids are `<renderId>-flowchart-<ID>-<n>` (nodes) and `<renderId>-L_<A>_<B>_<n>` (links), as in the earlier spike.
- **Parallel-edge link numbering is not `0,1`.** The two `OrderService → PaymentGateway` links rendered as `L_OrderService_PaymentGateway_0` and `..._2`. The viewer therefore maps the k-th index occurrence of a pair to the k-th link of that pair sorted by numeric suffix.
