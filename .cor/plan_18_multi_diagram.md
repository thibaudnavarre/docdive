# COR Plan — Multi-diagram pages

## Context

Make `<docdive-diagram>` correct on pages with several Mermaid fences (Docusaurus and MkDocs). URL state (selection, scenario/step) must apply only to the diagram it came from, and each diagram should trace on its own. This is one of the two element features product brief §10 item 5 still lists as missing; click-to-source is the other and is deferred.

### Root cause / current state

A browser probe used a temporary 2-fence page with the shared node `OrderService` on both SSGs (the page has since been removed):

- Rendering and ID mapping already work. Each element resolves `doc#n` from its DOM position (`identity()`, `packages/docdive-element/src/element.ts:225`), and both diagrams mapped their nodes with no error.
- **Bug 1:** `?docdive-select=X` selects X in *every* diagram that contains it, so two panels open. `restoreSelection()` (`element.ts:300`) only checks that the node is in its own diagram.
- **Bug 2:** `docdive-scenario` / `docdive-step` are restored on every diagram the scenario touches (`initTrace()`, `element.ts:233`).
- `selectionUrl()` (`element.ts:363`) and `openUrl()` (`element.ts:376`) carry no diagram identity.
- `touchesDiagram()` (`shared.ts:87`) counts every fence of a child doc as touched when the scenario passes through its owner.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Trace | Each diagram has its own independent trace; URL state applies only to the diagram it came from | Several diagrams moving in sync on one page is confusing; the URL should mean one thing |
| Unqualified URLs (0.3.0 links, deep dives) | Apply to the **first** diagram on the page that contains the node / that the scenario touches; the others start idle | Keeps links from 0.3.0 working without opening duplicate panels |
| Click on a node shared with another diagram | Only the clicked diagram reacts | Same as the trace decision |
| Fixture | New `fixtures/toy/architecture/orders-db.md` (`id: OrdersDB`, `parent: system`), 2 flowchart fences that share one node | It is a real deep-dive target from `system`. `PaymentGateway` must stay undocumented because S5, T8 and C5 test the undocumented-element path |
| Expected values | Regenerate every expectation the new doc changes (appearsIn, contexts, Open link on `system`, viewer spike) | The CLI output is the source of truth |

### Scope

**In scope:** element changes (`element.ts`, `shared.ts`), the new fixture page, updates to existing expectations, a new e2e spec on both SSGs, product brief §6 status and §10 item 5.
**Out of scope:** click-to-source (next cycle); a CHANGELOG entry, README updates, a findings note, and fixing the `spike/` paths in `.claude/rules/dyd-element.md` (offered in Think, not chosen); any release; making `n` robust when some fences never become elements (tabs, lazy rendering, MDX); adapter changes (they already emit one element per fence).

### Invariants

- Links copied with 0.3.0 (`docdive-select`, `docdive-scenario`, `docdive-step` and no diagram qualifier) keep working.
- `DYD-EL-001`: `navigator.clipboard.writeText` stays synchronous in the click handler.
- `DYD-EL-004`: trace state travels in the URL query, never `sessionStorage`; a node click only selects.
- Single-diagram pages behave exactly as today.
- `contexts.json` still comes only from `renderAllContexts` (`DYD-EL-002`).

### Acceptance criteria

New e2e spec, passing on both Docusaurus and MkDocs:
1. Both diagrams on `OrdersDB` render and map their nodes.
2. Clicking the shared node selects it in that diagram only, with one panel.
3. A link copied from diagram #2 restores the selection in #2 only.
4. An unqualified link (0.3.0 style) restores in the first matching diagram only.
5. Each diagram's trace steps independently.
6. Deep dive `system` → `OrdersDB` with a trace active: only the first touched diagram is traced.

Plus: `npm run typecheck`, `npm run lint`, `npm test`, `uvx ruff check .`, `npm run e2e`, `npm run e2e:ssg` (after `npm run examples:build`) and `npm run pack-test` all pass.

## Tasks

- [x] T01: Add `fixtures/toy/architecture/orders-db.md` (`id: OrdersDB`, `parent: system`) with 2 flowchart fences that share one node; both are touched by `checkout-happy-path` through the owner chain
- [x] T02: Update the existing expectations the new doc changes (unit tests, `e2e/ssg.pw.ts`, `e2e/trace-context.pw.ts`, `e2e/viewer.pw.ts`, `scripts/pack-test.sh`), taking the values from the CLI [integration]
- [x] T03: Element: copied links and Open URLs carry the diagram they came from; selection restore applies only to that diagram, and an unqualified link applies to the first diagram on the page that contains the node
- [x] T04: Element: scenario/step restore applies only to the qualified diagram; an unqualified URL (including a deep dive) applies to the first diagram the scenario touches, and the others start idle
- [x] T05: Unit tests for the pure "which diagram owns this URL state" logic in `shared.ts` [unit]
- [x] T06: New multi-diagram e2e spec on both SSGs covering the 6 acceptance cases [integration]
- [x] T07: Update product brief §6 (web component status) and §10 item 5 to mark multi-fence pages done
- [x] T08: Rebuild the examples (`npm run examples:build`) and run the checks plus `e2e`, `e2e:ssg` and `pack-test` until all pass [integration]
