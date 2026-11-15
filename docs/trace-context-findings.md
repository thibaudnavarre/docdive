# Trace + click-to-context spike — `<dyd-diagram>` in Docusaurus and MkDocs

Brings the standalone viewer's scenario trace (picker, prev/next, play/pause, step) and a "Copy context" action into `<dyd-diagram>`, and checks both in the A7 SSG harness on the 4-doc toy. Closes the owner's A7 remark ("works, but no play/pause") and brief §6.1 click-to-context. This document **pre-registers** the checklist, then records the results. Evidence base: `.cor/research_trace_context.md`. Harness: [ssg-findings.md](./ssg-findings.md).

## Pre-registration (2026-11-15)

Written and frozen **before the verification run** (T12). Results are reported against this section, not by editing it. Any later change is a dated entry in *Amendments*, never an in-place edit.

### Question

Can `<dyd-diagram>`, inside the built Docusaurus and MkDocs sites, (1) play a scenario trace on flowchart and sequence diagrams, (2) keep scenario + step across a deep dive, and (3) copy to the clipboard a context bundle byte-identical to `dyd context <id>`, without product logic in the adapters?

### Setup under test

| Subject | Fixed value |
| --- | --- |
| Corpus | The 4-doc toy `spike/toy`, unchanged. One fence per page. Scenario `checkout-happy-path`, 6 steps (see [viewer-findings.md](./viewer-findings.md)) |
| SSGs and builds | Same as A7: Docusaurus 3.10.2 and MkDocs 1.6.1 + Material 9.8.1, static builds served under `/dyd/`, plus both adapter-removed builds |
| Browser | Chromium via Playwright 1.65.1, headless |
| Context source | `dyd context --all` prints a JSON map `{ id: markdown }`; each adapter writes it to `<site>/dyd/contexts.json` next to `index.json` |
| Context reference | For element `<ID>`: stdout of `dyd context <ID>` run on the toy, **minus the final newline** added by `console.log` (i.e. `renderContextMarkdown(buildContext(...))` exactly) |
| Clipboard check | Context granted `clipboard-read` + `clipboard-write`; after the click, `navigator.clipboard.readText()` in the page |
| Trace state in URL | Child URL query `dyd-scenario=<scenario id>` and `dyd-step=<n>`; restored paused; trace step changes do not rewrite the current URL |
| Play interval | Overridable with `?dyd-interval=<ms>` so the spec is not timing-fragile |

### Observable contract

Everything lives in the element's open shadow root (Playwright CSS locators pierce it). The A7 hooks (`dyd-diagram`, `[data-dyd-node]`, `[data-dyd-panel]`, `[data-dyd-field]`, `[data-dyd-error]`) are unchanged. New hooks, aligned with the viewer's:

| Hook | Meaning |
| --- | --- |
| `[data-dyd-trace]` | Trace bar; present only when a scenario touches the diagram (a step's `from`/`to` is in the diagram's `nodes`, or is the diagram's doc owner or one of its ancestors) |
| `[data-dyd-scenario-picker]`, `[data-dyd-prev]`, `[data-dyd-next]`, `[data-dyd-play]`, `[data-dyd-pause]` | Trace controls |
| `[data-dyd-step]` | Current step number (0 = not started); `[data-dyd-step-label]` its label |
| `[data-dyd-active]` | On the node(s), edge(s) or message highlighted by the trace |
| `[data-dyd-message="<n>"]` | Message text and line of sequence step `<n>` (DOM order, as in the viewer) |
| `[data-dyd-through="<ID>"]` | "Scenario passes through `<ID>`" notice |
| `[data-dyd-open]` | "Open" `<a href>` in the panel, present only when the selected element has a child doc |
| `[data-dyd-copy]` | "Copy context" button in the panel |
| `[data-dyd-copy-status]` | Copy result: `ok`, or the error name (e.g. `NotAllowedError`) |

Event: the "Open" link dispatches the cancelable, composed `dyd-navigate` on the host (`detail: { url, id }`, `url` including the trace query when a trace is active). If the event is cancelled, the anchor's default is prevented.

### Gated checklist

Binary items, evaluated **per SSG** (D = Docusaurus, M = MkDocs). Expected values come from `index.json`, the built site's doc→URL map and the CLI reference, not hard-coded guesses.

| # | Item | Pass when |
| --- | --- | --- |
| T1 | Trace bar on the flowchart | On `system`, `[data-dyd-trace]` is shown and the picker lists `checkout-happy-path`. Next ×6: at each step the `from` and `to` nodes are `data-dyd-active` (return steps highlight the same pair as the forward step) and `[data-dyd-step]` equals the step; Prev steps back by one; after step 6 Next is disabled or a no-op. The page URL is unchanged by stepping |
| T2 | Play / pause | With `?dyd-interval=200`, Play raises `[data-dyd-step]` by ≥ 2 within 2 s; after Pause the value is unchanged for 600 ms |
| T3 | Sequence trace | On the `checkout-happy-path` page, at each step 1–6 exactly one message text is `data-dyd-active` and its text equals that step's `label` |
| T4 | Node click doesn't navigate | Clicking `OrderService` on `system` leaves the URL unchanged, fills the panel (`parent` = `system`) and shows `[data-dyd-open]`; clicking `API` shows the panel without `[data-dyd-open]`. No `dyd-navigate` fires on either click |
| T5 | Deep dive with trace | On `system` at step 2, clicking the `OrderService` "Open" link fires `dyd-navigate` with `detail.id` = `OrderService` and `detail.url` = the mapped URL carrying `dyd-scenario=checkout-happy-path` and `dyd-step=2`. The `order-service` page shows the trace bar with the scenario selected, `[data-dyd-step]` = 2, paused (unchanged for 600 ms), and `[data-dyd-through="OrderService"]`. From there, opening `Validator` lands on `validator` with the same scenario and step and `[data-dyd-through="OrderService"]`. Without a trace, the "Open" URL has no `dyd-` query |
| T6 | Invalid query state | Each of `?dyd-scenario=nope&dyd-step=3`, `?dyd-scenario=checkout-happy-path&dyd-step=99`, `?dyd-scenario=checkout-happy-path&dyd-step=abc` on `system` renders without `data-dyd-error` and without an uncaught page error. Unknown scenario → step 0; step 99 → clamped to 6; non-numeric step → 0 |
| T7 | Copy context, documented | Selecting `OrderService` on `system` and clicking "Copy context": `[data-dyd-copy-status]` = `ok` and the clipboard text equals the CLI reference for `OrderService` |
| T8 | Copy context, undocumented | Same for `PaymentGateway` |
| T9 | Deletability | The adapter-removed build renders as in A7 S6 (as amended), with no `dyd-diagram` and no uncaught page error |

T1–T9 apply to both SSGs: 18 items. Plus, once:

| # | Item | Pass when |
| --- | --- | --- |
| R1 | A7 suite | `spike/e2e/ssg.pw.ts` passes in full, with S3 as amended in [ssg-findings.md](./ssg-findings.md) |
| R2 | Viewer suite | `spike/e2e/viewer.pw.ts` passes in full, with `spike/viewer/main.ts` unchanged |

Total 20 gated items.

### Recorded, not gated

- **Visibility rule not exercised.** Every toy diagram is touched by `checkout-happy-path` (directly or through `OrderService`/`system` as ancestor), so the "hidden when not touched" branch has no toy case. Reported, not tested.
- **A3 parallel edges.** Which `OrderService → PaymentGateway` edge steps 2 and 4 highlight in the element (same positional heuristic as the viewer).
- **Clipboard mechanism.** Whether `grantPermissions` + `readText()` worked headless in Chromium. If not, the fallback (an `addInitScript` spy on `writeText`) is recorded as a dated amendment before the run.
- **`NotAllowedError` path.** Shown in the panel by design; not provoked in the gate.
- **`contexts.json` size** for the toy, and the growth model (N elements × doc body).
- **Element size.** Lines added to `element.ts` and `shared.ts`; adapter lines added (must stay data-only, constraint 6).
- **Docusaurus client-side routing.** The "Open" link is a plain `<a href>`; whether Docusaurus intercepts it is observed, not gated.
- Any keyboard-operability observation on the "Open" link and the trace controls.

### Qualitative question (owner, T13)

*"Do trace and copy-context feel the same as in the standalone viewer, and is the pasted bundle useful to an agent?"* Yes / No, with a one-line reason.

### Pass rule

**Pass** iff all 20 gated items pass (T1–T9 on both SSGs, R1, R2) **and** the owner answers *yes*. **Fail** otherwise. A single verification run; no retry of a failed item.

### On fail

Record the failure and lower the confidence of the related claim in brief §6.1 / §8 (trace in SSGs, click-to-context). **No re-gate, no checklist change.** A new attempt requires a new pre-registration.

### Out of scope

Multi-fence pages, dark-mode re-render, Docusaurus client-side route changes, Material `navigation.instant`, hierarchical sub-steps (A5), deep-link copy, JSON copy, bundle size and the two Mermaid copies, message IDs (A3 stays positional), changes to the standalone viewer, packaging/publishing the element, MCP.

### Invariants

- Toy docs stay pure Mermaid + YAML frontmatter and render on GitHub.
- Removing an adapter falls back to native Mermaid with no error.
- `index.json` may be extended, never broken. `dyd context <id>` output is unchanged.
- Existing CLI commands and tests keep passing (`.cor/config.md` checks).

## Amendments

_None yet._

## Results

Verification run 2026-11-15: clean rebuild of all four sites (`npm --prefix spike run ssg:build`, exit 0), then one run of `npm --prefix spike run e2e:ssg` (31 tests: 13 A7 + 18 trace-context, Chromium), then `npm --prefix spike run e2e` (viewer, 10 tests), then the `.cor/config.md` checks (typecheck, lint, vitest 47 tests, ruff): all green. The new spec had been dry-run once during T11 on builds patched with the new element bundle (all green); the recorded run is the clean rebuild.

| # | Item | Docusaurus 3.10.2 | MkDocs 1.6.1 + Material 9.8.1 |
| --- | --- | --- | --- |
| T1 | Trace bar on the flowchart | pass | pass |
| T2 | Play / pause | pass | pass |
| T3 | Sequence trace | pass | pass |
| T4 | Node click doesn't navigate | pass | pass |
| T5 | Deep dive with trace | pass | pass |
| T6 | Invalid query state | pass | pass |
| T7 | Copy context, documented (`OrderService`) | pass | pass |
| T8 | Copy context, undocumented (`PaymentGateway`) | pass | pass |
| T9 | Deletability | pass | pass |

| # | Item | Result |
| --- | --- | --- |
| R1 | A7 suite (S3 amended) | pass (13/13) |
| R2 | Viewer suite, `main.ts` unchanged | pass (10/10) |

**Automated gate: 20/20.**

**Owner (T13): yes.** Reason, verbatim: "Seems ok". The answer field was free text ("Seems ok") rather than a yes/no, and it is recorded here as a yes.

**Verdict: PASS** (all 20 gated items pass and the owner answered yes).

### Findings (recorded, not gated)

- **Clipboard mechanism.** `grantPermissions(['clipboard-read','clipboard-write'])` + `navigator.clipboard.readText()` worked headless in Playwright 1.65.1 Chromium on both sites. The `addInitScript` spy fallback was not needed; no amendment.
- **Byte identity by construction.** The copied text equals `dyd context <id>` stdout minus its final newline for both elements, because `contexts.json` values are `renderContextMarkdown(buildContext(...))` (`renderAllContexts` in `spike/src/context.ts`), the same call as `dyd context <id>`.
- **A3 parallel edges: correct.** On `system`, step 2 (`charge()`) highlights `L_OrderService_PaymentGateway_0` and step 4 (`capture()`) highlights `L_OrderService_PaymentGateway_2` (the `|capture|` edge); returns 3 and 5 reuse those edges. Same result as the standalone viewer, on both SSGs.
- **Visibility rule not exercised.** As expected, every toy diagram is touched by `checkout-happy-path`, so the "hidden" branch has no toy case. It is covered only by the unit test (`spike/viewer/shared.test.ts`).
- **`NotAllowedError` path** not provoked. The handler also catches the synchronous `TypeError` thrown when `navigator.clipboard` is undefined (non-secure context) and shows its name in `[data-dyd-copy-status]`.
- **`contexts.json` size.** 3,894 bytes for the toy's 10 elements. Grows as N elements × (metadata + doc body); a documented element repeats its doc body once.
- **Element and adapter size.** `element.ts` 142 → 310 lines, `shared.ts` 67 → 149 lines (trace helpers; `main.ts` keeps its own copy, untouched). Adapters: Docusaurus +2 lines, MkDocs +7 lines, both piping `dyd context --all` stdout to `<site>/dyd/contexts.json`. No product logic in the adapters, and no write into the docs folder beyond the existing `index.json` side effect.
- **Docusaurus routing.** The "Open" link is a plain `<a href>` inside the shadow root: Docusaurus's router does not intercept it, so the deep dive is a full page load on both SSGs (checked: a `window` marker set before the click is gone after it).
- **Keyboard.** Focusing the "Open" link and pressing Enter deep-dives on both sites. Trace controls are native `<select>` and `<button>` elements.
- **Query state.** The element matches its page by path only, so the `dyd-scenario` / `dyd-step` query does not disturb doc identity. An unknown scenario falls back to the first touching scenario at step 0; the play interval is read from `dyd-interval` (default 1000 ms).
- **Build output.** Only the known A7 warnings (webpack "critical dependency", missing home page broken link, Node `localStorage` experimental warning).
