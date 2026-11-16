# COR Plan — Breadcrumb

## Context

Add a breadcrumb to `<docdive-diagram>`: `system › OrderService › Validator`, from the root ancestor down to the element that owns the current page. It is the last element feature product brief §6.1 lists as "Not yet built" (breadcrumb/back). Back stays with the browser.

### Current state

- Deep dive is page navigation: the panel's "Open X" link (`packages/docdive-element/src/element.ts:404` `openUrl`) points to the child doc's URL from `docdive-map.json` and appends `docdive-scenario`/`docdive-step` when a trace is active. It dispatches a cancelable, composed `docdive-navigate` event (`element.ts:~385`) so an SSG can route in-app.
- `ownerChain(index, diagramId)` (`packages/docdive-element/src/shared.ts:99`) already walks owner → parents (nearest first, cycle-guarded), but takes the *first* owner. The trace (`touchesDiagram`) depends on it; leave its behavior unchanged.
- `ElementEntry` has `doc` and `parent` (`shared.ts:9`); the page doc comes from `identity()` (`element.ts:243`).
- Shadow root order: style, errorHost, host (SVG), panel; the trace bar and through-host are inserted before `errorHost` (`element.ts:272`).
- Toy fixture (both example sites build from `fixtures/toy`): `system` (no parent) → `OrderService` (`parent: system`) → `Validator` (`parent: OrderService`). No fixture change needed.
- SSG e2e suites are listed in `playwright.ssg.config.ts:13` `testMatch`; pattern to copy: `e2e/click-to-source.pw.ts`.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Parts | Breadcrumb only, no in-element Back | Browser back already works across SSG pages |
| Placement | Above the diagram, before the trace bar | Navigation context reads first |
| Markup | `<nav aria-label="Breadcrumb">` + `<ol>`, hooks `data-docdive-breadcrumb`, `data-docdive-crumb="<id>"` | Accessible landmark + stable test hooks |
| Label | Element ID | Same as the panel title |
| Last crumb | Page's own element, plain text, `aria-current="page"` | Standard breadcrumb pattern |
| Ancestor without doc or mapped URL | Plain text crumb | Keep the chain truthful without a dead link |
| No owner, several owners, or owner without parent | Render nothing | Ambiguous/flat (brownfield, D11) must not show a wrong or one-item trail |
| Parent cycle | Stop at the first repeated ID, render the chain so far | Hand-written frontmatter may loop; never hang |
| Active trace | Crumb links carry `docdive-scenario` + `docdive-step`, like "Open" | Trace survives navigating up, as it does down |
| Multi-fence pages | Every diagram shows the same breadcrumb | Each element is self-contained |
| Crumb click | Dispatch `docdive-navigate` like "Open" | Same in-app routing hook for SSGs |

### Scope

**In scope:** element code (`shared.ts`, `element.ts`), unit + SSG e2e tests, docs/brief updates.
**Out of scope:** in-element Back button, indexer/CLI or `index.json` changes, SSG adapter changes (§7.6 no product logic in plugins), flowchart labels as crumb text, a test-only fixture for the hiding cases (unit tests cover them).

### Invariants

- `ownerChain` and trace behavior unchanged; `openUrl` output unchanged.
- No breadcrumb DOM on pages where it should be hidden (existing e2e suites stay green).
- Element still degrades to plain Mermaid without `index.json`.

### Acceptance criteria

- Unit tests (`shared.test.ts`): chain root-first, cycle, no owner, several owners, top-level owner → empty, `withTrace`.
- `e2e/breadcrumb.pw.ts` on Docusaurus and MkDocs: Validator page shows `system › OrderService › Validator` with the last crumb `aria-current="page"`; clicking `OrderService` with an active trace lands on that page with scenario + step kept; `system` page has no breadcrumb.
- All configured checks green; existing e2e suites green.
- `docs/architecture/docdive-element.md` and brief §6.1/§10 updated.
- Owner walkthrough yes.

## Tasks

- [x] T01: Add pure `breadcrumb(index, doc)` to `shared.ts`: exactly one element with `doc === doc` else `[]`; walk `parent` root-first, stop at first repeated ID; `[]` when the owner has no ancestor
- [x] T02: Extract trace carry from `openUrl` into shared `withTrace(url, scenario, step)` and use it in `openUrl` (no behavior change)
- [x] T03: Render the breadcrumb in `<docdive-diagram>` above the trace bar: `nav`/`ol`, `data-docdive-crumb` per crumb, links (via `withTrace` + `docdive-navigate`) for ancestors with a mapped URL, plain text otherwise, last crumb `aria-current="page"`; refresh hrefs on trace step change; nothing when the chain is empty
- [x] T04: Unit tests for `breadcrumb` and `withTrace` in `shared.test.ts` [unit]
- [ ] T05: Add `e2e/breadcrumb.pw.ts` (Docusaurus + MkDocs) and register it in `playwright.ssg.config.ts` [integration]
- [ ] T06: Update `docs/architecture/docdive-element.md` (hooks, behavior), the element README if it lists hooks, and product brief §6.1 status + §10 item 5
- [ ] T07: Owner walkthrough of the breadcrumb on both example sites [UAT]
