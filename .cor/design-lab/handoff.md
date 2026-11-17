## cor-design hand-off — docdive viewer

### Decision
- Winner: B — Reading flow, with A's docked inspector on selection (hybrid)
- Runner-up: A — Inspector dock
- Decision mode: hybrid (model recommendation, user confirmed at the gate)
- Rationale: B has the cleanest reading order (where am I → what happens now → the picture → the details), the best fit with Docusaurus classic and Material, the largest type and targets, and one layout for all widths. Its single medium risk (details far from a tall diagram) is removed by docking the inspector to the right only when a node is selected and the element is wide enough; nothing is reserved when empty, so A's empty-column cost is not inherited.
- Unresolved risks:
  - Dock trigger is element width, not viewport (the element lives in a docs content column): use a container query on the host (`container-type: inline-size` on the shadow wrapper), threshold 960px of element width → falls back to inline below.
  - Mermaid shrinks wide `flowchart LR` when the column narrows on dock; accept (diagram keeps ≥ 2/3 width) — revisit if real systems look cramped.
  - Pills at 26px are the touch-target floor; keep ≥ 28px in the element.
  - `<docdive-map>` on a Docusaurus page without any Mermaid fence: verify the element script is loaded there (adapter detail, B6).

### Semantic token map
- color:
  - `--docdive-bg` → page-level muted surface (player/inspector background in light: `#fafafa`, dark: `#111113`)
  - `--docdive-surface` → card surface (`#fff` / `#18181b`); `--docdive-surface-2` → chip background (`#f4f4f5` / `#1f1f23`)
  - `--docdive-fg` → text (`#18181b` / `#e4e4e7`); `--docdive-fg-muted` → secondary text, ≥ 4.5:1 (`#6b6b76` / `#9b9ba6`)
  - `--docdive-border` → 1px dividers (`#e4e4e7` / `#2e2e33`)
  - `--docdive-accent` → trace-active, primary action, focus ring (`#4f46e5` / `#818cf8`); `--docdive-on-accent` → text on accent (`#fff` / `#111113`); `--docdive-accent-soft` → 12% accent tint (hover fill, through chip)
  - `--docdive-selected` → selected node (`#0284c7` / `#38bdf8`), distinct from trace-active
  - `--docdive-ok` / `--docdive-error` → copy status, error line (`#15803d`/`#4ade80`, `#b91c1c`/`#f87171`)
  - `--docdive-node-fill`, `--docdive-node-stroke`, `--docdive-edge` → unchanged Mermaid overrides
- typography:
  - `--docdive-font: inherit` (host font); `--docdive-font-mono` for step labels (`em` in the sentence) and `src` paths
  - base = host body size (the element sets no `font-size`; everything scales in `em`), labels 0.78em uppercase +0.06em tracking 600, title 1.3em 650 −0.01em, sentence 1.25em 1.35 lh, chips 0.86em, kind chip 0.72em
  - divable node labels 600; leaf labels 400
- radius: `--docdive-radius: 14px` cards/player/diagram frame; buttons and select `999px` (pill); chips `999px`; `--docdive-radius` stays the single public knob (buttons derive from it: `radius ≥ 12px → pill`)
- elevation: `--docdive-shadow` on player and inspector cards only (`0 1px 2px rgb(0 0 0/.04), 0 4px 16px -8px rgb(0 0 0/.08)`; darker in dark); diagram frame is border-only
- density: `--docdive-space: 16px`; card padding 20px; grid gap 16px; icon buttons 36px; pills 28px (4px grid); transport gap 10px
- states: hover changes two signals (border colour + fill); disabled `opacity .45` + `cursor: not-allowed`; focus ring 2px accent, offset 2px, independent of hover
- motion: `--docdive-duration: 160ms` for hover/fill/border; existing 200ms trace draw-in kept; all off under `prefers-reduced-motion`

### Component impact matrix
- Tokens / `:host` CSS: extend set above, dark values, `part` on `trace`, `panel`, `crumbs`, `diagram`, `map` | high | low (additive)
- Node states (`annotateFlowchart`, sequence actors, CSS): `data-docdive-divable` (has child doc), `data-docdive-selected`, hover/focus stroke, `tabindex`/`role=button`/`aria-label` on mapped nodes, Enter/Space selects, leaf nodes `cursor: default` | high | medium (SVG styling limited to stroke/fill/filter; `:where()` trick must stay so author `classDef` wins)
- Header (`renderBreadcrumb`): breadcrumb trail + current in bold + kind chip (`flowchart` / `sequence` / `scenario`); shown when the doc has an owner even without ancestors; `/` separators | med | low
- Player (`initTrace`, `setStep`, `play`): card; sentence hero (`stepSentence`, `aria-live=polite`); step pills (`aria-current`) as scrubber; transport row = select + ‹ ▶/⏸ › + `n / N`; single toggle button flips `data-docdive-play`/`data-docdive-pause`; ←/→ on the bar; `passes through X` as chip in the card | high | medium (e2e hooks must stay)
- Inspector (`renderPanel`): card with header (ID, kind chip `has diagram`/`leaf`, close ×), description, primary `Dive into X →` (= `data-docdive-open`), relation rows label/chips (Parent, Children, Appears in as owner names via `diagramLabel`, Scenarios → set picker + step 1), Source list (mono path + `Source` link), Copy context / Copy link with 1.5 s transient status in the existing `*-status` spans (`role=status`); empty state line only when the diagram has mapped nodes; docks right (grid `1fr 320px`, sticky) when selected and element ≥ 960px via container query | high | medium
- Overview `<docdive-map>` (new `map.ts`): two columns System (tree from `parent/children`, roots = parentless elements with a doc, divable names as links, description, `N flows` chip) and Flows (scenario name link, `N steps`, elements crossed as chips); single column < 720px; same tokens | high | medium (new element, adapter script load check)
- Pure helpers (`shared.ts` + tests): `divable`, `diagramLabel`, `stepSentence`, `headerTitle`, `systemTree`, `scenarioSummary` | high | low
- Docs: element README (tokens, parts, map), root README, `.claude/rules/docdive-element.md` | med | low

### Quality gate (ui-design-system-principles + ux-frameworks)
- Passed: semantic tokens only, contrast table verified, em type scale, 4px spacing grid, two-signal hover, cursor semantics, sparse elevation, dark surfaces lighter than background, reduced motion. Corrections applied at the gate: icon buttons 34 → 36px, base size = host, `cursor: not-allowed` on disabled.

### Non-goals
- Doc-health dashboard (orphans, lint diagnostics in the UI).
- Host-site landing pages or adapter UI beyond loading the script.
- Changes to the model, `index.json` schema (`INDEX_VERSION` stays 1), URL params, `docdive-navigate`.
- Variant C's grid texture, mono IDs, floating inspector.
- Custom layout engine or replacing Mermaid.

### Acceptance criteria
- Visual: one accent + one selection colour; divable nodes visibly heavier than leaves; selected and trace-active distinguishable when both apply to one node; player and inspector are cards with `--docdive-radius`; light and dark both pass the token contrast table in `scorecard.md`.
- Usability: step shown as a sentence and `n / N`; one play/pause toggle; pills jump to any step; clicking a node never shifts the diagram out of view (dock ≥ 960px, inline below); `Dive into X →` is the first action of the inspector; relations are clickable; overview lists every element with a doc and every scenario.
- Accessibility: all controls keyboard reachable with a visible 2px accent ring; mapped nodes focusable (`role=button`, `aria-label` states "has its own diagram"); sentence and copy status announced via live regions; text ≥ 4.5:1, UI strokes ≥ 3:1; targets ≥ 28px; motion off under `prefers-reduced-motion`.
- Regression: `npm run typecheck && npm run lint && npm test` green; `npm run examples:build && npm run e2e` green on both sites with the existing `data-docdive-*` hooks.
