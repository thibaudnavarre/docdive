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
