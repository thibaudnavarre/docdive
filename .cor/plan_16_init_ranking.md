# COR Plan — init --agent pair ranking

## Context

Reorder the `init --agent` candidate pairs so that noisy pairs (same-file clusters, instance-suffix variants) sink below likely real merges, then validate the new order with a pre-registered blind labeling test on the 3 pinned corpora. Closes (or updates) the brief §11 open question "Ranking of `init --agent` pairs".

### Current state

- `renderAgentPrompt` in `packages/docdive/src/agent-prompt.ts` keeps `fuzzy-id-candidate` diagnostics of kind `edit-distance`, sorts by `confidence` desc then `a`, `b`, and shows the top `MAX_PAIRS = 20`. File lists per ID come from `appearsIn` (`files()` helper).
- Pair confidence comes from `nearMiss` in `packages/docdive/src/fuzzy.ts` (shared with lint).
- Baseline top 20 (run `npx tsx packages/docdive/src/cli.ts init corpus/<path> --agent` from the repo root):
  - temporal (`corpus/temporal/docs`, 59 pairs): ~15/20 are `*PRIM` / `CRC*` region codes and `ProxyA/ProxyB`, mostly from one file; only `Workflow/Workflows` looks like a real merge.
  - gitlab (`corpus/gitlabhq/doc`, 171 pairs): ~11/20 are `BulkImports::*Worker{A,B,A1,BB}`, plus `GitLab groups/GitLabGroupA..D`, `GitLab users/GitLabUserA..`, `child pipeline A/B`.
  - posthog (`corpus/posthog/contents`, 7 pairs): mostly plausible (`Session/Sessions`, `Worker/Workers`).
- Corpora are git-ignored, pinned to the SHAs in `docs/brownfield-findings-2.md`: gitlabhq `d7b9a617…`, temporal `882a9dec…`, posthog `bdf3ff26…`.

### Decisions locked in Think

| Subject | Decision | Why |
| --- | --- | --- |
| Noise signals | Same single file AND instance-suffix variants | Baseline shows both; suffix noise (gitlab) is not same-file only |
| Same-file pair | Both IDs appear in exactly one file, and it is the same file | Brief §11: two IDs that only ever share one diagram are rarely one concept |
| Instance suffix | One ID = the other + appended uppercase letters/digits (glued `ProxyA`, `WorkerBB`, `WorkerA1`), or a single uppercase letter/digit after space/`_`/`-` (`child pipeline A`) | Matches the observed noise |
| Plurals | Singular/plural alone is never a suffix variant (`Worker/Workers` stays up) | Plurals are the most common real merge |
| Mixed case | One side suffixed, other side plural (`GitLab groups/GitLabGroupA`) counts as suffix variant | Instance of a collection, not the same concept |
| Treatment | Down-rank only: clean pairs first, then noisy pairs, each by the existing order | Never hide a candidate from the agent |
| Surface | `init --agent` prompt only | Diagnostics, adoption report, lint unchanged |
| Shown confidence | Raw `nearMiss` confidence, order by new rank | Number keeps one meaning across lint/report/prompt |
| Gate | Pre-registered blind labeling (see Acceptance) | Avoid judging the rule by eye after the fact |
| Labeler | Agent labels from diagram context, user reviews before verdict | Cheap labels, human check on judgement |
| Failure | Revert code + tests, keep `docs/ranking-findings.md`, leave §11 open with new evidence | No unvalidated signal change ships |
| Release | CHANGELOG `Unreleased` entry only (on pass) | No release in this increment |

### Scope

**In scope:** ranking in `agent-prompt.ts`, focused CLI tests, `docs/ranking-findings.md`, brief §11, CHANGELOG, one line in `packages/docdive/README.md` and `docs/architecture/docdive-cli.md`.

**Out of scope:** changing `nearMiss`/`proposeFuzzyIds` or confidence values, the adoption report fuzzy list, lint severity, dropping pairs, `MAX_PAIRS`, a release, new corpora.

### Invariants

- `fuzzy-id-candidate` diagnostics, `index.json`, report and lint output are byte-identical.
- Existing `init --agent` tests keep passing (`aaaaaaNode/aaaaaaNodes` plural pairs are not down-ranked; 20-pair cap and "N more pairs omitted").
- Prompt order is deterministic.

### Acceptance criteria

- Pre-registration written in `docs/ranking-findings.md` before the code change.
- Labels: per corpus, the union of old and new top 20, shuffled with no origin marker, labeled merge/keep by the agent and reviewed by the user.
- Pass if the new top 20 has more `merge` pairs than the old on gitlab and temporal, not fewer on posthog, and no labeled `merge` pair from the old top 20 drops out of the new top 20.
- On pass: brief §11 question closed, CHANGELOG `Unreleased` entry, README + architecture line. On fail: code reverted, findings kept, §11 updated and open.
- Checks green: `npm run typecheck`, `npm run lint`, `npm test`, `uvx ruff check . --fix`.

## Tasks

- [x] T01: Write the pre-registration in `docs/ranking-findings.md`: both rules, corpora + SHAs + commands, blind labeling protocol, threshold, failure action, and the current top 20 per corpus
- [x] T02: Implement the down-rank in `packages/docdive/src/agent-prompt.ts` (same-file pair; instance-suffix pair incl. spaced and mixed-plural cases; plurals excluded; clean pairs first then noisy, each by existing order; raw confidence shown)
- [x] T03: Add focused tests in `packages/docdive/src/cli.test.ts`: same-file pair ranked last, suffix pair ranked last (glued, spaced, mixed plural), plural pair not down-ranked, raw confidence kept [unit]
- [x] T04: Run the new ranking on the 3 corpora, build the shuffled union of old + new top 20 per corpus without origin, label each pair merge/keep from diagram context, record in `docs/ranking-findings.md`
- [x] T05: User reviews the labels before the verdict [UAT]
- [x] T06: Apply the pre-registered threshold and record the verdict in `docs/ranking-findings.md`; on fail, revert T02/T03
- [x] T07: Docs per verdict: pass → close brief §11 question, CHANGELOG `Unreleased` entry, one line in `packages/docdive/README.md` and `docs/architecture/docdive-cli.md`; fail → update brief §11 with the new evidence, keep it open
