# COR Plan — init --agent normalization prompt

## Context

Brief §6.1 (`docs/product-brief.md`) promises `docdive init [--agent]`: "`--agent` emits a single normalization prompt for the user's agent." It is the last unbuilt v1 CLI item. Add it, scoped to fuzzy ID pairs.

### Current state

- `init` (`packages/docdive/src/run.ts`, `command === "init"`) prints the adoption report (`buildReport` / `renderReportMarkdown` in `packages/docdive/src/report.ts`) or `--json`. No `--agent` flag; no `init` test in `cli.test.ts`.
- Fuzzy pairs are `index.diagnostics` with `rule: "fuzzy-id-candidate"` (`a`, `b`, `kind`, `confidence`; built by `proposeFuzzyIds` in `fuzzy.ts`). The report keeps only 10 mixed-kind pairs in `fuzzy.top`, so the prompt needs the full list.
- `lint --fix` (`fix.ts`, `planRenames`) already merges `normalized` pairs mechanically; only `edit-distance` pairs need judgement.
- Files where an ID appears: `index.elements[id].appearsIn` (`path#n`).
- `skill/conventions.md` (34 lines) already ships in the npm package (`files: ["dist", "skill"]`).
- `lint --docs <folder>` resolves against cwd, like `init <folder>`, so the folder as typed works in both.
- Measured `edit-distance` pairs: gitlabhq 172, temporal 59, posthog 7, toy 0. Temporal mixes real drift (`Workflow`/`Workflows`) and distinct concepts (`CPUPool`/`GPUPool`).

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Prompt content | Fuzzy pairs only | Smallest useful step; parents, local IDs, scenarios, `src` deliberately excluded |
| Which pairs | `edit-distance` kind only; prompt tells the agent to run `docdive lint --fix --docs <folder>` first | `--fix` already merges `normalized` pairs |
| Cap | Top 20 by confidence, then "N more omitted" | gitlabhq has 172 pairs |
| Per pair | IDs + confidence + files where each appears | Agent needs locations to judge |
| Agent rule | Merge only if same concept (check labels/diagrams), else leave; report each decision | Many pairs are false positives |
| Conventions | Embed `conventions.md` text in the prompt | Single self-contained prompt |
| Output | Prompt only on stdout, replaces the report | "A single prompt" (brief) |
| Empty | One line "nothing to normalize", exit 0 | No empty prompt |
| `--agent --json` | Usage error, exit 2 | Avoid an undefined combination |

### Scope

**In scope:** `init --agent` prompt, CLI tests, docs/CHANGELOG/brief status.
**Out of scope:** other prompt sections (parents, local IDs, scenario participants, `src`, lint loop), other v1 gaps (click-to-source, ER diagrams, breadcrumb, `lint --fix` for `unresolved-participant`), MCP.

### Invariants

- `init` without `--agent` (Markdown and `--json`) is unchanged.
- No doc file is written; the tool stays deletable (D9).

### Acceptance criteria

- CLI tests on a temp-dir fixture: prompt content, cap + omitted count, empty case, `--agent --json` exit 2.
- Run on `fixtures/toy` and corpus temporal + gitlabhq; owner reads the prompt and says yes.
- Checks green (`npm run typecheck`, `npm run lint`, `npm test`, `uvx ruff check . --fix`).

## Tasks

- [x] T01: Add the `--agent` prompt renderer from the index: embedded `conventions.md` text, the `docdive lint --fix --docs <folder>` step, top 20 `edit-distance` pairs by confidence (IDs, confidence, files where each appears), "N more omitted" line, the same-concept merge rule and "report each decision"; one line "nothing to normalize" when there are no pairs
- [x] T02: Wire `init --agent` in `run.ts`: prompt only on stdout, exit 0; `--agent --json` → usage error (exit 2); load `skill/conventions.md` from the installed package; update `USAGE`
- [x] T03: CLI tests in `cli.test.ts` on a temp-dir fixture: prompt content, cap + omitted count, empty case, `--json` conflict [unit]
- [x] T04: Document `init --agent` in `packages/docdive/README.md` and `docs/architecture/docdive-cli.md`; CHANGELOG `Unreleased` entry; update brief §6.1 / §10 status lines
- [x] T05: Run on `fixtures/toy` and corpus temporal + gitlabhq; owner reads the prompt and says yes/no [UAT]
