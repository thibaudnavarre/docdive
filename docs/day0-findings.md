# Day-0 value findings — assumption A8

Tests brief assumption **A8**: "The Day-0 output of `docdive init` on raw brownfield Mermaid (render + `appearsIn` + scenarios + report, no conventions applied) helps an agent do a real documentation task better than the agent does on its own." It is a new question next to A1, which D11 closed ("gate passed, assumption not validated"; no re-gate, no re-run). This document **pre-registers** the protocol and gate, then records the results. Plan: `.cor/plan_17_a8_day0_value.md`.

## Pre-registration (written before any agent run)

### Question

Given a held-out brownfield docs repo and a rename-impact task on one Mermaid node ID, does a fresh agent that receives the `docdive context <id>` bundle find the set of diagrams to edit at least as completely as a fresh agent that only has the repo and grep, without adding wrong locations that come from the bundle?

### Corpus (held out, pinned)

`cloudflare/cloudflare-docs`, path `src/content/docs`, SHA `bb8a4aa14e222f5796c6038e64d365a0fcd3cede` (added to `scripts/fetch-corpus.sh` as `cloudflare`). Never used to build or tune the indexer.

Census that led to it (2026-11-16, fenced ```` ```mermaid ```` blocks only, the only form docdive reads): cloudflare-docs 139 files / 201 blocks / 19 `sequenceDiagram`; open-telemetry/opentelemetry.io `content/en` 21 / 52 / 4; kubernetes/website, argoproj/argo-workflows, n8n-io/n8n-docs, grafana/grafana, immich-app/immich, getsentry/sentry-docs ≤ 6 files each. Two repos proposed by the owner (FabsBoul/TID-Factory, morluto/rea) had zero fenced blocks.

`docdive init corpus/cloudflare/src/content/docs`: 7194 docs; 201 blocks (190 supported, 1 unsupported-type, 10 parse-failed); 171 flowcharts + 19 sequence diagrams indexed; 269 elements in ≥ 1 diagram, 145 cross-linked (37.5 %); 19 inferred scenarios.

### Element selection rule

Top 3 global IDs of ≥ 3 characters ranked by **number of distinct files** in `appearsIn`, ties broken by diagram count, then ID order. (The hub-bundle order by diagram count is dominated by `tunnel-health-checks.mdx`, one file with 12 near-identical diagrams; six of its IDs tie at 12.) Computed from `docdive index` before any labeling:

| rank | element | files | diagrams | note |
| --- | --- | --- | --- | --- |
| 1 | `Cloudflare` | 8 | 21 | mostly `subgraph Cloudflare`; also a bare node |
| 2 | `User` | 6 | 9 | flowchart node and sequence participant; 3 inferred scenarios |
| 3 | `cloudflare` | 3 | 12 | case variant of #1; `parent: Tunnel Healthcheck Probe` |

`cloudflare` next to `Cloudflare` is a deliberate identity test: the bundles must not mix the two.

### Task (identical text for both arms, `<DIR>` and `<ID>`/`<NEW>` substituted)

> You are working in the folder `<DIR>`, a copy of a documentation site (Markdown/MDX, about 7200 files). The Mermaid identifier `<ID>` is going to be renamed to `<NEW>`. List every fenced ```` ```mermaid ```` block in which `<ID>` is used as a node ID, subgraph ID or sequence-diagram participant ID. Do not count uses as label text, edge text, message text, accTitle/accDescr, class names or prose, and do not count other identifiers that merely contain `<ID>` (such as `<ID> account` or `<ID>_2`). Matching is case-sensitive. Do not edit any file. Do not read or write anything outside `<DIR>`. Reply with only a JSON array of strings, each of the form `relative/path.mdx#n`, where `n` is the 0-based ordinal of the ```` ```mermaid ```` fence within that file, counting every mermaid fence in the file from the top.

Arm A appends:

> A tool called docdive was run over this folder with no configuration. Its context bundle for `<ID>` is pasted below. You may use it as is or verify it.
>
> ```
> <output of `docdive context <ID> --folder <DIR>`>
> ```

Renames: `Cloudflare` → `CloudflareNetwork`, `User` → `EndUser`, `cloudflare` → `cf_network`.

### Arms and runs

- **Arm A:** repo copy + bundle. **Arm B:** repo copy only (grep allowed, nothing forbidden inside `<DIR>`).
- One fresh isolated `general-purpose` subagent per arm per element = 6 runs, harness default model, in parallel. Each run gets its own temp copy of `src/content/docs` outside this project. Wall time per run recorded.
- Raw replies kept under `docs/day0-runs/`.

### Ground truth (labeled by the owner before the runs)

Rule: every fenced mermaid block where `<ID>` is a node ID, subgraph ID or participant ID, found by whole-word, case-sensitive grep inside fences after stripping label/edge/quoted text, then read by hand. Keyed `file#n` exactly as docdive's diagram IDs (0-based over all mermaid fences of the file, parse-failed ones included).

**`Cloudflare` — 22 blocks, 9 files**

- `cloudflare-for-platforms/cloudflare-for-saas/saas-customers/how-it-works.mdx#0`, `#1`
- `cloudflare-one/networks/connectors/cloudflare-wan/reference/traffic-steering.mdx#0`, `#1`, `#2`
- `cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/client-architecture.mdx#0`
- `cloudflare-wan/reference/traffic-steering.mdx#0`, `#1`, `#2`
- `dns/zone-setups/partial-setup/dns-resolution.mdx#0`, `#1`
- `magic-transit/reference/traffic-steering.mdx#0`, `#1`, `#2`
- `ssl/post-quantum-cryptography/index.mdx#0`
- `ssl/troubleshooting/too-many-redirects.mdx#1`, `#2`, `#3`, `#4`, `#5`
- `style-guide/documentation-content-strategy/component-attributes/images-and-diagrams.mdx#0`, `#1`

Excluded on reading: `subgraph Cloudflare account` / `Cloudflare zone 1|2` (`dns/internal-dns/index.mdx#0`, `dns-resolution.mdx#2`, `#3`), participants `Cloudflare One Client` / `Cloudflare Access` (`cloudflare-one/integrations/service-providers/custom.mdx#0`), alias `S as Cloudflare Stream`, and ~70 blocks where the word is label, edge or acc text.

**`User` — 9 blocks, 6 files**

- `cloudflare-one/access-controls/ai-controls/linked-apps.mdx#0`, `#1`
- `cloudflare-one/access-controls/applications/linked-app-token.mdx#0`, `#1`
- `data-localization/geo-key-manager.mdx#0` (`participant User as End user`)
- `learning-paths/prevent-ddos-attacks/concepts/ddos-prevention.mdx#1`
- `reference-architecture/diagrams/security/fips-140-3.mdx#0` (`User((User/Client))`)
- `workers/static-assets/direct-upload.mdx#0`, `#1`

Excluded: participant `User in US` (`data-localization/regional-services/index.mdx#0`), `subgraph User profile`, alias `App as User Worker`, message and label text.

**`cloudflare` — 13 blocks, 4 files**

- `cloudflare-one/networks/connectors/cloudflare-wan/reference/tunnel-health-checks.mdx#0`–`#3`
- `cloudflare-one/traffic-controls/egress-policies/egress-cloudflared.mdx#0` (`subgraph cloudflare[Cloudflare]`)
- `cloudflare-wan/reference/tunnel-health-checks.mdx#0`–`#3`
- `magic-transit/reference/tunnel-health-checks.mdx#0`–`#3`

Excluded: `classDef cloudflare` (`reference-architecture/diagrams/security/fips-140-3.mdx#0`), `cdn.cloudflare.net` / `cloudflare-ech.com` in labels.

Non-vacuity holds: every ground truth spans ≥ 2 files.

### Metrics and gate

Per element and arm: recall = |reply ∩ truth| / |truth|; precision = |reply ∩ truth| / |reply|; wall time.

**Pass** if both hold:

1. Arm A recall ≥ arm B recall on ≥ 2 of the 3 elements.
2. Arm A reports no false positive that is present in the bundle's `appearsIn` (a bundle-induced error). False positives the agent adds on its own are recorded but do not fail the gate.

**Fail** otherwise. On fail nothing ships; brief A8 records the result and §8 "If wrong" applies.

### Known limits, stated in advance

- One corpus, one model, one run per arm per element; a 2-of-3 gate on three elements is weak evidence either way.
- The task rewards `appearsIn` only; `parent`, `children`, `scenarios` and the adoption report are not exercised.
- The 10 parse-failed blocks are part of Day-0 reality: any ground-truth block docdive could not parse counts against arm A if the agent trusts the bundle.
- Subagent transcripts are final replies only (as in A4); the "do not read outside `<DIR>`" rule is enforced by prompt, not by sandbox.
- The ground truth was labeled by the person who built the indexer, after seeing `docdive init` output (the selection rule needed it). The label rule above was fixed before reading individual hits.

## Results (2026-11-16)

Six fresh `general-purpose` subagents, harness default model, run in parallel, one per arm per element, each in its own copy of the corpus under `/tmp/a8/run-*/docs`. Raw replies and the ground truth are in [`day0-runs/`](./day0-runs/). No run modified its copy (`diff -rq` against the pinned corpus: 0 differences for all six).

| element | arm | reply | truth | recall | precision | bundle-induced FP | wall time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Cloudflare` | A (bundle) | 22 | 22 | 1.00 | 1.00 | 0 | 88 s |
| `Cloudflare` | B (grep) | 22 | 22 | 1.00 | 1.00 | — | 167 s |
| `User` | A (bundle) | 9 | 9 | 1.00 | 1.00 | 0 | 53 s |
| `User` | B (grep) | 9 | 9 | 1.00 | 1.00 | — | 68 s |
| `cloudflare` | A (bundle) | 13 | 13 | 1.00 | 1.00 | 0 | 35 s |
| `cloudflare` | B (grep) | 13 | 13 | 1.00 | 1.00 | — | 101 s |

### Verdict

**Gate passed, literally; value shown is speed, not correctness.**

1. Arm A recall ≥ arm B recall on 3 of 3 elements — but only as ties: both arms reached 1.00 everywhere. The bundle did not find anything the grep-only agent missed.
2. No bundle-induced false positive. The `Cloudflare` / `cloudflare` identity test was clean: neither bundle mixed the two, and neither arm-A agent did.

What the bundle did change is time: arm A finished in 35–88 s against 68–167 s for arm B (about 1.5–2.9× faster), with the biggest gain on the element with the most label-text noise (`Cloudflare`, 107 fenced hits for 22 true ones).

### What the bundle got wrong, and how the agents handled it

The `appearsIn` list was **incomplete on 2 of the 3 elements**: it missed `client-architecture.mdx#0` (`Cloudflare`) and `egress-cloudflared.mdx#0` (`cloudflare`). Both blocks are among the corpus's 10 `parse-failed` blocks; 8 of those 10 fail on bidirectional or crossed arrows (`<-->`, `<-.->`, `<-. text .->`, `---x`), which the flowchart extractor does not recognise. Both arm-A agents verified the bundle against the files, found the missing block, and added it. So the agents treated the bundle as a hint, as the prompt allowed, and Day-0 output did not propagate its own gap into the result. Had the agents trusted the bundle as-is, arm A recall would have been 0.95 (`Cloudflare`) and 0.92 (`cloudflare`) against arm B's 1.00, leaving only the `User` tie, and condition 1 (≥ 2 of 3) would have failed.

### Reading

- The honest Day-0 claim this supports is narrow: on a rename-impact task, the first-run `appearsIn` list is a **correct-but-incomplete shortcut** that an agent reaches the same answer with, faster. It is not a source of truth, and the brief should not call it one.
- The agents' own grep was good enough to reach 100 % without help on a 7200-file corpus. The task was likely too easy to separate the arms on correctness; a task that needs cross-diagram structure (`parent`, `scenarios`) rather than a flat list is where a difference could show, and was out of scope here.
- Follow-up candidate (not part of this test): accept bidirectional/crossed arrows in `flowchart.ts`. It would have closed both bundle gaps in this corpus and 8 of its 10 parse failures.

### Limits (in addition to those stated in advance)

- Ties on all three elements make condition 1 vacuous in the direction that matters; the gate should have required strictly better recall on at least one element, or measured time as the primary metric. Recorded, not re-gated.
- Wall time comes from the harness's elapsed counter for one run each; no repetition, and the six runs shared the machine.
- `images-and-diagrams.mdx#0` is a ```` ```mermaid ```` fence nested inside a ```` ````md ```` example block in the style guide; it never renders. Both arms and the ground truth counted it, as the task text said to count every fence, so it does not affect the comparison, but a "rendered diagrams only" reading would drop it from all three.
- One model, one corpus, one task family, one run per cell.
