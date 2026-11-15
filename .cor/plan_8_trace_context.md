# COR Plan — Trace + click-to-context spike: `<dyd-diagram>` in Docusaurus and MkDocs

## Context

Bring the viewer's scenario trace (picker, play, pause, step) and a "Copy context" action into `<dyd-diagram>`, and prove both in the A7 SSG harness on the 4-doc toy. This closes the owner's A7 remark ("works, but no play/pause") and brief §6.1 click-to-context. Throwaway spike quality, in `spike/`. Evidence: `.cor/research_trace_context.md`.

### Current state

- `spike/viewer/element.ts:126` `onClick` fills the panel, then navigates at once (`dyd-navigate` → `location.assign`). A node with a child doc never leaves its panel reachable.
- `spike/viewer/element.ts:105` annotates flowcharts only. There is no sequence annotation and no trace in the element.
- The trace logic lives in the viewer, tied to module-level DOM:
  - `spike/viewer/main.ts:52` `annotateSequence` maps messages by DOM order of `text.messageText` / `[class^=messageLine]` (still emitted by mermaid 12.3.0)
  - `:128` `edgeOccurrence` is the A3 positional heuristic
  - `:136` `applyTrace` builds the "passes through" notice
- `spike/src/context.ts:18` `buildContext` reads the doc body via `loadDocs` (node:fs + gray-matter), and `index.json` has no doc body, so a browser can't rebuild the bundle.
- `spike/src/context.ts:48` `renderContextMarkdown` is pure and ends with `"\n"`. CLI stdout adds one more `"\n"` (`console.log`).
- The adapters already write data into `<site>/dyd/`: `spike/ssg/docusaurus/dyd-theme/index.js` (`postBuild`) and `spike/ssg/mkdocs/hooks.py` (`on_post_build`).
- `spike/e2e/ssg.pw.ts:77-118`: S3 deep-dives by clicking nodes; S4/S5 cancel `dyd-navigate` to inspect the panel.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Nature | Spike with a pre-registered gate | Same discipline as A1/A4/A7 |
| Targets | Both SSGs on the toy, A7 harness (static builds under `/dyd/`) | Parity with what A7 validated |
| Pages | One fence per page | Multi-fence identity untested; out of scope |
| Trace UI | Inside each element's shadow root, shown only when a scenario touches the diagram | Self-contained element; no adapter logic |
| "Touches" | A step's `from`/`to` is in `diagram.nodes`, **or** is the diagram's doc owner or one of its ancestors | Otherwise the bar hides on the child page where the carried-over state must show |
| Diagram types | Flowchart **and** sequence (checkout page) | Parity with the viewer |
| Trace across deep dive | Scenario + step carried in the child URL query (`dyd-scenario`, `dyd-step`); restored paused; invalid values clamped or ignored, never thrown; step changes don't rewrite the URL | Visible, shareable, testable. `sessionStorage` is invisible and tab-scoped (research) |
| Child page display | "Scenario passes through *parent*" notice only, no sub-step highlight | A5 deferred |
| Click | Node click = select + panel. Deep dive = "Open" `<a href>` link in the panel, still firing the cancelable, composed `dyd-navigate` (`detail: { url, id }`) | Keeps "Copy context" reachable; keyboard-operable (WCAG 2.1.1); `dblclick` fires two clicks first |
| Context payload | Markdown byte-identical to `renderContextMarkdown(...)`, i.e. `dyd context <id>` stdout minus the final newline | One renderer, no drift |
| Context source | `dyd context --all` prints `{ id: markdown }`; adapters write it to `<site>/dyd/contexts.json` | Byte-identical by construction; no product logic or corpus write in adapters |
| Clipboard | Prefetch `contexts.json` with `index.json`; call `writeText` synchronously in the button's click handler; show the result (including `NotAllowedError`) in the panel | A write needs transient activation (a few seconds), and an `await fetch` first can lose it |
| Clipboard check | `grantPermissions(['clipboard-read','clipboard-write'])` + `readText()`. Fallback, only if that fails in Chromium (Playwright 1.65.1): an `addInitScript` spy, recorded as a dated amendment | Playwright warns permission support may change |
| Viewer | `main.ts` untouched; new helpers go in `shared.ts` | Keeps the validated viewer and its suite stable |
| A7 suite | Amend S3 to the new gesture with a dated amendment; the whole suite must still pass | Frozen checklist discipline |
| Gate | Playwright checklist on both SSGs + owner walkthrough yes/no | Same as A7 |

### Scope

**In scope:**
- Trace and copy-context in `<dyd-diagram>`
- Sequence annotation in the element
- CLI `context --all`
- Adapters writing `contexts.json`
- A7 S3 amendment
- New Playwright spec and findings doc
- Brief updates

**Out of scope:**
- Multi-fence pages, dark-mode re-render, Docusaurus client-side route changes, Material `navigation.instant`
- Hierarchical sub-steps (A5)
- A deep-link copy action, JSON copy
- Bundle size and the two Mermaid copies
- Message IDs (A3 stays positional)
- Changes to the standalone viewer
- Packaging/publishing the element
- MCP

### Invariants

- Toy docs stay pure Mermaid + YAML and render on GitHub.
- Removing an adapter falls back to native Mermaid with no error.
- `spike/e2e/viewer.pw.ts` and the A7 suite (as amended) pass. Existing CLI commands and tests pass (`.cor/config.md` checks).
- `index.json` may be extended, never broken. `dyd context <id>` output is unchanged.
- The pre-registration is not edited after the verification run (dated amendments only, before the run).

### Acceptance criteria

- Checklist frozen in `docs/trace-context-findings.md` before the run. Items per SSG:
  - trace bar on the `system` flowchart: step, prev, play, pause highlight the right nodes/edges
  - sequence messages highlighted on the checkout page
  - node click doesn't navigate
  - the "Open" link deep-dives, fires `dyd-navigate`, and carries scenario + step; the child page restores them and shows the "passes through" notice
  - invalid query state doesn't throw
  - "Copy context" matches the CLI reference for `OrderService` (documented) and `PaymentGateway` (undocumented)
  - the adapter-removed build still renders
- A Playwright spec implements the checklist one-to-one. The A7 suite (amended S3) and the viewer suite stay green.
- Verdict = pass iff all items pass on both SSGs **and** the owner answers yes. On fail: record it, no re-gate.
- Findings recorded either way. Brief §6.1/§8/§9/§10 updated. Config checks green.

## Tasks

- [x] T01: Write the pre-registration in `docs/trace-context-findings.md` (frozen checklist per SSG, pass/on-fail rules, recorded-not-gated items). Add a dated S3 amendment entry to `docs/ssg-findings.md` (deep dive via the "Open" link)
- [x] T02: Add `dyd context --all` to `spike/src/cli.ts`: a JSON map `{ id: renderContextMarkdown(buildContext(...)) }` on stdout, same model inputs as `context <id>`
- [x] T03: Unit test that every `context --all` entry equals the single-element render [unit]
- [x] T04: Make both adapters write `contexts.json` to `<site>/dyd/` from `dyd context --all` stdout (Docusaurus `postBuild`, MkDocs `on_post_build`): data only, no write into the docs folder
- [x] T05: Add to `spike/viewer/shared.ts`: parametrised `annotateSequence` (error via return or callback), `edgeOccurrence`, trace application ("passes through" notice included), and the "touches diagram" rule. `main.ts` untouched
- [x] T06: Unit tests for `edgeOccurrence` and the "touches diagram" rule [unit]
- [x] T07: Element click split: a node click only selects and fills the panel. An "Open" `<a href>` in the panel deep-dives, with `dyd-scenario`/`dyd-step` added when a trace is active. It fires the cancelable, composed `dyd-navigate` and calls `preventDefault()` on the anchor if the event is cancelled
- [x] T08: Element trace: sequence annotation, plus a trace bar in the shadow root (scenario picker, prev/next/play/pause, step number + label, "passes through" notice), shown only when a scenario touches the diagram. Restore state from the query, paused, clamping or ignoring invalid values. Step changes don't rewrite the URL
- [x] T09: Element "Copy context" button in the panel: prefetch `contexts.json` alongside `index.json`; call `navigator.clipboard.writeText` synchronously in the click handler; show the status in the panel (`data-dyd-copy-status`, including `NotAllowedError`)
- [x] T10: Amend the A7 spec `spike/e2e/ssg.pw.ts`: S3 uses the "Open" link; drop the S4/S5 `dyd-navigate` cancel if a node click no longer navigates [integration]
- [x] T11: Add a Playwright spec implementing the T01 checklist one-to-one on both SSG builds and both adapter-removed builds. Check the clipboard via `grantPermissions` + `readText`, compared to the CLI reference (stdout minus the final newline) [integration]
- [x] T12: Verification run once: `npm --prefix spike run ssg:build`, `e2e:ssg` (A7 + new spec), viewer `e2e`, then the config checks. Record results and findings in `docs/trace-context-findings.md`
- [x] T13: Owner walkthrough of both sites: "do trace and copy-context feel the same as in the standalone viewer, and is the pasted bundle useful to an agent?" yes/no [UAT]
- [x] T14: Update the brief: §6.1 (element status), §8 (A3 note, A6 readiness), §9 integration line, §10 step 5 status
