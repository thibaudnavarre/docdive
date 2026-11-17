# UI Variant Scorecard — docdive viewer

## Context
- Mode: brownfield-lite (real Mermaid + real `index.json`/`contexts.json` from `fixtures/toy`; chrome mocked in light DOM because the element's shadow DOM cannot be restructured per variant without implementing all three layouts). Recorded as an assumption.
- Scope: viewer surfaces (header, player, node states, inspector) + overview map
- Round: 1
- Evidence: `shots/*.png` (3 styles × light/dark × 1280/390), deterministic contrast checks on the token pairs (below), state parity checked in section 5 of the lab.

## Shared (direction-level) decisions, outside the per-variant score
- Host font inherited; one accent (indigo) + one selection colour (sky); soft surfaces.
- Divable nodes: 2px fg stroke + 600 label weight; leaf nodes 1.5px grey, `cursor: default`.
- Selected (sky, filled tint) ≠ trace-active (indigo glow): two states can coexist on one node.
- One play/pause toggle, `n / N` counter, human step sentence, `passes through X` chip.
- Contrast (fixed during the round): dark primary button text → `--docdive-on-accent: #111113` (white on `#818cf8` was 2.98); selection stroke `#0ea5e9` → `#0284c7` (2.77 → 4.10 on white).

| Pair | Ratio | Target |
|---|---:|---|
| light fg / surface | 17.7 | 4.5 ✅ |
| light muted / surface | 5.3 | 4.5 ✅ |
| light accent text / surface | 6.3 | 4.5 ✅ |
| light primary button | 6.3 | 4.5 ✅ |
| light selection stroke / white | 4.1 | 3.0 ✅ |
| light node stroke / white | 3.3 | 3.0 ✅ |
| dark fg / surface | 14.0 | 4.5 ✅ |
| dark muted / surface | 6.4 | 4.5 ✅ |
| dark primary button (after fix) | 6.3 | 4.5 ✅ |
| dark selection stroke / surface | 8.3 | 3.0 ✅ |
| dark node stroke / surface | 3.7 | 3.0 ✅ |

## Criteria (1-5)

| Variant | Clarity | Hierarchy | Actionability | Consistency | Accessibility | Responsiveness | Visual Distinctiveness | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| A — Inspector dock | 5 | 4 | 5 | 4 | 4 | 4 | 3 | Diagram and details side by side; nothing moves when you click. Empty inspector column on pages with no selection. |
| B — Reading flow | 4 | 5 | 4 | 5 | 5 | 5 | 3 | Sentence-first reads beautifully; selecting a node pushes the card below the diagram (scroll on tall diagrams). |
| C — Framed canvas | 3 | 3 | 4 | 3 | 3 | 3 | 5 | Most "product" feel; floating inspector clips/covers the diagram on small diagrams; mono IDs fight the host typography. |

## Evidence and confidence

### Variant A — Inspector dock
- Clarity: 5 | High | one glance shows diagram + details + where you are in the flow; no layout shift on click. | none
- Hierarchy: 4 | High | breadcrumb > diagram > transport; inspector is a peer column, so the primary CTA competes with the diagram for attention. | none
- Actionability: 5 | High | "Dive into X" is the first thing after the description; relations are chips; scrubber + ‹ › + play within 30px of each other. | none
- Consistency: 4 | Medium | flat 1px surfaces match Docusaurus/Material; the empty dashed inspector is a slightly different idiom than the filled card. | Medium: dashed empty state might read as "broken" to some users
- Accessibility: 4 | High | all controls keyboard reachable, focus ring 2px accent, range input native; dense 13.5px base is at the low end for prose. | none
- Responsiveness: 4 | High | collapses to one column under 860px with player above the diagram; inspector drops below (requires a scroll after a tap on mobile). | none
- Visual Distinctiveness: 3 | High | intentionally quiet; a reviewer might call it "a docs sidebar". | none

### Variant B — Reading flow
- Clarity: 4 | High | sentence hero makes the current step unmistakable; but details of a selected node are below the diagram, out of the first glance on tall diagrams. | none
- Hierarchy: 5 | High | one column, one reading order: where am I → what happens now → the picture → the details. | none
- Actionability: 4 | High | pills double as scrubber and progress; CTA prominent; but copy/dive actions live a scroll away from the node on tall diagrams. | none
- Consistency: 5 | High | pill buttons, soft cards and 15px type are exactly the idiom of Docusaurus classic / Material; nothing looks foreign. | none
- Accessibility: 5 | High | largest type and tap targets (34px), pills are real buttons with `aria-current`, `aria-live` sentence. | none
- Responsiveness: 5 | High | no layout switch needed; same reading order at 390px. | none
- Visual Distinctiveness: 3 | Medium | elegant but could be mistaken for the host's own callout cards. | Low: distinctiveness is partly a non-goal for an embedded element

### Variant C — Framed canvas
- Clarity: 3 | High | frame makes "this is the twin" obvious, but the floating inspector hides part of the canvas and clips when the diagram is shorter than the card (visible in `c-*-desktop.png`, section 2). | none
- Hierarchy: 3 | Medium | toolbars top and bottom split attention; the step sentence shares a row with the transport and shrinks. | Medium: a taller diagram would change the balance
- Actionability: 4 | High | keyboard hints visible, CTA full-width, transport always at the same place. | none
- Consistency: 3 | Medium | mono IDs, 4px radii and grid texture are a strong "tool" voice that will clash with Material's rounded UI. | none
- Accessibility: 3 | High | 13px base + 0.85em mono hints fall under 12px effective; translucent inspector over a grid texture lowers effective contrast. | none
- Responsiveness: 3 | Medium | floating inspector must switch to static under 860px and the grid areas re-flow — two layouts to maintain. | Medium: mobile layout had to be special-cased twice
- Visual Distinctiveness: 5 | High | immediately reads as a dedicated instrument, not docs decoration. | none

## Key tradeoffs
- A trades distinctiveness for zero layout shift and the best "one glimpse" (diagram + details simultaneously).
- B trades simultaneity for the cleanest reading order and the best fit with both host themes.
- C trades host consistency, a11y margins and two layouts for the strongest identity.

## Provisional result
- Totals: A 29 · B 31 · C 24
- Winner (scorecard): **B — Reading flow**. Runner-up: **A — Inspector dock**.
- Observation: A and B differ on one axis (where the inspector lives). The final direction can take B's voice (type scale, pills, cards, sentence hero) and A's docked inspector above a width breakpoint, which removes B's only clarity/actionability weakness. This hybrid is proposed for narrowing, not auto-selected.
