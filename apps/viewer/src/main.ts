import mermaid from "mermaid";
import { annotateFlowchart, drawsElement, el, panelFields, type DiagramEntry, type Index } from "docdive-element/shared";

const app = document.getElementById("app") as HTMLElement;
const index = (await (await fetch("/toy/index.json")).json()) as Index;
mermaid.initialize({ startOnLoad: false });

const nav = el("div", { id: "nav" });
const backBtn = el("button", { "data-docdive-back": "" }, "Back");
const breadcrumb = el("span", { "data-docdive-breadcrumb": "" });
nav.append(backBtn, breadcrumb);
const errorHost = el("div", { "data-docdive-error": "" });
const diagramHost = el("div", { id: "diagram" });
const traceBar = el("div", { id: "trace" });
const picker = el("select", { "data-docdive-scenario-picker": "" });
for (const id of Object.keys(index.scenarios)) picker.add(new Option(id, id));
const prevBtn = el("button", { "data-docdive-prev": "" }, "Prev");
const nextBtn = el("button", { "data-docdive-next": "" }, "Next");
const playBtn = el("button", { "data-docdive-play": "" }, "Play");
const pauseBtn = el("button", { "data-docdive-pause": "" }, "Pause");
const seqBtn = el("button", { "data-docdive-show-sequence": "" }, "Show sequence");
const stepNo = el("span", { "data-docdive-step": "" }, "0");
const stepLabel = el("span", { "data-docdive-step-label": "" });
const throughHost = el("div", { "data-docdive-through-host": "" });
traceBar.append(picker, seqBtn, prevBtn, nextBtn, playBtn, pauseBtn, "step ", stepNo, " ", stepLabel);
const panel = el("aside", { "data-docdive-panel": "" });
app.append(nav, traceBar, throughHost, errorHost, diagramHost, panel);

const docOwner = new Map<string, string>(); // doc path -> element id that owns the doc
for (const [id, e] of Object.entries(index.elements)) if (e.doc) docOwner.set(e.doc, id);

function flowchartOf(elementId: string): string | undefined {
  const doc = index.elements[elementId]?.doc;
  return doc ? index.diagrams.find((d) => d.id.startsWith(`${doc}#`) && d.type === "flowchart")?.id : undefined;
}

const history: string[] = [];
let selected: string | null = null;
let current = "";

let renderCount = 0;

async function mermaidSource(diagramId: string): Promise<string> {
  const [path, n] = diagramId.split("#") as [string, string];
  const md = await (await fetch(`/toy/${path}`)).text();
  if (path.endsWith(".mmd")) return md;
  const blocks = [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)];
  const block = blocks[Number(n)];
  if (!block) throw new Error(`no mermaid block ${diagramId}`);
  return block[1] as string;
}

// Mermaid sequence SVG has no per-message ids: each message is a `text.messageText` followed by a
// `[class^=messageLine]` element, both in source order. Mapping is by DOM order, checked against step labels.
function annotateSequence(svg: SVGElement, diagram: DiagramEntry): void {
  const texts = [...svg.querySelectorAll<SVGTextElement>("text.messageText")];
  const lines = [...svg.querySelectorAll<SVGElement>('[class^="messageLine"]')];
  const labels = Object.values(index.scenarios)
    .filter((sc) => diagram.id.startsWith(`${sc.doc}#`))
    .flatMap((sc) => sc.steps.map((st) => st.label));
  const ok = texts.length === diagram.edges.length && lines.length === texts.length &&
    texts.every((t, i) => t.textContent?.trim() === labels[i]);
  if (!ok) {
    errorHost.textContent = `sequence mapping unreliable: ${texts.length} texts, ${lines.length} lines, ${diagram.edges.length} messages`;
    return;
  }
  texts.forEach((t, i) => {
    t.setAttribute("data-docdive-message", String(i + 1));
    lines[i]?.setAttribute("data-docdive-message", String(i + 1));
  });
}

async function render(diagramId: string): Promise<void> {
  errorHost.textContent = "";
  const diagram = index.diagrams.find((d) => d.id === diagramId);
  if (!diagram) {
    errorHost.textContent = `unknown diagram ${diagramId}`;
    return;
  }
  try {
    const { svg } = await mermaid.render(`docdive-r${renderCount++}`, await mermaidSource(diagramId));
    diagramHost.innerHTML = svg;
    diagramHost.setAttribute("data-docdive-diagram", diagramId);
    const svgEl = diagramHost.querySelector("svg");
    if (svgEl && diagram.type === "flowchart") annotateFlowchart(svgEl as unknown as SVGElement, diagram);
    if (svgEl && diagram.type === "sequence") annotateSequence(svgEl as unknown as SVGElement, diagram);
    current = diagramId;
    renderChrome();
    applyTrace();
  } catch (e) {
    errorHost.textContent = `render error: ${String(e)}`;
  }
}

function renderChrome(): void {
  backBtn.disabled = history.length === 0;
  const owner = docOwner.get(current.split("#")[0] as string);
  const chain: string[] = [];
  for (let id: string | null | undefined = owner; id; id = index.elements[id]?.parent) chain.unshift(id);
  breadcrumb.replaceChildren();
  chain.forEach((id, i) => {
    if (i > 0) breadcrumb.append(" › ");
    const crumb = el("button", { "data-docdive-crumb": id }, id);
    crumb.addEventListener("click", () => void navigate(flowchartOf(id)));
    breadcrumb.append(crumb);
  });
}

async function navigate(diagramId: string | undefined): Promise<void> {
  if (!diagramId || diagramId === current) return;
  const prev = current;
  await render(diagramId);
  if (current === diagramId && prev) history.push(prev);
  renderChrome();
}

// ---- scenario trace -------------------------------------------------------------------------

type Step = Index["scenarios"][string]["steps"][number];
const params = new URLSearchParams(location.search);
const intervalMs = Number(params.get("interval") ?? 1000);
let step = 0;
let timer: ReturnType<typeof setInterval> | undefined;

const steps = (): Step[] => index.scenarios[picker.value]?.steps ?? [];

// A3 heuristic: the k-th forward message of an ordered pair maps to the k-th index edge of that pair;
// a return reuses the edge of the latest forward message of the reversed pair.
function edgeOccurrence(all: Step[], upTo: number): { a: string; b: string; k: number } {
  const s = all[upTo] as Step;
  const count = (from: string, to: string, end: number) =>
    all.slice(0, end).filter((x) => !x.isReturn && x.from === from && x.to === to).length;
  if (!s.isReturn) return { a: s.from, b: s.to, k: count(s.from, s.to, upTo) };
  return { a: s.to, b: s.from, k: Math.max(0, count(s.to, s.from, upTo) - 1) };
}

function applyTrace(): void {
  diagramHost.querySelectorAll("[data-docdive-active]").forEach((n) => n.removeAttribute("data-docdive-active"));
  throughHost.replaceChildren();
  const all = steps();
  stepNo.textContent = String(step);
  prevBtn.disabled = step === 0;
  nextBtn.disabled = step >= all.length;
  const s = all[step - 1];
  stepLabel.textContent = s ? `${s.from} ${s.isReturn ? "-->>" : "->>"} ${s.to}: ${s.label}` : "";
  if (!s) return;
  const diagram = index.diagrams.find((d) => d.id === current);
  if (diagram?.type === "sequence" && current.startsWith(`${index.scenarios[picker.value]?.doc}#`)) {
    diagramHost.querySelectorAll(`[data-docdive-message="${step}"]`).forEach((n) => n.setAttribute("data-docdive-active", ""));
  }
  if (diagram?.type === "flowchart") {
    for (const id of new Set([s.from, s.to])) {
      diagramHost.querySelector(`[data-docdive-node="${id}"]`)?.setAttribute("data-docdive-active", "");
    }
    const { a, b, k } = edgeOccurrence(all, step - 1);
    const edges = [...diagramHost.querySelectorAll(`[data-docdive-edge^="${a}>${b}#"]`)];
    (edges[k] ?? edges[edges.length - 1])?.setAttribute("data-docdive-active", "");
    // A5 deferred: no sub-step expansion; inside a child diagram only say the parent is involved.
    const owner = docOwner.get(current.split("#")[0] as string);
    for (let id: string | null | undefined = owner; id; id = index.elements[id]?.parent) {
      if ((id === s.from || id === s.to) && !drawsElement(diagram, id)) {
        throughHost.append(el("div", { "data-docdive-through": id }, `Scenario passes through ${id}`));
      }
    }
  }
}

function setStep(n: number): void {
  step = Math.max(0, Math.min(steps().length, n));
  applyTrace();
}

function stopPlay(): void {
  clearInterval(timer);
  timer = undefined;
}

picker.addEventListener("change", () => {
  stopPlay();
  setStep(0);
});
seqBtn.addEventListener("click", () => {
  const doc = index.scenarios[picker.value]?.doc;
  void navigate(index.diagrams.find((d) => d.id.startsWith(`${doc}#`) && d.type === "sequence")?.id);
});
nextBtn.addEventListener("click", () => setStep(step + 1));
prevBtn.addEventListener("click", () => setStep(step - 1));
pauseBtn.addEventListener("click", stopPlay);
playBtn.addEventListener("click", () => {
  stopPlay();
  if (step >= steps().length) setStep(0);
  timer = setInterval(() => {
    if (step >= steps().length) stopPlay();
    else setStep(step + 1);
  }, intervalMs);
});

function renderPanel(): void {
  panel.replaceChildren();
  if (!selected) return;
  const e = index.elements[selected];
  panel.append(el("h2", { "data-docdive-title": "" }, selected));
  if (!e) return;
  const fields = panelFields(index, selected);
  for (const [name, values] of fields) {
    if (values.length === 0) continue;
    const row = el("div", { "data-docdive-field": name });
    row.append(el("strong", {}, `${name}: `), el("span", { "data-docdive-value": "" }, values.join(", ")));
    panel.append(row);
  }
}

backBtn.addEventListener("click", () => {
  const prev = history.pop();
  if (prev) void render(prev);
});

diagramHost.addEventListener("click", (ev) => {
  const id = (ev.target as Element).closest("[data-docdive-node]")?.getAttribute("data-docdive-node");
  if (!id) return;
  selected = id;
  renderPanel();
  void navigate(flowchartOf(id));
});

const root = Object.entries(index.elements).find(([, e]) => e.doc && !e.parent)?.[0];
await render(flowchartOf(root as string) as string);
