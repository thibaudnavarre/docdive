import { DOC_EXT, type Doc } from "./loader.js";
import { extractFlowchart } from "./flowchart.js";
import { extractSequence, type SequenceStep } from "./sequence.js";
import { proposeFuzzyIds } from "./fuzzy.js";

export interface Element {
  doc: string | null;
  parent: string | null;
  children: string[];
  src: string[];
  appearsIn: string[];
  /** Frontmatter `description` of the element's doc. */
  description?: string;
}

export interface Diagram {
  id: string;
  type: "flowchart" | "sequence";
  nodes: string[];
  edges: [string, string][];
  /** Absolute 1-based Markdown line where each node is declared (or first mentioned). */
  lines: Record<string, number>;
}

export interface Scenario {
  doc: string;
  steps: SequenceStep[];
  /** A sequence diagram in a doc without `kind: scenario`. */
  inferred?: true;
}

export interface Diagnostic {
  rule: string;
  file: string;
  [key: string]: unknown;
}

export interface Index {
  version: 1;
  elements: Record<string, Element>;
  diagrams: Diagram[];
  scenarios: Record<string, Scenario>;
  diagnostics: Diagnostic[];
}

const isFlowchart = (type: string) => /^(flowchart|graph)(-elk)?$/.test(type);
const isSequence = (type: string) => type === "sequenceDiagram";

export const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];

/** Node IDs of 1–2 characters (`A`, `B1`) are throwaway placeholders: drawn, but never elements. */
const isPlaceholder = (id: string) => id.length <= 2;

/** The element a doc describes: its frontmatter `id`, unless it is a scenario. */
const docId = (doc: Doc): string | null =>
  doc.frontmatter.kind !== "scenario" && doc.frontmatter.id ? String(doc.frontmatter.id) : null;

export function buildModel(docs: Doc[]): Index {
  const elements: Record<string, Element> = {};
  const diagrams: Diagram[] = [];
  const scenarios: Record<string, Scenario> = {};
  const diagnostics: Diagnostic[] = [];
  const get = (id: string) => (elements[id] ??= { doc: null, parent: null, children: [], src: [], appearsIn: [] });
  // Containers seen for each element (doc owner, subgraph); one candidate becomes the parent.
  const candidates = new Map<string, Set<string>>();
  const addCandidate = (parent: string, child: string) => {
    if (parent === child || isPlaceholder(parent) || isPlaceholder(child)) return;
    get(parent);
    candidates.set(child, (candidates.get(child) ?? new Set()).add(parent));
  };
  const labelVariants = new Map<string, Map<string, string[]>>();

  for (const doc of docs) {
    const id = docId(doc);
    if (id && !elements[id]?.doc) {
      const el = get(id);
      el.doc = doc.path;
      el.src = asStringArray(doc.frontmatter.src);
      if (typeof doc.frontmatter.description === "string") el.description = doc.frontmatter.description;
      if (doc.frontmatter.parent) el.parent = String(doc.frontmatter.parent);
    }
  }

  for (const doc of docs) {
    const id = docId(doc);
    for (const block of doc.blocks) {
      const diagramId = `${doc.path}#${block.index}`;
      if (!isFlowchart(block.type) && !isSequence(block.type)) continue;
      let fc: ReturnType<typeof extractFlowchart> | null = null;
      let seq: ReturnType<typeof extractSequence> | null = null;
      try {
        if (isFlowchart(block.type)) fc = extractFlowchart(block.source);
        else seq = extractSequence(block.source);
      } catch (e) {
        diagnostics.push({ rule: "parse-failed", file: doc.path, diagram: diagramId, line: block.startLine, message: (e as Error).message });
        continue;
      }
      const absLines = (rel: Record<string, number>) =>
        Object.fromEntries(Object.entries(rel).map(([nid, n]) => [nid, block.startLine + n - 1]));
      const appear = (nodes: string[]) => {
        for (const n of nodes) {
          if (isPlaceholder(n)) continue;
          const el = get(n);
          if (!el.appearsIn.includes(diagramId)) el.appearsIn.push(diagramId);
        }
      };

      if (fc) {
        const labels = Object.fromEntries(Object.entries(fc.labels).filter(([k, v]) => v !== k));
        diagrams.push({ id: diagramId, type: "flowchart", nodes: fc.nodes, edges: fc.edges, lines: absLines(fc.lines) });
        appear(fc.nodes);
        // Inside one diagram the innermost container wins: a subgraph member is not also a child of the doc.
        const grouped = new Set(fc.subgraphs.flatMap((sg) => sg.members));
        for (const sg of fc.subgraphs) for (const m of sg.members) addCandidate(sg.id, m);
        if (id) for (const n of [...fc.nodes, ...fc.subgraphs.map((sg) => sg.id)]) if (!grouped.has(n)) addCandidate(id, n);
        for (const [nid, label] of Object.entries(labels)) {
          const key = label.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
          const variants = labelVariants.get(nid) ?? new Map<string, string[]>();
          variants.set(key, [...(variants.get(key) ?? []), diagramId]);
          labelVariants.set(nid, variants);
        }
      } else if (seq) {
        const edges = seq.steps.map((s): [string, string] => [s.from, s.to]);
        diagrams.push({ id: diagramId, type: "sequence", nodes: seq.participants, edges, lines: absLines(seq.lines) });
        appear(seq.participants);
        if (doc.frontmatter.kind === "scenario") {
          const sid = doc.frontmatter.id ? String(doc.frontmatter.id) : null;
          if (sid && !(sid in scenarios)) scenarios[sid] = { doc: doc.path, steps: seq.steps };
        } else if (seq.steps.length) {
          const slug = doc.path.replace(DOC_EXT, "");
          let key = `${id ?? slug}#${block.index}`;
          if (key in scenarios) key = `${slug}#${block.index}`;
          scenarios[key] = { doc: doc.path, steps: seq.steps, inferred: true };
        }
      }
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
  // Across diagrams the outermost container wins: a zoom diagram that redraws its surroundings does not adopt them.
  const ancestors = (id: string): Set<string> => {
    const seen = new Set<string>();
    for (let p = elements[id]?.parent; p && !seen.has(p); p = elements[p]?.parent) seen.add(p);
    return seen;
  };
  const resolved = new Map<string, string>();
  for (const [child, parents] of candidates) {
    const el = elements[child];
    if (!el || el.parent) continue;
    const outer = [...parents].filter((p) => ![...parents].some((q) => q !== p && ancestors(p).has(q)));
    if (outer.length === 1) resolved.set(child, outer[0]);
  }
  for (const [child, parent] of resolved) elements[child].parent = parent;
  for (const [id, el] of Object.entries(elements)) {
    if (el.parent) get(el.parent).children.push(id);
  }
  const index: Index = { version: 1, elements, diagrams, scenarios, diagnostics };
  diagnostics.push(...lintEdgeNotInDiagram(index), ...proposeFuzzyIds(elements));
  return index;
}

/** A participant is anchored when it names an element that has a doc or appears in ≥ 2 diagrams. */
export function resolveParticipant(index: Index, name: string): boolean {
  const el = index.elements[name];
  return !!el && (!!el.doc || el.appearsIn.length >= 2);
}

/** Inferred scenarios are skipped: participants and node IDs are two vocabularies, so a mismatch is not a conflict. */
export function lintEdgeNotInDiagram(index: Index): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [scenarioId, scenario] of Object.entries(index.scenarios)) {
    if (scenario.inferred) continue;
    scenario.steps.forEach((step, i) => {
      for (const d of index.diagrams) {
        if (d.type !== "flowchart" || !d.nodes.includes(step.from) || !d.nodes.includes(step.to)) continue;
        const found = d.edges.some(([a, b]) => (a === step.from && b === step.to) || (a === step.to && b === step.from));
        if (!found) {
          out.push({ rule: "edge-not-in-diagram", file: scenario.doc, scenario: scenarioId, step: i, from: step.from, to: step.to, diagram: d.id });
        }
      }
    });
  }
  return out;
}
