export interface DiagramEntry {
  id: string;
  type: string;
  nodes: string[];
  edges: [string, string][];
  /** Absolute 1-based Markdown line per node (absent in indexes built before click-to-source). */
  lines?: Record<string, number>;
}
export interface ElementEntry {
  doc: string | null;
  parent?: string | null;
  children?: string[];
  appearsIn?: string[];
  src?: string[];
  description?: string;
}
/** index.json schema version this element reads. Bumped only for breaking changes to the index shape. */
export const INDEX_VERSION = 1;
/** State of `over` at a step: `Note over A[,B]: [Entity] k=v … [text]` as indexed by docdive. */
export interface StateNote {
  over: string[];
  text: string;
  entity?: string;
  fields?: Record<string, string>;
}
export interface Index {
  version?: number;
  diagrams: DiagramEntry[];
  elements: Record<string, ElementEntry>;
  scenarios: Record<string, { doc: string; steps: { from: string; to: string; label: string; isReturn: boolean; notes?: StateNote[] }[]; initial?: StateNote[] }>;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.textContent = text;
  return node;
}

// Mermaid flowchart node ids look like `<renderId>-flowchart-<ID>-<n>`; IDs may contain `-`.
export function flowchartNodeId(svgId: string): string | null {
  return /flowchart-(.+)-\d+$/.exec(svgId)?.[1] ?? null;
}

export const drawsElement = (diagram: DiagramEntry, id: string): boolean => diagram.nodes.includes(id);

// An element can be dived into when it owns a doc of its own.
export const divable = (index: Index, id: string): boolean => Boolean(index.elements[id]?.doc);

// Marks a rendered node as a docdive element: clickable, keyboard focusable, and `data-docdive-divable` when it
// has a diagram of its own (the viewer draws those heavier, so a reader sees where a dive is possible).
function markNode(g: Element, id: string, index: Index): void {
  g.setAttribute("data-docdive-node", id);
  g.setAttribute("tabindex", "0");
  g.setAttribute("role", "button");
  const deep = divable(index, id);
  g.setAttribute("aria-label", deep ? `${id}, has its own diagram` : id);
  if (deep) g.setAttribute("data-docdive-divable", "");
}

export function annotateFlowchart(svg: SVGElement, diagram: DiagramEntry, index: Index): void {
  for (const g of svg.querySelectorAll<SVGGElement>("g.node")) {
    const id = flowchartNodeId(g.id);
    if (id && diagram.nodes.includes(id)) markNode(g, id, index);
  }
  // Parallel edges: Mermaid's link counter is not 0,1,... per pair (observed `_0`, `_2`), so the
  // k-th occurrence of a pair in the index maps to the k-th link of that pair by numeric suffix.
  const links = [...svg.querySelectorAll<SVGPathElement>("path.flowchart-link")];
  const seen = new Map<string, number>();
  for (const [a, b] of diagram.edges) {
    const key = `${a}>${b}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    const re = new RegExp(`(^|-)L_${a}_${b}_(\\d+)$`);
    const matches = links
      .map((p) => ({ p, m: re.exec(p.id) }))
      .filter((x): x is { p: SVGPathElement; m: RegExpExecArray } => x.m !== null)
      .sort((x, y) => Number(x.m[2]) - Number(y.m[2]));
    matches[k]?.p.setAttribute("data-docdive-edge", `${a}>${b}#${k}`);
  }
}

// Scenarios in which `id` sends or receives a message.
export const scenariosOf = (index: Index, id: string): string[] =>
  Object.entries(index.scenarios)
    .filter(([, sc]) => sc.steps.some((st) => st.from === id || st.to === id))
    .map(([sid]) => sid);

// Element owning `doc`: the one whose `doc` it is, else the scenario written there; undefined when neither.
const docOwner = (index: Index, doc: string): string | undefined =>
  Object.entries(index.elements).find(([, e]) => e.doc === doc)?.[0] ?? Object.entries(index.scenarios).find(([, sc]) => sc.doc === doc)?.[0];

// Human name of a diagram (`doc#n`): its owner, suffixed with the fence number when the doc has several fences;
// the raw doc path when nothing owns it.
export function diagramLabel(index: Index, diagramId: string): string {
  const doc = diagramId.slice(0, diagramId.lastIndexOf("#"));
  const owner = docOwner(index, doc) ?? doc;
  return hasSeveralFences(index, doc) ? `${owner} · ${fenceOf(diagramId) + 1}` : owner;
}

// Relation rows of the info panel, `[name, values]`; empty rows are skipped by the caller. `description` and `src`
// are not relations and are rendered apart.
export function panelFields(index: Index, selected: string): [string, string[]][] {
  const e = index.elements[selected];
  return [
    ["parent", e?.parent ? [e.parent] : []],
    ["children", e?.children ?? []],
    ["appearsIn", e?.appearsIn ?? []],
    ["scenarios", scenariosOf(index, selected)],
  ];
}

// A step as a sentence: "A → B · label", or "B replies label to A" for a return.
export const stepSentence = (s: Step): string => (s.isReturn ? `${s.from} replies ${s.label} to ${s.to}` : `${s.from} → ${s.to} · ${s.label}`);

// ---- state through the steps ------------------------------------------------------------------

export interface StateField {
  k: string;
  v: string;
  /** Set by the note at the current step. */
  changed: boolean;
}
/** What one participant holds for one entity at a step. */
export interface StateCard {
  over: string;
  entity?: string;
  fields: StateField[];
  text: string;
  /** Touched by a note at the current step. */
  changed: boolean;
}

// State of every participant at `step` (0 = initial state only): notes up to `step` merged field by field, later
// wins; one card per participant and entity, in order of first appearance.
export function stateAt(index: Index, scenarioId: string, step: number): StateCard[] {
  const sc = index.scenarios[scenarioId];
  if (!sc) return [];
  const cards = new Map<string, { over: string; entity?: string; fields: Map<string, { v: string; at: number }>; text: string; at: number }>();
  const notesAt: [number, StateNote[]][] = [[0, sc.initial ?? []], ...sc.steps.slice(0, step).map((s, i): [number, StateNote[]] => [i + 1, s.notes ?? []])];
  for (const [at, notes] of notesAt) {
    for (const note of notes) {
      for (const over of note.over) {
        const key = `${over}\u0000${note.entity ?? ""}`;
        const card = cards.get(key) ?? { over, entity: note.entity, fields: new Map(), text: "", at };
        for (const [k, v] of Object.entries(note.fields ?? {})) card.fields.set(k, { v, at });
        if (note.text) card.text = note.text;
        card.at = at;
        cards.set(key, card);
      }
    }
  }
  return [...cards.values()].map((c) => ({
    over: c.over,
    entity: c.entity,
    fields: [...c.fields].map(([k, { v, at }]) => ({ k, v, changed: at === step })),
    text: c.text,
    changed: c.at === step,
  }));
}

/** One change of an entity: at `step` (0 = initial), on `over`. */
export interface TrailItem {
  step: number;
  over: string;
  fields: Record<string, string>;
}

// Every entity's changes in step order: the "living through the process" view (past, now and future alike).
export function entityTrail(index: Index, scenarioId: string): Map<string, TrailItem[]> {
  const sc = index.scenarios[scenarioId];
  const out = new Map<string, TrailItem[]>();
  if (!sc) return out;
  const notesAt: [number, StateNote[]][] = [[0, sc.initial ?? []], ...sc.steps.map((s, i): [number, StateNote[]] => [i + 1, s.notes ?? []])];
  for (const [step, notes] of notesAt) {
    for (const note of notes) {
      if (!note.entity) continue;
      const items = out.get(note.entity) ?? [];
      for (const over of note.over) items.push({ step, over, fields: note.fields ?? {} });
      out.set(note.entity, items);
    }
  }
  return out;
}

// A scenario carries state when any note exists.
export const hasState = (index: Index, scenarioId: string): boolean => {
  const sc = index.scenarios[scenarioId];
  return Boolean(sc && ((sc.initial?.length ?? 0) > 0 || sc.steps.some((s) => s.notes?.length)));
};

// Steps (1-based) whose notes write state, for the marks on the rail.
export const stateSteps = (index: Index, scenarioId: string): number[] =>
  (index.scenarios[scenarioId]?.steps ?? []).flatMap((s, i) => (s.notes?.length ? [i + 1] : []));

// ---- overview ---------------------------------------------------------------------------------

export interface TreeNode {
  id: string;
  children: TreeNode[];
}

// Element hierarchy from `parent`/`children`, rooted at parentless elements that own a doc; a child cycle stops
// at the first repeat.
export function systemTree(index: Index): TreeNode[] {
  const build = (id: string, seen: Set<string>): TreeNode => {
    seen.add(id);
    const kids = (index.elements[id]?.children ?? []).filter((c) => !seen.has(c));
    return { id, children: kids.map((c) => build(c, seen)) };
  };
  return Object.entries(index.elements)
    .filter(([, e]) => !e.parent && e.doc)
    .map(([id]) => build(id, new Set()));
}

// Elements a scenario crosses, in order of first appearance.
export const scenarioElements = (index: Index, scenarioId: string): string[] => [
  ...new Set((index.scenarios[scenarioId]?.steps ?? []).flatMap((s) => [s.from, s.to])),
];

// Repo web URL of a doc line. A `{path}`/`{line}` template wins; otherwise a GitHub or GitLab edit URL is
// rewritten to its blob view. Any other host returns null: edit URLs ignore `#L`, guessing risks a dead link.
export function sourceHref(editUrl: string | undefined, template: string | undefined, docPath: string, line: number): string | null {
  if (template) return template.replace(/\{path\}/g, encodeURI(docPath)).replace(/\{line\}/g, String(line));
  if (!editUrl) return null;
  let url: URL;
  try {
    url = new URL(editUrl);
  } catch {
    return null;
  }
  const gitlab = url.pathname.includes("/-/edit/");
  if (gitlab) url.pathname = url.pathname.replace("/-/edit/", "/-/blob/");
  else if (url.hostname === "github.com" && /^\/[^/]+\/[^/]+\/edit\//.test(url.pathname)) url.pathname = url.pathname.replace("/edit/", "/blob/");
  else return null;
  url.search = "";
  url.hash = `L${line}`;
  return url.href;
}

// ---- scenario trace ---------------------------------------------------------------------------

export type Step = Index["scenarios"][string]["steps"][number];

// The element owning a diagram's doc, then its ancestors, nearest first.
export function ownerChain(index: Index, diagramId: string): string[] {
  const doc = diagramId.split("#")[0];
  const owner = Object.entries(index.elements).find(([, e]) => e.doc === doc)?.[0];
  const chain: string[] = [];
  for (let id: string | null | undefined = owner; id && !chain.includes(id); id = index.elements[id]?.parent) chain.push(id);
  return chain;
}

// Root-first trail of the element owning `doc`, ending at it. Empty when no or several elements own the doc
// (ambiguous) or the owner has no ancestor (a one-item trail says nothing). A parent cycle stops at the first repeat.
export function breadcrumb(index: Index, doc: string): string[] {
  const owners = Object.entries(index.elements).filter(([, e]) => e.doc === doc);
  if (owners.length !== 1) return [];
  const trail: string[] = [];
  for (let id: string | null | undefined = owners[0]?.[0]; id && !trail.includes(id); id = index.elements[id]?.parent) trail.unshift(id);
  return trail.length > 1 ? trail : [];
}

// `url` carrying the active trace (scenario + step); unchanged when none is active.
export function withTrace(url: string, scenario: string, step: number): string {
  if (!scenario || step < 1) return url;
  const q = new URLSearchParams({ "docdive-scenario": scenario, "docdive-step": String(step) });
  return `${url}${url.includes("?") ? "&" : "?"}${q}`;
}

// A scenario touches a diagram when a step's from/to is drawn in it, or is its doc owner or an ancestor
// (so the trace stays visible on a child page reached by deep dive).
export function touchesDiagram(index: Index, scenarioId: string, diagram: DiagramEntry): boolean {
  const chain = ownerChain(index, diagram.id);
  return (index.scenarios[scenarioId]?.steps ?? []).some((s) =>
    [s.from, s.to].some((id) => drawsElement(diagram, id) || chain.includes(id)),
  );
}

// Fence index of a diagram id (`doc#n`).
const fenceOf = (diagramId: string): number => Number(diagramId.slice(diagramId.lastIndexOf("#") + 1));

// The fence of `doc` that owns URL state (selection, scenario/step). A `docdive-diagram` qualifier names it, but
// only when it matches; an unqualified URL (0.3.0 links, deep dives) goes to the first fence that matches.
export function urlStateOwner(index: Index, doc: string, qualified: number | null, matches: (d: DiagramEntry) => boolean): number | undefined {
  const fences = index.diagrams
    .filter((d) => d.id.startsWith(`${doc}#`) && matches(d))
    .map((d) => fenceOf(d.id))
    .sort((a, b) => a - b);
  return qualified === null ? fences[0] : fences.find((n) => n === qualified);
}

// A page with several fences needs a diagram qualifier on links; a single-fence page keeps its plain URLs.
export const hasSeveralFences = (index: Index, doc: string): boolean =>
  index.diagrams.filter((d) => d.id.startsWith(`${doc}#`)).length > 1;

// The scenario a sequence fence draws: same doc, and its steps are exactly the fence's messages.
const scenarioOf = (index: Index, diagram: DiagramEntry) =>
  Object.values(index.scenarios).find(
    (sc) =>
      diagram.id.startsWith(`${sc.doc}#`) &&
      sc.steps.length === diagram.edges.length &&
      sc.steps.every((st, i) => st.from === diagram.edges[i]?.[0] && st.to === diagram.edges[i]?.[1]),
  );

// Mermaid sequence SVG has no per-message ids: each message is a `text.messageText` followed by a
// `[class^=messageLine]` element, both in source order. Mapping is by DOM order, checked against step labels.
// Returns an error message when the mapping is unreliable, null otherwise (also when no scenario is drawn by this fence).
export function annotateSequence(svg: SVGElement, diagram: DiagramEntry, index: Index): string | null {
  const scenario = scenarioOf(index, diagram);
  if (!scenario) return null;
  const texts = [...svg.querySelectorAll<SVGTextElement>("text.messageText")];
  const lines = [...svg.querySelectorAll<SVGElement>('[class^="messageLine"]')];
  const labels = scenario.steps.map((st) => st.label);
  const ok = texts.length === diagram.edges.length && lines.length === texts.length &&
    texts.every((t, i) => t.textContent?.trim() === labels[i]);
  if (!ok) return `sequence mapping unreliable: ${texts.length} texts, ${lines.length} lines, ${diagram.edges.length} messages`;
  texts.forEach((t, i) => {
    t.setAttribute("data-docdive-message", String(i + 1));
    lines[i]?.setAttribute("data-docdive-message", String(i + 1));
  });
  return null;
}

// Participants (`rect.actor[name]`, top and bottom) become selectable like flowchart nodes.
export function annotateActors(svg: SVGElement, diagram: DiagramEntry, index: Index): void {
  for (const r of svg.querySelectorAll<SVGRectElement>("rect.actor[name]")) {
    const id = r.getAttribute("name") as string;
    if (diagram.nodes.includes(id) && r.parentElement) markNode(r.parentElement, id, index);
  }
}

// A3 heuristic: the k-th forward message of an ordered pair maps to the k-th index edge of that pair;
// a return reuses the edge of the latest forward message of the reversed pair.
export function edgeOccurrence(all: Step[], upTo: number): { a: string; b: string; k: number } {
  const s = all[upTo] as Step;
  const count = (from: string, to: string, end: number) =>
    all.slice(0, end).filter((x) => !x.isReturn && x.from === from && x.to === to).length;
  if (!s.isReturn) return { a: s.from, b: s.to, k: count(s.from, s.to, upTo) };
  return { a: s.to, b: s.from, k: Math.max(0, count(s.to, s.from, upTo) - 1) };
}

const MOTION_MS = 200;

// Motion is skipped when the browser lacks Element.animate or the visitor prefers reduced motion.
export function motionAllowed(
  node: { animate?: unknown },
  win: { matchMedia?: (q: string) => { matches: boolean } } = globalThis,
): boolean {
  return typeof node.animate === "function" && !win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Marks `n` as the active step element: edges and messages (anything with a path length) redraw their stroke,
// nodes and message labels fade/glow in. The single keyframe animates from that state to the element's styled one.
function activate(n: Element): void {
  n.setAttribute("data-docdive-active", "");
  if (!motionAllowed(n)) return;
  const geometry = n as Partial<SVGGeometryElement>;
  const length = typeof geometry.getTotalLength === "function" ? geometry.getTotalLength() : 0;
  const from = length > 0 ? { strokeDasharray: `${length}`, strokeDashoffset: `${length}` } : { opacity: 0.4, filter: "drop-shadow(0 0 0 transparent)" };
  n.animate([from], { duration: MOTION_MS, easing: "ease-out" });
}

// Highlights step `step` (1-based; 0 = none) of a scenario in `host`, and fills `throughHost` with the
// "passes through" notice. A5 deferred: inside a child diagram only the involved ancestor is named.
export function applyTrace(
  host: ParentNode,
  throughHost: Element,
  index: Index,
  diagram: DiagramEntry,
  scenarioId: string,
  step: number,
): void {
  host.querySelectorAll("[data-docdive-active]").forEach((n) => n.removeAttribute("data-docdive-active"));
  throughHost.replaceChildren();
  const scenario = index.scenarios[scenarioId];
  const all = scenario?.steps ?? [];
  const s = all[step - 1];
  if (!scenario || !s) return;
  if (diagram.type === "sequence" && diagram.id.startsWith(`${scenario.doc}#`)) {
    host.querySelectorAll(`[data-docdive-message="${step}"]`).forEach(activate);
  }
  if (diagram.type !== "flowchart") return;
  // A participant the diagram does not draw lights up the closest ancestor it does draw (its container box).
  const from = drawnProxy(index, diagram, s.from);
  const to = drawnProxy(index, diagram, s.to);
  for (const id of new Set([from, to])) {
    const node = id && host.querySelector(`[data-docdive-node="${id}"]`);
    if (node) activate(node);
  }
  const { a, b, k } = edgeOccurrence(all, step - 1);
  const [pa, pb] = [drawnProxy(index, diagram, a), drawnProxy(index, diagram, b)];
  if (!pa || !pb || pa === pb) return void through(throughHost, index, diagram, s);
  const edgesOf = (x: string, y: string) => [...host.querySelectorAll(`[data-docdive-edge^="${x}>${y}#"]`)];
  const edges = edgesOf(pa, pb).length ? edgesOf(pa, pb) : edgesOf(pb, pa);
  const edge = edges[k] ?? edges[edges.length - 1];
  if (edge) activate(edge);
  through(throughHost, index, diagram, s);
}

// Nearest element the diagram draws for a participant: itself, else the closest drawn ancestor; null when none.
export function drawnProxy(index: Index, diagram: DiagramEntry, id: string): string | null {
  const seen = new Set<string>();
  for (let cur: string | null | undefined = id; cur && !seen.has(cur); cur = index.elements[cur]?.parent) {
    seen.add(cur);
    if (drawsElement(diagram, cur)) return cur;
  }
  return null;
}

// A diagram shows the state of what it draws (itself or via a drawn ancestor) or owns: the DB page shows the DB
// row, not the whole flow. A sequence diagram shows every holder.
export const relevantHolder = (index: Index, diagram: DiagramEntry, id: string): boolean =>
  diagram.type === "sequence" || drawnProxy(index, diagram, id) !== null || ownerChain(index, diagram.id).includes(id);

// "Scenario passes through X" for an ancestor of the diagram's owner that the step involves but the diagram does not draw.
function through(throughHost: Element, index: Index, diagram: DiagramEntry, s: Step): void {
  for (const id of ownerChain(index, diagram.id).reverse()) {
    if ((id === s.from || id === s.to) && !drawsElement(diagram, id)) {
      throughHost.append(el("div", { "data-docdive-through": id }, `Scenario passes through ${id}`));
    }
  }
}

export const THEME_ATTRS = ["data-theme", "data-md-color-scheme"];

// Host site color scheme: Docusaurus `data-theme` or Material `data-md-color-scheme` (`slate` = dark, any other
// palette = light) on <html>/<body>; null when the host declares none, so CSS falls back to prefers-color-scheme.
export function hostTheme(doc: { documentElement: Element; body: Element | null }): "light" | "dark" | null {
  for (const node of [doc.documentElement, doc.body]) {
    const docusaurus = node?.getAttribute("data-theme");
    if (docusaurus === "dark" || docusaurus === "light") return docusaurus;
    const material = node?.getAttribute("data-md-color-scheme");
    if (material) return material === "slate" ? "dark" : "light";
  }
  return null;
}
