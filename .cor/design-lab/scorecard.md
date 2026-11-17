# UI Variant Scorecard — docdive viewer, round 2 (timeline + state through steps)

## Context
- Mode: brownfield-lite (real Mermaid + real `index.json` from `fixtures/toy`; the state notes are mocked in `lab.js` exactly as `sequence.ts` will index them: `steps[k].notes = [{ over, entity, fields, text }]`). Base layout is the round-1 lock; only the player and the state surfaces vary.
- Scope: core screen — scenario player (replaces pills + `‹ ▶ ›` + counter) and the state surfaces (strip / ledger / lanes / badges / inspector section).
- Round: 2
- Evidence: `shots/*.png` (3 variants × light/dark × 1280/390, plus `a-player-detail.png`, `b-player-detail.png`), deterministic contrast checks on the new pairs (below), slider semantics checked in the DOM (`role=slider`, `aria-valuetext`), sticky/scroll behaviour of C measured with Playwright at 390 and 1280.
- Round-1 artefacts: `round-1/`.

## Shared (direction-level) decisions, outside the per-variant score
- One icon-only ▶/⏸ glyph (CSS-drawn, flips on `data-playing` = `data-docdive-play`/`data-docdive-pause`); no `‹ ›` buttons; ←/→, Home/End on the focused timeline; `n / N` kept.
- Every timeline is one focus stop with `role=slider`, `aria-valuenow`, `aria-valuetext` = "Step k of N: sentence"; individual marks/segments are `tabindex=-1` click targets.
- State vocabulary shared by all surfaces: entity chip (outlined), `k = v` field chips (mono), changed-at-this-step = accent tint + 1px accent inset; participant name = button that selects the element (opens the inspector).
- Inspector gets a "State at step n" section when the selected element holds state (all variants).
- A child page only shows the state of what it draws or owns (`relevant()`), so the DB page shows the DB row, not the whole flow.
- Contrast corrections applied during the round: rail marks `#e4e4e7` → `--docdive-node-stroke` (1.2 → 3.3:1); unfilled story segments → `fg-muted 55% / border` mix (≈ 3.1:1); the state dot inside a mark uses `fg-muted`.

| Pair | Ratio | Target |
|---|---:|---|
| light field text `#18181b` / surface-2 `#f4f4f5` | 16.1 | 4.5 ✅ |
| light field key (muted) / surface-2 | 5.0 | 4.5 ✅ |
| light changed field accent / accent-soft on white (`≈#eeedfc`) | 6.1 | 4.5 ✅ |
| light rail mark stroke / white | 3.3 | 3.0 ✅ |
| light unfilled segment / white | 3.1 | 3.0 ✅ |
| light badge border accent / white | 6.3 | 3.0 ✅ |
| dark field text `#e4e4e7` / surface-2 `#1f1f23` | 13.2 | 4.5 ✅ |
| dark changed field `#818cf8` / accent-soft on `#18181b` | 5.6 | 4.5 ✅ |
| dark rail mark stroke `#71717a` / surface | 3.7 | 3.0 ✅ |
| C future cells at opacity .45 (text) | ≈ 3.2 | 4.5 ❌ (intentional de-emphasis; must become a colour change, not opacity, if C ships) |

## Criteria (1-5)

| Variant | Clarity | Hierarchy | Actionability | Consistency | Accessibility | Responsiveness | Visual Distinctiveness | Total | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A — Rail + strip (+ badges) | 4 | 5 | 5 | 5 | 4 | 4 | 4 | **31** | Badges cost one point in Clarity, Accessibility and Responsiveness; without them A is 33. |
| B — Story bar + ledger | 4 | 4 | 4 | 4 | 3 | 4 | 5 | 28 | Best "entity through time" story; segment and trail targets shrink with N. |
| C — Swimlanes | 4 | 3 | 4 | 3 | 3 | 2 | 5 | 24 | Answers the question in one matrix, but is as heavy as the diagram and needs horizontal scroll at 390. |

## Evidence and confidence

### Variant A — Dotted rail + state strip + SVG badges
- Clarity: 4 | High | Sentence hero + filled rail + ring on the current mark give three status cues; cards read as "who holds what", changed fields tinted. Badges clip at the diagram frame (`a-light-desktop`: PaymentGateway badge cut by `overflow-x: auto`) and overlap edge labels. | uncertainty: none
- Hierarchy: 5 | High | Player → strip → diagram → inspector; one accent; cards sit on `--docdive-bg` under the white player card, so they read as secondary. | none
- Actionability: 5 | High | Click a mark, drag the rail, ←/→/Home/End, play glyph; the state dot inside a mark tells where state changes before you get there; card title selects the element. | none
- Consistency: 5 | High | Reuses the locked card/chip/pill language; the strip card is the inspector's state section with a header. | none
- Accessibility: 4 | High | Slider semantics + 28px marks + aria-valuetext; badges are `aria-hidden` duplicates of the strip. Minus one: badges can sit on top of SVG text (edge label "capture"), hurting legibility of the diagram itself. | none
- Responsiveness: 4 | High | Strip collapses to one column at 390 and stays legible; rail works at 390 (6 marks ≥ 28px apart). Badges are illegible on the shrunk SVG at 390 (`a-light-mobile`). | none
- Visual Distinctiveness: 4 | Medium | Media-player idiom: recognisable, "sexy" in the familiar sense, not novel. | minor (taste)

### Variant B — Segmented story bar + entity ledger
- Clarity: 4 | High | Segments read as progress; the caption appears only on hover/pointer so the step name depends on the sentence below. The ledger's future-dimmed trail is the strongest "time travel" cue of the round (`b-player-detail`). | none
- Hierarchy: 4 | Medium | Entity-first: the ledger's two rows weigh as much as the sentence; the thin segments give the player low visual status when idle. | uncertainty: depends on the number of entities (2 in toy)
- Actionability: 4 | High | Segments click/drag/keys; trail steps jump to the step. Segment width is 1/N of the bar (≈ 50px at 390 for 6 steps; 15px for 20 steps). | none
- Consistency: 4 | High | New idioms (segments, trail with arrows) next to the locked chips; still one accent. | none
- Accessibility: 3 | High | Trail step buttons are 24px (< 28px floor); the hover-only caption has no keyboard equivalent beyond `aria-valuetext`; unfilled segments fixed to 3.1:1 during the round. | none
- Responsiveness: 4 | High | Ledger rows go single-column at 720; trail wraps; bar fine at 390. | none
- Visual Distinctiveness: 5 | High | Nothing else in docs tooling shows an entity's trail across participants. | none

### Variant C — Swimlane timeline
- Clarity: 4 | Medium | The matrix answers "who holds what, when" in one glance, and the playhead column is unmistakable. Column labels truncate (`OrderService → Payme…`), and on the scenario page the matrix repeats the sequence diagram's time axis directly above it. | uncertainty: toy has 4 holders × 6 steps; real flows are wider
- Hierarchy: 3 | High | The matrix is as tall and heavy as the diagram; the sentence is demoted to a caption under it. | none
- Actionability: 4 | High | Columns click, ←/→, glyph in the corner, names select; no drag scrub. | none
- Consistency: 3 | High | A table-like component in a card-and-chip system; truncation and dashed lane lines are new textures. | none
- Accessibility: 3 | High | Future cells de-emphasised by opacity (text ≈ 3.2:1, fails AA); truncated labels only expose full text via `title`; dense. | none
- Responsiveness: 2 | High | At 390 one column fits (client width 250px for 6 columns): scrubbing means horizontal scrolling; sticky name column verified after fixes. Desktop fits up to ~8 steps, then scrolls. | none
- Visual Distinctiveness: 5 | High | Most original; the only variant where timeline and state are one object. | none

## Key tradeoffs
- A: the cleanest player and the most legible state, but badges inside the SVG are the weak part — they duplicate the strip and break at the frame edge and on mobile.
- B: the best entity story (the trail), at the cost of weaker step status and smaller targets as N grows.
- C: the most information per pixel and the least room: fails at 390 and competes with the diagram.

## Provisional winner
- Winner: **A** (31; 33 without badges). Runner-up: **B** (28).
- Recommendation for the lock: A's rail + strip + inspector section as the base, **B's entity trail as the strip's second mode** (a "by participant / by entity" toggle on the strip header), **badges dropped** (fail Responsiveness at 390, clip at the frame, duplicate the strip). C's single cue worth keeping is already in A: the state dot on marks that write state.
