import { DOC_EXT, loadDocs, type Doc } from "./loader.js";
import { extractFlowchart } from "./flowchart.js";
import { attachProse, type Prose } from "./prose.js";
import { proposeFuzzyIds } from "./fuzzy.js";
import { inferSrc, type SrcHit } from "./src.js";
import { detectSsg, findParentDoc, inferDocIds } from "./infer.js";
import { extractSequence, type SequenceStep } from "./sequence.js";
import { loadSidecar } from "./sidecar.js";

export type Scope = "global" | "local" | "placeholder";

export interface Element {
  scope: Scope;
  doc: string | null;
  parent: string | null;
  /** Every container seen for this element; `parent` is set only when explicit or when this has exactly one entry. */
  parentCandidates: string[];
  children: string[];
  src: string[];
  appearsIn: string[];
  confidence: number;
  prose?: Prose;
  srcInferred?: SrcHit[];
  /** Doc of the nearest ancestor that has one; set only when this element has no doc. */
  docInherited?: { path: string; from: string };
  /** Declared `src` of the nearest ancestor that declares any; set only when this element declares none. */
  srcInherited?: { paths: string[]; from: string };
  /** Other node IDs that mean this element, declared in the sidecar. */
  aliases?: string[];
  /** Sidecar description (doc frontmatter `description` wins and leaves this unset). */
  description?: string;
  /** Set when the sidecar supplied any field of this element. */
  origin?: "sidecar";
  /** `entity` for data entities declared in the sidecar; absent for ordinary elements. */
  kind?: "entity";
}

export interface Diagram {
  id: string;
  type: "flowchart" | "sequence";
  nodes: string[];
  edges: [string, string][];
  /** Node labels that differ from the node ID (flowcharts only). */
  labels?: Record<string, string>;
  /** Absolute 1-based Markdown line where each node is declared (or first mentioned). */
  lines: Record<string, number>;
  /** Node ID -> element ID, only for nodes that are aliases of another element. Absent when none. */
  nodeElement?: Record<string, string>;
}

export interface Scenario {
  doc: string;
  steps: SequenceStep[];
  inferred?: true;
}

export interface Diagnostic {
  rule: string;
  file: string;
  [key: string]: unknown;
}

export type BlockStatus = "supported" | "unsupported-type" | "parse-failed";

export interface Stats {
  docs: number;
  blocks: number;
  byStatus: Record<BlockStatus, number>;
  byType: Record<string, number>;
}

export interface Index {
  version: 1;
  elements: Record<string, Element>;
  diagrams: Diagram[];
  scenarios: Record<string, Scenario>;
  diagnostics: Diagnostic[];
  stats: Stats;
}

const isFlowchart = (type: string) => /^(flowchart|graph)(-elk)?$/.test(type);
const isSequence = (type: string) => type === "sequenceDiagram";

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];

const PLACEHOLDER_MAX_LENGTH = 2;

/** Per-doc identity policy from frontmatter: `ids: local` or `ids: { shared: [...] }`. */
function idsPolicy(doc: Doc): { allLocal: boolean; shared: Set<string> } {
  const ids = doc.frontmatter.ids;
  const shared =
    ids && typeof ids === "object" && !Array.isArray(ids) ? asStringArray((ids as Record<string, unknown>).shared) : [];
  return { allLocal: ids === "local", shared: new Set(shared) };
}

/** Key of a non-global element: unique per diagram, so it never links across diagrams. */
export const localKey = (diagramId: string, id: string) => `${diagramId}::${id}`;

export const globalElements = (elements: Record<string, Element>): Record<string, Element> =>
  Object.fromEntries(Object.entries(elements).filter(([, e]) => e.scope === "global"));

function newElement(scope: Scope = "global"): Element {
  return { scope, doc: null, parent: null, parentCandidates: [], children: [], src: [], appearsIn: [], confidence: 0.5 };
}

export interface BuildOptions {
  /** Repo root to search for code matching element IDs. */
  srcRoot?: string;
}

export function buildModel(folder: string, base?: string, options: BuildOptions = {}): Index {
  const docs = loadDocs(folder, base);
  const relDoc = (d: Doc) => d.path;
  const { sidecar, problems } = loadSidecar(folder);
  const sidecarEls = sidecar?.elements ?? {};
  const aliasOf = new Map<string, string>();
  for (const [cid, entry] of Object.entries(sidecarEls)) {
    for (const alias of entry.aliases) if (!aliasOf.has(alias) && alias !== cid) aliasOf.set(alias, cid);
  }
  const canon = (nid: string) => aliasOf.get(nid) ?? nid;
  const inSidecar = (nid: string) => nid in sidecarEls || aliasOf.has(nid);
  const explicitParent = new Set<string>();

  const elements: Record<string, Element> = {};
  const diagrams: Diagram[] = [];
  const scenarios: Record<string, Scenario> = {};
  const diagnostics: Diagnostic[] = [...problems];
  const stats: Stats = {
    docs: docs.length,
    blocks: 0,
    byStatus: { supported: 0, "unsupported-type": 0, "parse-failed": 0 },
    byType: {},
  };
  const labels: Record<string, string> = {};
  const labelVariants = new Map<string, Map<string, string[]>>();
  const diagramLines = new Map<string, number>();
  const get = (id: string) => (elements[id] ??= newElement());
  const pairs: [string, string][] = [];
  const link = (parent: string, child: string) => {
    get(parent);
    pairs.push([parent, child]);
  };
  const addCandidate = (parent: string, child: string) => {
    const el = get(child);
    if (!el.parentCandidates.includes(parent)) el.parentCandidates.push(parent);
    link(parent, child);
  };

  const metas = inferDocIds(docs, { ssg: detectSsg(folder) });
  const ensureDocElement = (doc: Doc): void => {
    const meta = metas.get(doc);
    if (!meta) return;
    const el = get(meta.id);
    if (el.doc) return;
    el.doc = relDoc(doc);
    el.src = asStringArray(doc.frontmatter.src);
    el.confidence = meta.explicit ? 1 : 0.6;
    if (doc.frontmatter.parent) {
      el.parent = canon(String(doc.frontmatter.parent));
      explicitParent.add(meta.id);
      link(el.parent, meta.id);
      return;
    }
    const parentDoc = findParentDoc(doc, docs);
    const parentMeta = parentDoc && metas.get(parentDoc);
    if (parentDoc && parentMeta && parentMeta.id !== meta.id) {
      ensureDocElement(parentDoc);
      addCandidate(parentMeta.id, meta.id);
    }
  };

  interface Parsed {
    block: Doc["blocks"][number];
    diagramId: string;
    fc: ReturnType<typeof extractFlowchart> | null;
    seq: ReturnType<typeof extractSequence> | null;
  }
  const parsedByDoc = new Map<Doc, Parsed[]>();

  // Pass 1: parse every block and collect label variants; scope needs the whole corpus.
  for (const doc of docs) {
    const docPath = relDoc(doc);
    const parsed: Parsed[] = [];
    parsedByDoc.set(doc, parsed);
    for (const block of doc.blocks) {
      const diagramId = `${docPath}#${block.index}`;
      const type = block.type || "(empty)";
      stats.blocks++;
      stats.byType[type] = (stats.byType[type] ?? 0) + 1;
      if (!isFlowchart(block.type) && !isSequence(block.type)) {
        stats.byStatus["unsupported-type"]++;
        continue;
      }
      let fc: Parsed["fc"] = null;
      let seq: Parsed["seq"] = null;
      try {
        if (isFlowchart(block.type)) fc = extractFlowchart(block.source);
        else seq = extractSequence(block.source);
      } catch (e) {
        stats.byStatus["parse-failed"]++;
        diagnostics.push({
          rule: "parse-failed",
          file: docPath,
          diagram: diagramId,
          line: block.startLine,
          type: block.type,
          message: (e as Error).message,
        });
        continue;
      }
      stats.byStatus.supported++;
      diagramLines.set(diagramId, block.startLine);
      if (fc) {
        for (const [nid, label] of Object.entries(fc.labels)) {
          if (label === nid) continue;
          labels[nid] ??= label;
          const key = label.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
          const variants = labelVariants.get(nid) ?? new Map<string, string[]>();
          variants.set(key, [...(variants.get(key) ?? []), diagramId]);
          labelVariants.set(nid, variants);
        }
      }
      parsed.push({ block, diagramId, fc, seq });
    }
  }

  const conflicting = new Set([...labelVariants].filter(([, v]) => v.size >= 2).map(([nid]) => nid));

  // Pass 2: build elements, hierarchy and scenarios.
  for (const doc of docs) {
    const isScenario = doc.frontmatter.kind === "scenario";
    const id = isScenario ? null : (metas.get(doc)?.id ?? null);
    const docPath = relDoc(doc);
    const policy = idsPolicy(doc);

    const scopeOf = (nid: string): Scope => {
      if (policy.shared.has(nid)) return "global";
      if (nid.length <= PLACEHOLDER_MAX_LENGTH) return "placeholder";
      return policy.allLocal || conflicting.has(nid) ? "local" : "global";
    };
    /** Global IDs share one element; local/placeholder IDs get one element per diagram. */
    const resolve = (nid: string, diagramId: string): { key: string; el: Element } => {
      const scope = inSidecar(nid) ? "global" : scopeOf(nid);
      if (scope === "global") return { key: canon(nid), el: get(canon(nid)) };
      const key = localKey(diagramId, nid);
      return { key, el: (elements[key] ??= newElement(scope)) };
    };

    if (metas.get(doc)?.explicit) ensureDocElement(doc);

    for (const { block, diagramId, fc, seq } of parsedByDoc.get(doc) ?? []) {
      ensureDocElement(doc);
      const absLines = (rel: Record<string, number>) =>
        Object.fromEntries(Object.entries(rel).map(([nid, n]) => [nid, block.startLine + n - 1]));
      const nodeElement = (nodes: string[]) => {
        const map = Object.fromEntries(nodes.filter((n) => aliasOf.has(n)).map((n) => [n, canon(n)]));
        return Object.keys(map).length ? { nodeElement: map } : {};
      };
      if (fc) {
        diagrams.push({ id: diagramId, type: "flowchart", nodes: fc.nodes, edges: fc.edges, labels: Object.fromEntries(Object.entries(fc.labels).filter(([k, v]) => v !== k)), lines: absLines(fc.lines), ...nodeElement(fc.nodes) });
        for (const sg of fc.subgraphs) {
          const parent = resolve(sg.id, diagramId);
          for (const member of sg.members) {
            const m = resolve(member, diagramId);
            if (parent.el.scope !== "global" || m.el.scope !== "global") continue;
            addCandidate(canon(sg.id), canon(member));
          }
        }
        for (const node of fc.nodes) {
          const { el } = resolve(node, diagramId);
          if (!el.appearsIn.includes(diagramId)) el.appearsIn.push(diagramId);
          // Only docs with an explicit `id:` own the nodes of their diagrams.
          if (id && metas.get(doc)?.explicit && !isScenario && canon(node) !== id && el.scope === "global") {
            addCandidate(id, canon(node));
          }
        }
      } else if (seq) {
        diagrams.push({
          id: diagramId,
          type: "sequence",
          nodes: seq.participants,
          edges: seq.steps.map((s): [string, string] => [s.from, s.to]),
          lines: absLines(seq.lines),
          ...nodeElement(seq.participants),
        });
        for (const p of seq.participants) {
          const { el } = resolve(p, diagramId);
          if (!el.appearsIn.includes(diagramId)) el.appearsIn.push(diagramId);
        }
        const steps = aliasOf.size ? seq.steps.map((st) => ({ ...st, from: canon(st.from), to: canon(st.to) })) : seq.steps;
        if (isScenario) {
          const sid = doc.frontmatter.id ? String(doc.frontmatter.id) : null;
          if (sid && !(sid in scenarios)) scenarios[sid] = { doc: docPath, steps };
        } else if (!isScenario && steps.length) {
          const slug = docPath.replace(DOC_EXT, "");
          let key = `${id ?? slug}#${block.index}`;
          if (key in scenarios) key = `${slug}#${block.index}`;
          scenarios[key] = { doc: docPath, steps, inferred: true };
        }
      }
    }
  }

  /** Precedence: doc frontmatter > sidecar > inference. */
  function mergeSidecar(): void {
    for (const [cid, entry] of Object.entries(sidecarEls)) {
      const el = get(cid);
      el.origin = "sidecar";
      if (entry.aliases.length) el.aliases = entry.aliases;
      if (entry.kind === "entity") el.kind = "entity";
      if (entry.parent && !explicitParent.has(cid)) {
        el.parent = canon(entry.parent);
        link(el.parent, cid);
      }
      if (entry.src.length && !el.src.length) el.src = entry.src;
      const doc = docs.find((d) => relDoc(d) === el.doc);
      if (entry.description && typeof doc?.frontmatter.description !== "string") el.description = entry.description;
    }
  }

  for (const [nid, variants] of labelVariants) {
    if (variants.size < 2) continue;
    diagnostics.push({
      rule: "duplicate-id-different-labels",
      file: [...variants.values()][0][0].replace(/#\d+$/, ""),
      id: nid,
      labels: [...variants.keys()],
    });
  }
  mergeSidecar();
  for (const el of Object.values(elements)) {
    if (!el.parent && el.parentCandidates.length === 1) el.parent = el.parentCandidates[0];
  }
  for (const [parent, child] of pairs) {
    const p = elements[parent];
    if (elements[child].parent === parent && !p.children.includes(child)) p.children.push(child);
  }
  attachProse(globalElements(elements), labels, docs, diagramLines);
  if (options.srcRoot) inferSrc(globalElements(elements), options.srcRoot);
  attachInherited(elements);
  const index: Index = { version: 1, elements, diagrams, scenarios, diagnostics, stats };
  index.diagnostics.push(...lintEdgeNotInDiagram(index), ...proposeFuzzyIds(globalElements(elements)));
  return index;
}

function attachInherited(elements: Record<string, Element>): void {
  const nearest = (start: Element, pick: (e: Element) => boolean): string | null => {
    const seen = new Set<Element>([start]);
    for (let id = start.parent; id; ) {
      const el = elements[id];
      if (!el || seen.has(el)) return null;
      if (pick(el)) return id;
      seen.add(el);
      id = el.parent;
    }
    return null;
  };
  for (const el of Object.values(elements)) {
    if (!el.doc) {
      const from = nearest(el, (e) => !!e.doc);
      if (from) el.docInherited = { path: elements[from].doc!, from };
    }
    if (!el.src.length) {
      const from = nearest(el, (e) => e.src.length > 0);
      if (from) el.srcInherited = { paths: elements[from].src, from };
    }
  }
}

/** A participant is anchored when it names a global element that has a doc or appears in ≥ 2 diagrams. */
export function resolveParticipant(index: Index, name: string): boolean {
  const el = index.elements[name];
  return !!el && el.scope === "global" && (!!el.doc || el.appearsIn.length >= 2);
}

/** Inferred scenarios are skipped: participants and node IDs are two vocabularies, so a mismatch is not a conflict. */
export function lintEdgeNotInDiagram(index: Index): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [scenarioId, scenario] of Object.entries(index.scenarios)) {
    if (scenario.inferred) continue;
    scenario.steps.forEach((step, i) => {
      for (const d of index.diagrams) {
        const el = (n: string) => d.nodeElement?.[n] ?? n;
        const has = (id: string) => d.nodes.some((n) => el(n) === id);
        if (d.type !== "flowchart" || !has(step.from) || !has(step.to)) continue;
        const found = d.edges.some(
          ([a, b]) => (el(a) === step.from && el(b) === step.to) || (el(a) === step.to && el(b) === step.from),
        );
        if (!found) {
          out.push({
            rule: "edge-not-in-diagram",
            file: scenario.doc,
            scenario: scenarioId,
            step: i,
            from: step.from,
            to: step.to,
            diagram: d.id,
          });
        }
      }
    });
  }
  return out;
}
