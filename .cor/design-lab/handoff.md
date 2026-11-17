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

---

## cor-design hand-off — round 2: timeline player + state through the steps

Supersedes the player section of round 1; everything else in round 1 (layout, tokens, inspector, node states, map) stays.

### Decision
- Winner: A — Dotted rail + state strip, with B's entity trail as the strip's second mode (hybrid)
- Runner-up: B — Segmented story bar + entity ledger
- Decision mode: hybrid (model recommendation, user confirmed at the gate); SVG badges dropped at the gate
- Rationale: A has the clearest status (filled rail, ringed current mark, `n / N`, sentence), the largest targets, and reuses the locked card/chip language, so the new strip reads as "the inspector's state section, one card per participant". B's entity trail is the strongest cue for "data living through the process" (past → now → dimmed future) and slots into the strip as a second grouping without a second player. Badges inside the SVG duplicated the strip, clipped at the frame and were illegible at 390px. C's matrix fails at 390px and competes with the diagram.
- Unresolved risks:
  - Notes that do not follow `Entity k=v …` fall back to free text (muted) — the strip then shows words, not fields; the convention doc must make the `k=v` form the default.
  - Strip with many holders (8+) wraps to two rows; acceptable, revisit if real systems look crowded.
  - Rail with many steps (20+): marks 28px apart need ≥ 560px; below that the marks overlap and only the slider (drag/keys) remains usable; hide marks under a container width threshold (`@container (max-width: …)`) when `N × 28 > width`.
  - `Note over A,B` applies to both; a note before the first message is step 0 (initial state) and is shown at step 0 instead of the "No state yet" line.

### Semantic token map
- color: no new tokens. Field chip = `--docdive-surface-2` bg, `--docdive-fg` value, `--docdive-fg-muted` key; changed = `--docdive-accent-soft` bg + `--docdive-accent` text + 1px inset `accent 35%`; entity chip outlined with `--docdive-border`; rail track `--docdive-border`, fill `--docdive-accent`, mark stroke `--docdive-node-stroke` (3.3:1), mark state dot `--docdive-fg-muted`; glyph = `--docdive-accent` / `--docdive-on-accent`; changed card border `--docdive-accent` + 3px `accent-soft` ring; future trail items use a colour shift to `--docdive-fg-muted` (not opacity) so text stays ≥ 4.5:1.
- typography: sentence 1.25em/1.35 600 (unchanged); field chips `--docdive-font-mono` 0.82em; entity chip 0.8em 650; card title 0.93em 650; counter 0.93em tabular; `aria-valuetext` = "Step k of N: <sentence>".
- radius: cards keep `--docdive-radius`; inner state cards `calc(radius - 4px)`; field chips 6px; glyph, marks, trail steps `999px`.
- elevation: none added; the strip cards sit on `--docdive-bg` inside the player card (two surface levels total).
- density (gate correction → 4px grid): rail row gap 16px; glyph 36px; rail hit-zone 36px tall, marks 28px (dot 10px, current 16px, past filled); strip grid `auto-fill, minmax(200px, 1fr)` gap 12px, card padding 12px, field gap 4px 8px; strip separated from the sentence by a 1px border + 12px.
- states: glyph hover = darker fill + `--docdive-shadow` (two signals, gate correction); mark hover = scale 1.3 + accent stroke; mark current = accent fill + 2px accent ring + 6px soft ring; card changed = accent border + soft ring; card owner button hover = accent + underline; focus ring 2px accent offset 2px on the rail (one stop), glyph, owner buttons, trail steps.
- motion: fill width and mark transitions 160ms ease-out; trail/strip changes 160ms; existing 200ms trace draw-in; all off under `prefers-reduced-motion`.

### Component impact matrix
- Model `sequence.ts` / `model.ts` / `shared.ts` types: `steps[k].notes = [{ over: string[], text, entity?, fields? }]`; note placement: after message k → step k, before any message → step 0 | high | low (additive, `INDEX_VERSION` stays 1)
- Pure helpers `shared.ts`: `stateAt(index, scenario, step)` → cards `{ over, entity, fields: [{k, v, changed}], text, changed }`; `entityTrail(index, scenario)` → per entity `[{ step, over, fields }]`; `stateHolders`, `hasState`; `stepTitle` for `aria-valuetext`; `relevantHolder(index, diagram, id)` (drawn via proxy, or owner chain) | high | low
- Player `element.ts` (`initTrace`/`setStep`/`play`): rail row = glyph (`data-docdive-play`/`data-docdive-pause` on one button, CSS-drawn icon) + rail (`data-docdive-scrub`, `role=slider`, ←/→/Home/End, pointer drag, `data-docdive-mark` buttons `tabindex=-1`, `data-has-state`, `data-past`, `aria-current`) + counter (`data-docdive-step` kept). Pills, `data-docdive-prev`, `data-docdive-next` removed. `docdive-interval` kept. | high | medium (e2e hooks change)
- State strip `element.ts`: `data-docdive-state` container under the sentence; header with a `data-docdive-state-mode` toggle (`participants` default / `entities`); participant mode = one `article[data-docdive-state-card][data-changed]` per relevant holder with owner button (selects the element), entity chip, field chips `[data-docdive-field][data-changed]`, muted text; entity mode = one row per entity: entity chip, "lives at <owner>", trail of `[data-docdive-trail-step]` buttons (28px) with `data-future`/`data-now`; hidden when the scenario has no notes; "No state yet" at step 0 / "Nothing drawn here holds state yet" on a child page | high | medium
- Inspector `renderPanel`: "State at step n" field (`data-docdive-field="state"`) when the selected element is a holder at this step; re-rendered from `setStep` | med | low
- Badges in the SVG: dropped (gate) | — | —
- URL state: unchanged (`docdive-scenario`, `docdive-step`, `docdive-select`, `docdive-diagram`); the strip mode is not in the URL | — | —
- Docs: `conventions.md` (note convention + when to write state), element README (rail, strip, hooks, part `state`), root README model section, `.claude/rules/docdive-element.md` (DD-EL-007 amended: glyph-only toggle, no prev/next; new rules for notes as the only state source and the helper location) | med | low

### Quality gate (ui-design-system-principles + ux-frameworks)
- Passed: semantic tokens only, contrast table (scorecard round 2), em type scale, slider semantics with `aria-valuetext`, 28px targets, reduced motion, dark surfaces lighter than background, one accent + one selection colour kept.
- Corrections applied at the gate: 4px spacing grid (6/10/14 → 8/12/16), glyph hover gets a second signal (shadow), C-style opacity de-emphasis replaced by a colour shift in the entity trail, badges removed.

### Non-goals
- SVG badges / overlays on Mermaid output.
- Swimlane matrix (C).
- A structured `states:` frontmatter block or `kind: entity` docs; entities exist only as the leading word of a note.
- Quoted or spaced values in `k=v` (`name="Jane Doe"`): out of scope, free text fallback.
- Strip mode or scrub position in the URL / `sessionStorage`.
- Changes to `index.json` version, `docdive-navigate`, adapters.

### Acceptance criteria
- Visual: the player shows glyph + rail + `n / N` on one row and the sentence under it; no numbered pills, no `‹ ›`; marks that write state carry a dot; the current mark is ringed; the fill ends at the current mark; state cards use the field chip vocabulary; changed fields and changed cards are tinted accent; light and dark pass the round-2 contrast table.
- Usability: click a mark, drag the rail, press ←/→/Home/End, or press the glyph to move; the sentence, counter and rail agree at every step; the strip shows what each drawn/owning participant holds at this step, and the entity mode shows each entity's trail with past, now and dimmed future; clicking a participant name opens the inspector, whose "State at step n" matches the card; a child page shows only its own state (DB page → DB row).
- Accessibility: one focus stop for the rail (`role=slider`, `aria-valuenow`, `aria-valuetext` with the sentence), glyph `aria-label` Play/Pause, all targets ≥ 28px, text ≥ 4.5:1, strokes ≥ 3:1, motion off under `prefers-reduced-motion`.
- Regression: `npm run typecheck && npm run lint && npm test` green; `npm run examples:build && npm run e2e` green on both sites with the updated hooks (`data-docdive-play/pause`, `data-docdive-step`, `data-docdive-scrub`, `data-docdive-mark`, `data-docdive-state*`).
