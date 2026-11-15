import { resolveParticipant, type Index, type Scope } from "./model.js";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export interface HubBundle {
  id: string;
  diagrams: number;
  /** Distinct node labels across the diagrams where the ID appears, with counts. */
  labels: { label: string | null; count: number }[];
  appearsIn: string[];
  parent: string | null;
  parentCandidates: string[];
  children: string[];
  scenarios: string[];
}

export interface Report {
  folder: string;
  counts: {
    docs: number;
    blocks: number;
    byStatus: Index["stats"]["byStatus"];
    byType: Record<string, number>;
    diagrams: { flowchart: number; sequence: number };
  };
  elements: {
    total: number;
    inDiagrams: number;
    crossLinked: number;
    crossLinkedPct: number;
    /** Same metric over IDs of ≥3 chars, i.e. without placeholder nodes like A/B/C. */
    namedInDiagrams: number;
    namedCrossLinked: number;
    namedCrossLinkedPct: number;
    withDocText: number;
    withDocTextPct: number;
    withDoc: number;
    withProse: number;
    withParent: number;
    withParentPct: number;
    /** Elements in ≥1 diagram per identity class; `*Ids` counts distinct raw IDs, since non-global elements are per diagram. */
    identity: Record<Scope, number> & { localIds: number; placeholderIds: number };
  };
  scenarios: {
    total: number;
    explicit: number;
    inferred: number;
    steps: number;
    resolved: number;
    conflicting: number;
    unmatched: number;
    resolvedPct: number;
    /** Distinct (scenario, participant) pairs anchored to a global element. */
    participants: number;
    participantsResolved: number;
    participantsResolvedPct: number;
  };
  fuzzy: {
    total: number;
    normalized: number;
    editDistance: number;
    top: { a: string; b: string; kind: string; confidence: number }[];
  };
  conflicts: {
    duplicateLabels: number;
    duplicateLabelsExcludingShortIds: number;
    ambiguousParents: number;
    samples: { duplicateLabels: { id: string; labels: string[] }[]; ambiguousParents: { id: string; parents: string[] }[] };
  };
  src: { enabled: boolean; elementsWithHit: number; pct: number; explicit: number; byVia: Record<string, number> };
  hubs: HubBundle[];
  top: {
    id: string;
    diagrams: number;
    children: number;
    parent: string | null;
    doc: string | null;
    scenarios: number;
    src: string | null;
  }[];
}

const HUB_COUNT = 5;

export function buildReport(index: Index, folder: string, srcEnabled: boolean): Report {
  const elements = Object.entries(index.elements);
  const globals = elements.filter(([, e]) => e.scope === "global");
  const inDiagrams = globals.filter(([, e]) => e.appearsIn.length > 0);
  const named = inDiagrams.filter(([id]) => id.length > 2);
  const withDocText = inDiagrams.filter(([, e]) => e.doc || e.prose);
  const withParent = inDiagrams.filter(([, e]) => e.parent);

  // Legacy metric, kept on raw IDs so it stays comparable with the first spike: exact ID in ≥ 2 diagrams.
  const diagramsByRawId = new Map<string, number>();
  for (const d of index.diagrams) for (const nid of new Set(d.nodes)) diagramsByRawId.set(nid, (diagramsByRawId.get(nid) ?? 0) + 1);
  const rawIds = [...diagramsByRawId];
  const crossLinked = rawIds.filter(([, n]) => n >= 2);
  const rawNamed = rawIds.filter(([id]) => id.length > 2);
  const namedCrossLinked = rawNamed.filter(([, n]) => n >= 2);

  const identity = { global: 0, local: 0, placeholder: 0 };
  const distinct: Record<"local" | "placeholder", Set<string>> = { local: new Set(), placeholder: new Set() };
  for (const [key, e] of elements) {
    if (!e.appearsIn.length) continue;
    identity[e.scope]++;
    if (e.scope !== "global") distinct[e.scope].add(key.slice(key.indexOf("::") + 2));
  }

  const flowcharts = index.diagrams.filter((d) => d.type === "flowchart");
  let resolved = 0;
  let conflicting = 0;
  let unmatched = 0;
  let steps = 0;
  for (const scenario of Object.values(index.scenarios)) {
    for (const step of scenario.steps) {
      steps++;
      const both = flowcharts.filter((d) => d.nodes.includes(step.from) && d.nodes.includes(step.to));
      const hasEdge = both.some((d) =>
        d.edges.some(([a, b]) => (a === step.from && b === step.to) || (a === step.to && b === step.from)),
      );
      if (hasEdge) resolved++;
      else if (both.length) conflicting++;
      else unmatched++;
    }
  }

  let participants = 0;
  let participantsResolved = 0;
  for (const scenario of Object.values(index.scenarios)) {
    const names = new Set(scenario.steps.flatMap((st) => [st.from, st.to]));
    participants += names.size;
    for (const name of names) if (resolveParticipant(index, name)) participantsResolved++;
  }

  const fuzzy = index.diagnostics.filter((d) => d.rule === "fuzzy-id-candidate") as unknown as {
    a: string;
    b: string;
    kind: string;
    confidence: number;
  }[];
  const duplicateLabels = index.diagnostics.filter((d) => d.rule === "duplicate-id-different-labels") as unknown as {
    id: string;
    labels: string[];
  }[];

  const ambiguous = elements
    .filter(([, e]) => e.scope === "global" && !e.parent && e.parentCandidates.length > 1)
    .map(([id, e]): [string, string[]] => [id, e.parentCandidates]);

  const withSrc = elements.filter(([, e]) => e.srcInferred?.length);
  const byVia: Record<string, number> = {};
  for (const [, e] of withSrc) for (const h of e.srcInferred ?? []) byVia[h.via] = (byVia[h.via] ?? 0) + 1;

  const scenarioCount = (id: string) =>
    Object.values(index.scenarios).filter((s) => s.steps.some((st) => st.from === id || st.to === id)).length;

  const labelOf = new Map(index.diagrams.map((d) => [d.id, d.labels ?? {}]));
  const hubs: HubBundle[] = named
    .filter(([, e]) => e.appearsIn.length > 0)
    .sort(([ia, a], [ib, b]) => b.appearsIn.length - a.appearsIn.length || ia.localeCompare(ib))
    .slice(0, HUB_COUNT)
    .map(([id, e]) => {
      const counts = new Map<string | null, number>();
      for (const diagramId of e.appearsIn) {
        const label = labelOf.get(diagramId)?.[id] ?? null;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      return {
        id,
        diagrams: e.appearsIn.length,
        labels: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
        appearsIn: e.appearsIn,
        parent: e.parent,
        parentCandidates: e.parentCandidates,
        children: e.children,
        scenarios: Object.entries(index.scenarios)
          .filter(([, sc]) => sc.steps.some((st) => st.from === id || st.to === id))
          .map(([sid]) => sid),
      };
    });

  return {
    folder,
    counts: {
      docs: index.stats.docs,
      blocks: index.stats.blocks,
      byStatus: index.stats.byStatus,
      byType: index.stats.byType,
      diagrams: {
        flowchart: flowcharts.length,
        sequence: index.diagrams.length - flowcharts.length,
      },
    },
    elements: {
      total: elements.length,
      inDiagrams: inDiagrams.length,
      crossLinked: crossLinked.length,
      crossLinkedPct: pct(crossLinked.length, rawIds.length),
      namedInDiagrams: rawNamed.length,
      namedCrossLinked: namedCrossLinked.length,
      namedCrossLinkedPct: pct(namedCrossLinked.length, rawNamed.length),
      withDocText: withDocText.length,
      withDocTextPct: pct(withDocText.length, inDiagrams.length),
      withDoc: inDiagrams.filter(([, e]) => e.doc).length,
      withProse: inDiagrams.filter(([, e]) => !e.doc && e.prose).length,
      withParent: withParent.length,
      withParentPct: pct(withParent.length, inDiagrams.length),
      identity: { ...identity, localIds: distinct.local.size, placeholderIds: distinct.placeholder.size },
    },
    scenarios: {
      total: Object.keys(index.scenarios).length,
      explicit: Object.values(index.scenarios).filter((s) => !s.inferred).length,
      inferred: Object.values(index.scenarios).filter((s) => s.inferred).length,
      steps,
      resolved,
      conflicting,
      unmatched,
      resolvedPct: pct(resolved, steps),
      participants,
      participantsResolved,
      participantsResolvedPct: pct(participantsResolved, participants),
    },
    fuzzy: {
      total: fuzzy.length,
      normalized: fuzzy.filter((f) => f.kind === "normalized").length,
      editDistance: fuzzy.filter((f) => f.kind === "edit-distance").length,
      top: [...fuzzy]
        .sort((x, y) => y.confidence - x.confidence || x.a.localeCompare(y.a))
        .slice(0, 10)
        .map(({ a, b, kind, confidence }) => ({ a, b, kind, confidence })),
    },
    conflicts: {
      duplicateLabels: duplicateLabels.length,
      duplicateLabelsExcludingShortIds: duplicateLabels.filter((d) => d.id.length > 2).length,
      ambiguousParents: ambiguous.length,
      samples: {
        duplicateLabels: duplicateLabels.filter((d) => d.id.length > 2).slice(0, 5).map(({ id, labels }) => ({ id, labels })),
        ambiguousParents: ambiguous.slice(0, 5).map(([id, parents]) => ({ id, parents })),
      },
    },
    src: {
      enabled: srcEnabled,
      elementsWithHit: withSrc.length,
      pct: pct(withSrc.length, inDiagrams.length),
      explicit: elements.filter(([, e]) => e.src.length).length,
      byVia,
    },
    hubs,
    top: named
      .sort(([ia, a], [ib, b]) => b.appearsIn.length - a.appearsIn.length || b.children.length - a.children.length || ia.localeCompare(ib))
      .slice(0, 10)
      .map(([id, e]) => ({
        id,
        diagrams: e.appearsIn.length,
        children: e.children.length,
        parent: e.parent,
        doc: e.doc,
        scenarios: scenarioCount(id),
        src: e.srcInferred?.[0]?.path ?? e.src[0] ?? null,
      })),
  };
}

export function renderReportMarkdown(r: Report): string {
  const kv = (o: Record<string, number>) =>
    Object.entries(o)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ") || "(none)";
  const e = r.elements;
  const s = r.scenarios;
  return (
    [
      `# docdive init — ${r.folder}`,
      `## 1. Counts\n` +
        `- docs: ${r.counts.docs}\n- mermaid blocks: ${r.counts.blocks} (supported ${r.counts.byStatus.supported}, ` +
        `unsupported-type ${r.counts.byStatus["unsupported-type"]}, parse-failed ${r.counts.byStatus["parse-failed"]})\n` +
        `- diagrams indexed: ${r.counts.diagrams.flowchart} flowchart, ${r.counts.diagrams.sequence} sequence\n` +
        `- block types: ${kv(r.counts.byType)}`,
      `## 2. Elements\n` +
        `- total: ${e.total} (${e.inDiagrams} appear in ≥1 diagram; percentages below use these)\n` +
        `- **cross-linked (exact ID in ≥2 diagrams): ${e.crossLinked} (${e.crossLinkedPct}%)**\n` +
        `- cross-linked, IDs of ≥3 chars only (drops A/B/C placeholders): ${e.namedCrossLinked}/${e.namedInDiagrams} (${e.namedCrossLinkedPct}%)\n` +
        `- with doc text: ${e.withDocText} (${e.withDocTextPct}%) — doc ${e.withDoc}, nearest-section prose ${e.withProse}\n` +
        `- with parent: ${e.withParent} (${e.withParentPct}%)\n` +
        `- identity (elements in ≥1 diagram): global ${e.identity.global}, local ${e.identity.local} (${e.identity.localIds} distinct IDs), ` +
        `placeholder ${e.identity.placeholder} (${e.identity.placeholderIds} distinct IDs)`,
      `## 3. Scenarios\n` +
        `- ${s.total} (explicit ${s.explicit}, inferred ${s.inferred}); steps ${s.steps}\n` +
        `- participants anchored to a global element (doc or ≥2 diagrams): ${s.participantsResolved}/${s.participants} (${s.participantsResolvedPct}%)\n` +
        `- info only — steps resolved to a flowchart edge: ${s.resolved} (${s.resolvedPct}%); conflicting ${s.conflicting}; no flowchart with both endpoints ${s.unmatched}`,
      `## 4. Fuzzy ID proposals (not merged, not counted above)\n` +
        `- ${r.fuzzy.total} (normalized ${r.fuzzy.normalized}, edit-distance ${r.fuzzy.editDistance})\n` +
        (r.fuzzy.top.length ? r.fuzzy.top.map((f) => `  - ${f.a} ~ ${f.b} (${f.kind}, ${f.confidence})`).join("\n") : "  - (none)"),
      `## 5. Conflicts\n` +
        [
          `- same ID, different labels: ${r.conflicts.duplicateLabels} (${r.conflicts.duplicateLabelsExcludingShortIds} excluding IDs of ≤2 chars)`,
          ...r.conflicts.samples.duplicateLabels.map((d) => `  - ${d.id}: ${d.labels.map((l) => `"${l}"`).join(" | ")}`),
          `- ambiguous parents (≥2 candidates, none chosen): ${r.conflicts.ambiguousParents}`,
          ...r.conflicts.samples.ambiguousParents.map((d) => `  - ${d.id}: ${d.parents.join(", ")}`),
        ].join("\n"),
      `## 6. Source\n` +
        (r.src.enabled
          ? `- elements with inferred src: ${r.src.elementsWithHit} (${r.src.pct}%) — ${kv(r.src.byVia)}`
          : `- n/a (run with --src <repoRoot>)`) +
        `\n- elements with explicit src: ${r.src.explicit}`,
      `## 7. Top 10 most-connected elements (IDs of ≥3 chars)\n` +
        `| element | diagrams | children | parent | doc | scenarios | src |\n| --- | --- | --- | --- | --- | --- | --- |\n` +
        r.top
          .map((t) => `| ${t.id} | ${t.diagrams} | ${t.children} | ${t.parent ?? ""} | ${t.doc ?? ""} | ${t.scenarios} | ${t.src ?? ""} |`)
          .join("\n"),
      renderHubs(r.hubs),
    ]
      .map((x) => x.trimEnd())
      .join("\n\n") + "\n"
  );
}

const cap = (items: string[], max: number) =>
  items.length > max ? `${items.slice(0, max).join(", ")}, … (+${items.length - max})` : items.join(", ") || "(none)";

function renderHubs(hubs: HubBundle[]): string {
  const blocks = hubs.map((h, i) => {
    const labels = h.labels.map((l) => `${l.label === null ? "(ID only)" : `"${l.label}"`} ×${l.count}`).join(", ");
    const parent = h.parent
      ? h.parent
      : h.parentCandidates.length
        ? `(none; ambiguous: ${h.parentCandidates.join(", ")})`
        : "(none)";
    return (
      `### ${i + 1}. ${h.id} — ${h.diagrams} diagrams\n` +
      `| field | value | pass |\n| --- | --- | --- |\n` +
      `| appearsIn | labels: ${labels}; ${cap(h.appearsIn, 10)} | |\n` +
      `| parent | ${parent} | |\n` +
      `| children | ${cap(h.children, 15)} | |\n` +
      `| scenarios | ${h.scenarios.length}: ${cap(h.scenarios, 8)} | |`
    );
  });
  return (
    `## 8. Hub bundles (top ${HUB_COUNT} global IDs of ≥3 chars by diagram count; pass/fail judged by the owner)\n\n` +
    (blocks.join("\n\n") || "(no eligible hubs)")
  );
}
