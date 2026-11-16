# COR Plan — Slick UI for `<docdive-diagram>`

## Context

Give the `<docdive-diagram>` web component an elegant, modern, Linear/Vercel-style look: polished chrome, restyled Mermaid defaults, animated trace steps, and automatic light/dark following the host site, with CSS custom properties for overrides.

### Current state

- All styling is the inline `STYLE` string in `packages/docdive-element/src/element.ts:74`, appended to the shadow root at `element.ts:139`: grey `#ccc` borders, `#e65100` highlights, no dark mode, no motion, no focus styles.
- Active highlighting is attribute-driven: `shared.ts:189–202` clears and sets `data-docdive-active` on nodes, edges and sequence messages per trace step.
- `mermaid-resolver.ts:34,46` only calls `initialize` on the bundled Mermaid copy so a host's theme/config stay intact.
- Both example sites build from `fixtures/toy` (`examples/docusaurus/docusaurus.config.js:35`, `examples/mkdocs/mkdocs.yml` `docs_dir`). `mkdocs.yml` has no `palette`, so MkDocs has no dark mode today.
- No e2e test asserts colors/CSS; tests key on `data-docdive-*` attributes. Playwright configs declare no browser projects (Chromium only).

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Surface | `<docdive-diagram>` only; `apps/viewer` untouched | What SSG users actually see |
| Depth | Visual restyle + motion; no zoom/pan/minimap/keyboard nav/fullscreen | Keep scope to "slick", not new interactions |
| Layout | Keep current order (breadcrumb → trace bar → diagram → panel), polished | Avoid behavior/e2e churn |
| Mood | Linear/Vercel: minimal, crisp, subtle depth | User choice |
| Typography | Inherit host font; refine size/weight/spacing only | Blend into host site |
| Theming | Follow host light/dark: Docusaurus `html[data-theme]`, Material `data-md-color-scheme` (`slate` = dark), fallback `prefers-color-scheme`; expose `--docdive-*` custom properties | Shadow DOM can't see host attributes via CSS (`:host-context` not cross-browser), so mirror in JS |
| Live toggle | Follow instantly via CSS (MutationObserver → host attribute), no re-render | Smooth, cheap |
| Mermaid look | Restyle via shadow-DOM CSS only; never `initialize` the host copy | Preserve resolver contract |
| Author styling | `classDef` / `style` / `linkStyle` always win; our defaults use zero-specificity `:where()` | Mermaid emits `classDef` with `!important`; authors' intent first |
| Motion | ~200 ms fade/glow on active node + stroke-draw on active edge/message, Web Animations API | Zero deps |
| Deps | No new runtime dependencies | Bundle size |
| A11y | `prefers-reduced-motion` disables animation, WCAG AA contrast, visible `:focus-visible` rings | Accessibility floor |
| Browsers | Evergreen Chromium/Firefox/Safari; graceful no-animation fallback | — |
| Author-styling coverage | Add `classDef`/`class`/`style` to the second `OrdersDB` diagram in `fixtures/toy/architecture/orders-db.md` | Both sites build from the fixture; adds no element/edge |

### Scope

**In scope:** element `STYLE`, theme sync, Mermaid default restyle, highlight + motion, MkDocs palette toggle, one fixture styling line, docs.
**Out of scope:** `apps/viewer`, new interactions, layout changes, Firefox/WebKit e2e projects, screenshot snapshots, changing `mermaid-resolver.ts` behavior.

### Invariants

- All `data-docdive-*` attributes and DOM order unchanged; existing e2e suites green.
- Host Mermaid copy never initialized; host Mermaid theme/config respected.
- Element still degrades to plain Mermaid without `index.json`.
- Trace/breadcrumb/panel behavior unchanged (style and motion only).

### Acceptance criteria

- `npm run e2e` and `npm run e2e:ssg` green (Chromium).
- Configured checks green.
- Owner walkthrough on both example sites: light + dark, live theme toggle, reduced motion, author-styled `OrdersDB` diagram keeps its colors, in Chromium, Firefox and Safari.

## Tasks

- [x] T01: Define `--docdive-*` custom properties (light + dark palette, accent, radius, spacing, motion duration) and restyle panel, trace bar, breadcrumb, error and `:focus-visible` rings in `STYLE` (`element.ts:74`); AA contrast, inherit host font
- [ ] T02: Add pure `hostTheme(document)` to `shared.ts` (Docusaurus `html[data-theme]`, Material `data-md-color-scheme` on `html`/`body`, `slate` → dark, else null); element mirrors it to `:host[data-docdive-theme]` via MutationObserver; CSS falls back to `prefers-color-scheme` when absent
- [ ] T03: Restyle Mermaid default output (flowchart nodes/edges/labels, sequence actors/messages) with theme-aware `:where()` shadow CSS so author `classDef`/`style` always wins
- [ ] T04: Restyle active highlight with accent tokens + glow, replacing `#e65100`
- [ ] T05: Trace step motion via Web Animations API in the highlight path (`shared.ts:189`): ~200 ms fade/glow on active node, stroke-draw on active edge/message; skipped under `prefers-reduced-motion` or when `Element.animate` is missing
- [ ] T06: Unit tests for `hostTheme` and the motion skip guard in `shared.test.ts` [unit]
- [ ] T07: Add Material palette toggle (default/slate) to `examples/mkdocs/mkdocs.yml` and `classDef`/`class`/`style` to the second `OrdersDB` diagram in `fixtures/toy/architecture/orders-db.md`
- [ ] T08: Run `npm run e2e` and `npm run examples:build && npm run e2e:ssg`; keep all green [integration]
- [ ] T09: Document theming, `--docdive-*` properties and motion in `docs/architecture/docdive-element.md` and the element README
- [ ] T10: Owner walkthrough on both example sites: light/dark, live toggle, reduced motion, author-styled diagram, Chromium/Firefox/Safari [UAT]
