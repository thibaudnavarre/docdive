# cor-design Decision Log — docdive viewer

## Round 1
- Mode: auto (approval gate kept before lock)
- Winner candidate: B — Reading flow (scorecard 31)
- Runner-up candidate: A — Inspector dock (scorecard 29)
- Why this narrowed set: A and B share the direction (calm technical, host-font, one accent) and differ on one structural axis (docked vs inline inspector). C scores lowest on consistency and accessibility and needs two layouts.
- Open risks: B's inspector lives below the diagram (scroll on tall diagrams); A's empty inspector column wastes width on pages with no selection.

## UX Finalist Cross-check

### Variant: B — Reading flow

- Verdict: supports
- Framework signals:
  - Nielsen #1 visibility of system status: sentence hero + `aria-current` pill + `n / N` give three redundant status cues; passes-through chip explains why a child page highlights nothing (severity: low — redundancy is slight visual cost)
  - Nielsen #2 match with real world: "PaymentGateway replies ok to OrderService" replaces `-->>` syntax (severity: none)
  - Nielsen #3 user control: single toggle for play/pause, close on the inspector, pills as random access (severity: none)
  - Nielsen #4 consistency: pill buttons and soft cards mirror Docusaurus classic and Material callouts (severity: none)
  - Nielsen #6 recognition over recall: relations as chips, "appears in" as element names instead of `architecture/system.md#0` (severity: none)
  - Nielsen #8 minimalism: inspector card repeats "has diagram" kind chip and the Dive CTA — two cues for one fact (severity: low)
  - Garrett — skeleton: inspector placement below the diagram breaks the "diagram ↔ details" adjacency on tall diagrams; this is a skeleton-plane issue, not surface, so no colour/type fix solves it (severity: medium)
  - Yablonski — Fitts: transport buttons 34px, pills 26px; pills at 26px are at the lower bound for touch (severity: low)
  - Yablonski — Von Restorff: the primary CTA is the only filled accent block in the card → isolation works (severity: none)
  - Yablonski — Jakob: reading order top→bottom matches every docs page; zero learning cost (severity: none)
- Strengths: strongest reading order; best host fit; largest type/targets; one layout for all widths.
- Risks: adjacency loss on tall diagrams (medium); pills at 26px (low).

### Variant: A — Inspector dock

- Verdict: supports
- Framework signals:
  - Nielsen #1: same three status cues minus the pills; scrubber shows position proportionally (severity: none)
  - Nielsen #3: no layout shift on selection — the user never loses the node they clicked (severity: none)
  - Nielsen #8: empty inspector column ("Click a box to inspect it") occupies 300px on every page with no selection, including scenario pages where nothing is selectable (severity: medium)
  - Garrett — skeleton: diagram + details side by side is the correct skeleton for "inspect while looking"; breaks down under 860px where it becomes B (severity: low)
  - Garrett — structure: two column widths means the diagram gets ~70% width; wide `flowchart LR` renders smaller (severity: medium on wide systems)
  - Yablonski — Fitts: inspector is always in the same place → fast repeated inspection (severity: none)
  - Yablonski — Miller/Hick: more simultaneously visible blocks (head, diagram, player, inspector) than B; still ≤4 groups (severity: low)
  - PARC — contrast: dashed empty inspector vs solid filled one is a weak contrast cue; may read as "broken" (severity: low)
- Strengths: zero layout shift; best "one glimpse" when something is selected; sticky details while scrolling a tall diagram.
- Risks: empty column cost (medium); narrower diagram (medium); dashed empty state (low).

### Arbitration hint

- Scorecard winner (B) and framework verdicts agree: both finalists `support`; B carries one medium risk (adjacency), A carries two (empty column, narrower diagram). No conflict → no arbitration needed.
- Recommended direction: **B as the base voice** (type scale, pills, cards, sentence hero, single column) **with A's docked inspector only when a node is selected and the viewport is ≥ 960px** (inspector slides in as a right column; nothing is reserved when empty). This removes B's medium risk without inheriting A's empty-column cost. Diagram width stays 100% until a selection exists.

## Conflict arbitration
- Scorecard outcome: B > A > C
- UX framework outcome: B supports, A supports (B fewer medium risks)
- Conflict detected: no
- User arbitration choice: n/a (no conflict); user confirmed the recommended hybrid at the approval gate
- Final result for this round: **locked — B voice + docked-on-select inspector ≥ 960px** (decision mode: hybrid user/model)

## Convergence status
- Round cap: 3 default
- Remaining rounds: 2
- Continue to next round: no (decision package ready)

---

# Round 2 — timeline player + data living through the steps

## Audit (pre-brief, non-destructive)
- Keep: round-1 lock (reading flow, docked inspector ≥ 960px), token set, node states, sentence hero, `n / N`, single play/pause toggle, `passes through X` chip.
- Flat/faded: the step pills read as a form row (numbered buttons) rather than a timeline; `‹ ▶ ›` + `select` + counter is a toolbar, not a player; nothing tells the reader what the data looks like at a step (the model has no state notion; `sequence.ts` skips `Note` lines).
- Leverage points: (1) one scrubbable timeline replacing pills + transport; (2) state per participant per step, sourced from Mermaid notes so docs stay GitHub-renderable; (3) the inspector shows the selected element's state at the current step, linking DB/frontend state to the element that holds it (its `src`, its page).

## Brief (locked)
- Mode: brownfield-lite (same harness as round 1; assumption recorded: real Mermaid + real index, chrome mocked in light DOM).
- Scope: core screen — player + state surfaces. Shell untouched.
- Audience: readers of architecture docs (Docusaurus / Material), devs tracing a feature across services; also non-devs reading a flow.
- Direction: calm technical (unchanged). Motion: subtle (160 ms hover/fill, 200 ms trace draw-in, badge pop; off under reduced motion). Accessibility: AA strict. Deliverable: one switchable HTML (`index.html`, `?style=a|b|c`).
- Decisions taken by the user at planning time: icon-only ▶/⏸ glyph on the timeline, no `‹ ›`; state sourced from `Note over X: Entity k=v …`; surfaces to explore: strip, badges, inspector section, ledger; lab round before implementation.
- Iteration mode: auto with an approval gate before the lock (as round 1).

## Round 2
- Mode: auto (approval gate kept before lock)
- Winner candidate: A — Dotted rail + state strip (scorecard 31; 33 without badges)
- Runner-up candidate: B — Segmented story bar + entity ledger (scorecard 28)
- Why this narrowed set: A and B share the player idiom (one glyph, one slider, sentence hero) and differ on the state axis (participant-first cards vs entity-first trail). C fails Responsiveness (2) and Hierarchy (3): the matrix needs horizontal scroll at 390 and competes with the diagram.
- Open risks: A's badges clip at the diagram frame and are illegible on mobile; B's segment and trail targets shrink with the number of steps; both rely on a `k=v` convention in notes that free-text notes won't follow (they fall back to muted text).

## UX Finalist Cross-check (round 2)

### Variant: A — Dotted rail + state strip

- Verdict: supports (without badges); supports-with-reservation (with badges)
- Framework signals:
  - Nielsen #1 visibility of system status: filled rail + ringed current mark + `n / N` + sentence = four redundant cues; the state dot on marks previews where state changes (severity: none)
  - Nielsen #2 match with the real world: cards named after the participant ("OrdersDB · Order · id=42 status=paid") mirror how devs talk about rows and payloads (severity: none)
  - Nielsen #3 user control: drag, click, keys, glyph; the card title selects the element so state → element → source is two clicks (severity: none)
  - Nielsen #8 minimalism: badges repeat the strip inside the diagram and overlap edge labels; redundancy without new information (severity: medium → removed if badges are dropped)
  - Garrett — skeleton: player → strip → diagram keeps the reading order of round 1; the strip is the only new block and sits where the pills were (severity: none)
  - Garrett — surface: cards on `--docdive-bg` inside the white player card = one more nesting level; still two surface levels total (severity: low)
  - Gestalt — proximity/common region: each participant's state is one bordered region; changed region gets the accent border, so change is read before content (severity: none)
  - Yablonski — Fitts: marks 28px with a 36px rail hit-zone; glyph 36px (severity: none)
  - Yablonski — Jakob: media-player scrubber is a known idiom; zero learning cost (severity: none)
- Strengths: clearest status, largest targets, reuses the locked component language, degrades gracefully to one column.
- Risks: badges (medium, removable); strip width with many participants (auto-fill handles it, but 8+ holders become two rows: low).

### Variant: B — Segmented story bar + entity ledger

- Verdict: supports-with-reservation
- Framework signals:
  - Nielsen #1: segments show progress but not identity — which step you are on needs the sentence or a hover caption (severity: low)
  - Nielsen #6 recognition over recall: the trail shows past and future states dimmed, so the reader never has to remember what came before — the strongest cue of the round for "living through the process" (severity: none, strength)
  - Nielsen #7 flexibility: trail steps are shortcuts to the exact step where an entity changed (severity: none)
  - Garrett — structure: entity-first grouping is a second information architecture next to the element tree; good for the question "where is the order now", weaker for "what does OrdersDB hold" (severity: low)
  - Gestalt — continuity: the arrowed trail reads as one line; future items at 40% opacity are perceived as "not yet" (severity: none)
  - Yablonski — Fitts: segments 1/N wide (fine ≤ 8 steps, poor beyond), trail buttons 24px (severity: medium)
  - Yablonski — Hick: with many entities the ledger becomes a list of lists (severity: low on toy; medium on real systems)
- Strengths: the entity trail; novelty; compact rows.
- Risks: target sizes (medium); hover-only caption (low); scales with entities, not with participants.

### Arbitration hint

- Scorecard winner (A) and framework verdicts agree: A supports, B supports-with-reservation. The frameworks also agree on the fix: A's one medium issue (badges, Nielsen #8) disappears by dropping badges; B's medium issue (Fitts) stays if B is the player.
- Recommended direction: **A as the player and the default state view** (rail + strip + inspector section, badges dropped), **with B's entity trail as a second mode of the strip** ("by participant / by entity"). The trail keeps 28px step buttons and the full-width row layout from the strip, which removes B's Fitts issue. C is not pursued; its state dot on the timeline is already in A.

## Conflict arbitration (round 2)
- Scorecard outcome: A > B > C
- UX framework outcome: A supports (without badges), B supports-with-reservation, C not assessed as a finalist
- Conflict detected: no
- User arbitration choice: pending at the approval gate (options: lock the hybrid A + B-trail without badges; keep badges; lock A alone; lock B)

## Convergence status
- Round cap: 3 default
- Remaining rounds: 1
- Continue to next round: no, unless the user picks "one more constrained round" at the gate
