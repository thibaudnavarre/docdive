# Ranking spike — `init --agent` pair order

Tests the open question in [product-brief.md](./product-brief.md) §11, "Ranking of `init --agent` pairs". This document **pre-registers** the rule and the gate, then records the results.

## Pre-registration (2026-11-16)

Written and frozen **before any code change**. Results are reported against this section, not by editing it. Any later change must be appended as a dated amendment, never in place.

### Question

Does down-ranking same-file pairs and instance-suffix pairs in the `init --agent` prompt put more real merges in the top 20 shown to the agent?

### Rule (prompt order only)

A pair is **noisy** when either holds:

1. **Same-file:** both IDs appear in exactly one file each, and it is the same file.
2. **Instance-suffix:** one ID equals the other plus appended uppercase letters/digits (glued: `ProxyA`, `WorkerBB`, `WorkerA1`), or one ID is the other plus a single uppercase letter/digit after a space, `_` or `-` (`child pipeline A`). A pair where one side is such an instance and the other side is a plural of the base (`GitLab groups` / `GitLabGroupA`) is also noisy. Singular/plural alone is never noisy.

Order: clean pairs first, then noisy pairs, each group by the existing order (`confidence` desc, then `a`, `b`). No pair is dropped. The shown confidence stays the raw `nearMiss` value. `fuzzy-id-candidate` diagnostics, `index.json`, report and lint are unchanged. `MAX_PAIRS` stays 20.

### Corpora

Git-ignored, pinned (see [brownfield-findings-2.md](./brownfield-findings-2.md)):

| Corpus | Path | SHA | Pairs |
| --- | --- | --- | --- |
| temporal | `corpus/temporal/docs` | `882a9dec…` | 59 |
| gitlabhq | `corpus/gitlabhq/doc` | `d7b9a617…` | 171 |
| posthog | `corpus/posthog/contents` | `bdf3ff26…` | 7 |

Command (repo root): `npx tsx packages/docdive/src/cli.ts init <path> --agent`.

### Blind labeling protocol

1. Per corpus, take the union of the old top 20 and the new top 20.
2. Shuffle it and strip any marker of which list(s) a pair came from.
3. Label each pair `merge` (same concept, would unify) or `keep` (different concepts) from the labels and diagrams in the listed files. The agent labels; the user reviews every label before the verdict.
4. Labels are final once the user has reviewed them; they are not edited after the verdict is computed.

### Gate

Pass only if all hold, counting `merge` labels:

- gitlabhq: new top 20 has **more** `merge` pairs than the old top 20.
- temporal: new top 20 has **more** `merge` pairs than the old top 20.
- posthog: new top 20 has **not fewer** `merge` pairs than the old top 20.
- No `merge`-labeled pair of the old top 20 is absent from the new top 20 (any corpus).

### On failure

Revert the code and tests, keep this document, leave §11 open with the new evidence. No unvalidated signal change ships.

### Baseline: current top 20 (old order)

**temporal** (59 pairs)

1. `Workflow` / `Workflows` (0.71)
2. `CPUPool` / `GPUPool` (0.69)
3. `AFPRIM` / `APRIM` (0.67)
4. `AFPRIM` / `FPRIM` (0.67)
5. `AFPRIM` / `HFPRIM` (0.67)
6. `APRIM` / `IAPRIM` (0.67)
7. `Check` / `FCheck` (0.67)
8. `CPRIM` / `ICPRIM` (0.67)
9. `CRCPEP` / `CRCSEP` (0.67)
10. `CRCPNS` / `CRCSNS` (0.67)
11. `CRCSEC` / `CRCSEP` (0.67)
12. `FPRIM` / `HFPRIM` (0.67)
13. `HEPRIM` / `HFPRIM` (0.67)
14. `HEPRIM` / `NEPRIM` (0.67)
15. `IAPRIM` / `ICPRIM` (0.67)
16. `IAPRIM` / `IHPRIM` (0.67)
17. `ICPRIM` / `IHPRIM` (0.67)
18. `Proxy` / `ProxyA` (0.67)
19. `Proxy` / `ProxyB` (0.67)
20. `ProxyA` / `ProxyB` (0.67)

**gitlabhq** (171 pairs)

1. `BulkImports::RelationBatchExportWorker` / `BulkImports::RelationBatchExportWorkerA` (0.78)
2. `BulkImports::ExportRequestWorker` / `BulkImports::ExportRequestWorkerB` (0.77)
3. `BulkImports::PipelineBatchWorker` / `BulkImports::PipelineBatchWorkerA` (0.77)
4. `BulkImports::PipelineWorker` / `BulkImports::PipelineWorkerA` (0.77)
5. `EE::MergeRequests::ReloadMergeHeadDiffService` / `MergeRequests_ReloadMergeHeadDiffService` (0.76)
6. `Version application` / `Versions Application` (0.76)
7. `External Services` / `External service` (0.75)
8. `BulkImports::PipelineWorker` / `BulkImports::PipelineWorkerA1` (0.74)
9. `BulkImports::PipelineWorker` / `BulkImports::PipelineWorkerBB` (0.74)
10. `BulkImports::PipelineWorkerA` / `BulkImports::PipelineWorkerBB` (0.74)
11. `BulkImports::PipelineWorkerA1` / `BulkImports::PipelineWorkerBB` (0.74)
12. `child pipeline A` / `child pipeline B` (0.74)
13. `EE::MergeRequests::CreateService` / `MergeRequests::CreateService` (0.74)
14. `Notification` / `notifications` (0.74)
15. `GitLab groups` / `GitLabGroupA` (0.73)
16. `GitLab groups` / `GitLabGroupB` (0.73)
17. `GitLab groups` / `GitLabGroupC` (0.73)
18. `GitLab groups` / `GitLabGroupD` (0.73)
19. `GitLab users` / `GitLabUserA` (0.73)
20. `GitLab users` / `GitLabUserB` (0.73)

**posthog** (7 pairs)

1. `ingestion_warnings1` / `ingestion_warnings_mv1` (0.72)
2. `ingestion_warnings2` / `ingestion_warnings_mv2` (0.72)
3. `Session` / `Sessions` (0.70)
4. `Worker` / `workers` (0.69)
5. `Worker` / `Workers` (0.69)
6. `Trace` / `traces` (0.67)
7. `SessionSum` / `Sessions` (0.64)

Posthog has 7 pairs, so old and new top 20 hold the same pairs: its gate row can only tie, which is expected.

## Labels (2026-11-16)

Method: for each corpus, union of old and new top 20 (temporal 22 pairs, gitlabhq 35, posthog 7), shuffled with a fixed seed, origin not recorded in the table. Labeled by the agent from the labels, edges and files in the `docdive index` output.

Limits: the labeler wrote the rule and had seen both lists, so the labeling is blind to origin only in the table, not in the labeler's head. Pairs labeled `ambiguous` are judgement calls the user must settle in the review (T05); they count as `keep` unless the review turns them into `merge`.

**temporal**

| # | Pair | Label | Reason |
| --- | --- | --- | --- |
| 1 | `IAPRIM` / `IHPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 2 | `CRCPNS` / `CRCSNS` | keep | primary vs secondary namespace |
| 3 | `FPRIM` / `HFPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 4 | `AFPRIM` / `FPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 5 | `CPRIM` / `ICPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 6 | `ICPRIM` / `IHPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 7 | `AFPRIM` / `HFPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 8 | `Proxy` / `ProxyB` | keep | same as ProxyA |
| 9 | `Proxy` / `ProxyA` | keep | ProxyA is one per-upstream proxy, Proxy the generic one |
| 10 | `APRIM` / `IAPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 11 | `Approver` / `approval` | keep | actor vs pattern doc id |
| 12 | `Workflow` / `Workflows` | merge | `Workflows` is the plural node of the same concept (rate-limiting diagram) |
| 13 | `Check` / `FCheck` | keep | two different decision nodes in two diagrams |
| 14 | `CPUPool` / `GPUPool` | keep | different pools |
| 15 | `AFPRIM` / `APRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 16 | `HEPRIM` / `NEPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 17 | `CRCPEP` / `CRCSEP` | keep | primary vs secondary endpoint |
| 18 | `HEPRIM` / `HFPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 19 | `CRCSEC` / `CRCSEP` | keep | region vs endpoint |
| 20 | `ProxyA` / `ProxyB` | keep | two distinct per-upstream proxies |
| 21 | `IAPRIM` / `ICPRIM` | keep | distinct region/pattern diagrams of the same template (one diagram each) |
| 22 | `Complete` / `Complex` | keep | unrelated words (saga end state vs polling variant) |

**gitlabhq**

| # | Pair | Label | Reason |
| --- | --- | --- | --- |
| 1 | `deploy_a` / `deploy_b` | keep | two parallel jobs |
| 2 | `BulkImports::PipelineWorker` / `BulkImports::PipelineWorkerA` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |
| 3 | `External Services` / `External service` | keep | a grouping box vs one external service actor |
| 4 | `Pipeline` / `pipeline_a` | keep | generic pipeline vs pipeline A in a merge-train example |
| 5 | `GitLab groups` / `GitLabGroupB` | keep | collection vs one example |
| 6 | `Clients` / `client` | keep | group of client types vs one client |
| 7 | `child pipeline A` / `child pipeline B` | keep | two sibling child pipelines |
| 8 | `BulkImports::PipelineBatchWorker` / `BulkImports::PipelineBatchWorkerA` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |
| 9 | `GitLab API` / `GitlabApp` | keep | API vs application |
| 10 | `GitLabApp` / `GitlabAPI` | keep | application vs Pages API |
| 11 | `GitLab groups` / `GitLabGroupC` | keep | collection vs one example |
| 12 | `BulkImports::PipelineWorker` / `BulkImports::PipelineWorkerBB` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |
| 13 | `deploy` / `deploy_b` | keep | stage vs job |
| 14 | `EE::MergeRequests::ReloadMergeHeadDiffService` / `MergeRequests_ReloadMergeHeadDiffService` | ambiguous | EE:: extension vs the base service spelled with `_` |
| 15 | `BulkImports::PipelineWorkerA` / `BulkImports::PipelineWorkerBB` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |
| 16 | `BulkImports::RelationBatchExportWorker` / `BulkImports::RelationBatchExportWorkerA` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |
| 17 | `EE::MergeRequests::CreateService` / `MergeRequests::CreateService` | ambiguous | EE:: extension vs base service |
| 18 | `Service` / `Services` | keep | one specific service vs a group box |
| 19 | `BulkImports::PipelineWorkerA1` / `BulkImports::PipelineWorkerBB` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |
| 20 | `Client` / `Clients` | keep | one client node vs a group of client types |
| 21 | `deploy` / `deploy_a` | keep | stage vs job |
| 22 | `Subgroup A1` / `subgroup1` | keep | different examples |
| 23 | `Notification` / `notifications` | keep | `notifications` has no diagram appearance |
| 24 | `subGroup` / `subgroups` | keep | `subgroups` has no diagram appearance |
| 25 | `Analyze` / `Analyzer` | keep | workflow step vs component |
| 26 | `GitLab users` / `GitLabUserA` | keep | collection vs one example user |
| 27 | `GitLab users` / `GitLabUserB` | keep | collection vs one example |
| 28 | `GitLab groups` / `GitLabGroupD` | keep | collection vs one example |
| 29 | `Pipeline` / `pipeline_b` | keep | same |
| 30 | `BulkImports::PipelineWorker` / `BulkImports::PipelineWorkerA1` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |
| 31 | `Version application` / `Versions Application` | merge | same versions.gitlab.com application in two docs |
| 32 | `subgroup` / `subgroups` | keep | `subgroups` has no diagram appearance |
| 33 | `GitLab groups` / `GitLabGroupA` | keep | collection vs one example group |
| 34 | `GitLab API` / `GitLabApp` | keep | API vs application |
| 35 | `BulkImports::ExportRequestWorker` / `BulkImports::ExportRequestWorkerB` | ambiguous | parallel instance of the same worker inside one diagram (alias node); merging would collapse the diagram |

**posthog**

| # | Pair | Label | Reason |
| --- | --- | --- | --- |
| 1 | `Worker` / `Workers` | merge | both are the background worker tier in two docs |
| 2 | `SessionSum` / `Sessions` | merge | both labeled "Session Summaries" in two docs |
| 3 | `ingestion_warnings1` / `ingestion_warnings_mv1` | keep | table vs materialized view |
| 4 | `Trace` / `traces` | keep | `traces` has no diagram appearance |
| 5 | `Worker` / `workers` | merge | same |
| 6 | `Session` / `Sessions` | keep | observability session vs session summaries product |
| 7 | `ingestion_warnings2` / `ingestion_warnings_mv2` | keep | table vs materialized view |

## Verdict (2026-11-16)

Labels reviewed and accepted by the user as written (`ambiguous` = `keep`).

| Corpus | Old top 20 merges | New top 20 merges | Required | Result |
| --- | --- | --- | --- | --- |
| temporal | 1 | 1 | new > old | fail |
| gitlabhq | 1 | 1 | new > old | fail |
| posthog | 3 | 3 | new ≥ old | pass |
| Dropped old merge | none | | none | pass |

**Gate: fail.** The down-rank did what it was designed for (it removed the 11 `BulkImports::*Worker{A,B,BB,A1}` aliases and the same-file `*PRIM` / `CRC*` clusters from the top 20), but the slots it freed went to other `keep` pairs (`Approver/approval`, `Complete/Complex`, `Subgroup A1/subgroup1`, `GitLab API/GitlabApp`, plural generics). The real merges (`Workflow/Workflows`, `Version application/Versions Application`) were already in the old top 20.

Reading: the corpora hold very few real merges (1, 1 and 3), and the noisy pairs are not what hides them. The top-20 cap is not the bottleneck on these three corpora; pair precision is low everywhere (≤ 5 %, ≤ 3 %, 43 %). With `ambiguous` counted as `merge` the new list would score lower (the BulkImports aliases drop out), so the verdict does not depend on the review.

Action per pre-registration: code and tests reverted, this document kept, brief §11 left open with this evidence. No change shipped.
