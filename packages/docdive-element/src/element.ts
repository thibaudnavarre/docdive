import { resolveMermaid, type MermaidApi } from "./mermaid-resolver.js";
import {
  annotateFlowchart,
  annotateSequence,
  applyTrace,
  el,
  hasSeveralFences,
  panelFields,
  touchesDiagram,
  urlStateOwner,
  type DiagramEntry,
  INDEX_VERSION,
  type Index,
} from "./shared.js";

export { resolveMermaid, isMermaidApi, type MermaidApi } from "./mermaid-resolver.js";

// <docdive-diagram>: renders one Mermaid fence into its own open shadow root, maps IDs through
// index.json, shows the info panel on node click, and deep-dives through the panel's "Open" link to the
// child doc's SSG page (cancelable, composed `docdive-navigate` event first; `detail: { url, id }`).
//
// Inputs (all overridable by attribute; defaults sit next to this script so they follow the base URL):
//   source      Mermaid source (attribute/property). Falls back to the light-DOM text, which is then removed.
//   index-url   URL of index.json        (default: ./index.json next to this script)
//   map-url     URL of the doc->URL map  (default: ./docdive-map.json next to this script)
//   contexts-url URL of the context bundles `{ id: markdown }` (default: ./contexts.json next to this script)
//   doc, n      Doc path and fence order (default: found from the page URL via the map; n = order among
//               <docdive-diagram> elements on the page)
//
// Scenario trace: a bar in the shadow root, shown only when a scenario touches the diagram. Initial state
// comes from the page query (`docdive-scenario`, `docdive-step`), restored paused, and `docdive-select` (an element ID
// shown in this diagram) reopens its panel (the panel's "Copy link" builds such a URL); invalid values are ignored or
// clamped. On a page with several fences, `docdive-diagram` (fence index) names the diagram that owns this state;
// without it the first diagram that matches owns it and the others start idle. Step changes don't rewrite the URL.
// `docdive-interval` (ms) overrides the play interval.

type DocMap = Record<string, string>;

// Mermaid resolution: a host instance given to `setMermaid`, then a valid `window.mermaid`, then a lazily
// loaded bundled copy. `data-docdive-mermaid` on the element records which one rendered the diagram
// (`bundled-fallback` = a host instance rendered, its SVG could not be mapped, so the bundled copy took over).
let injectedMermaid: unknown;
export function setMermaid(mermaid: unknown): void {
  injectedMermaid = mermaid;
}
const loadBundled = (): Promise<MermaidApi> => import("mermaid").then((m) => m.default as unknown as MermaidApi);

const here = import.meta.url;
const cache = new Map<string, Promise<unknown>>();
const getJson = <T>(url: string): Promise<T> => {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    });
    cache.set(url, p);
  }
  return p as Promise<T>;
};

// Compare URLs by path only, ignoring trailing slash, index.html and .html.
const normPath = (u: string): string =>
  new URL(u, location.href).pathname.replace(/\/index\.html$/, "").replace(/\.html$/, "").replace(/\/+$/, "");

const STYLE = `
:host { display: block; }
[data-docdive-node] { cursor: pointer; }
[data-docdive-error] { color: #b71c1c; }
[data-docdive-panel] { margin-top: .5rem; padding: .5rem 1rem; border: 1px solid #ccc; }
[data-docdive-panel] h2 { margin: 0 0 .5rem; font-size: 1rem; }
[data-docdive-trace] { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-bottom: .5rem; }
[data-docdive-through] { font-style: italic; }
[data-docdive-active].node rect, [data-docdive-active].node polygon, [data-docdive-active].node circle, [data-docdive-active].node path {
  stroke: #e65100 !important; stroke-width: 3px !important;
}
path[data-docdive-active] { stroke: #e65100 !important; stroke-width: 3px !important; }
text[data-docdive-active] { fill: #e65100 !important; font-weight: bold; }
[class^="messageLine"][data-docdive-active] { stroke: #e65100 !important; stroke-width: 3px !important; }
`;

let renderCount = 0;

// `docdive-diagram`: the fence a link was copied from; null (absent or invalid) means unqualified.
const qualifier = (q: URLSearchParams): number | null => {
  const n = Number.parseInt(q.get("docdive-diagram") ?? "", 10);
  return Number.isFinite(n) ? n : null;
};

export class DocdiveDiagram extends HTMLElement {
  static observedAttributes = ["source", "index-url", "map-url", "contexts-url", "doc", "n"];

  private root = this.attachShadow({ mode: "open" });
  private host = el("div");
  private errorHost = el("div", { "data-docdive-error": "" });
  private panel = el("aside", { "data-docdive-panel": "" });
  private index?: Index;
  private map: DocMap = {};
  private contexts?: Record<string, string>;
  private scheduled = false;
  private selected: string | null = null;
  private scenario = "";
  private step = 0;
  private diagram?: DiagramEntry;
  private page?: { doc: string; n: number };
  private timer?: ReturnType<typeof setInterval>;
  private traceBar = el("div", { "data-docdive-trace": "" });
  private picker = el("select", { "data-docdive-scenario-picker": "" });
  private prevBtn = el("button", { "data-docdive-prev": "" }, "Prev");
  private nextBtn = el("button", { "data-docdive-next": "" }, "Next");
  private playBtn = el("button", { "data-docdive-play": "" }, "Play");
  private pauseBtn = el("button", { "data-docdive-pause": "" }, "Pause");
  private stepNo = el("span", { "data-docdive-step": "" }, "0");
  private stepLabel = el("span", { "data-docdive-step-label": "" });
  private throughHost = el("div", { "data-docdive-through-host": "" });

  get source(): string {
    return this.getAttribute("source") ?? "";
  }
  set source(v: string) {
    this.setAttribute("source", v);
  }

  constructor() {
    super();
    this.root.append(el("style", {}, STYLE), this.errorHost, this.host, this.panel);
    this.host.addEventListener("click", (ev) => this.onClick(ev));
    const t = this.traceBar;
    t.append(this.picker, this.prevBtn, this.nextBtn, this.playBtn, this.pauseBtn, "step ", this.stepNo, " ", this.stepLabel);
    this.picker.addEventListener("change", () => {
      this.stopPlay();
      this.scenario = this.picker.value;
      this.setStep(0);
    });
    this.prevBtn.addEventListener("click", () => this.setStep(this.step - 1));
    this.nextBtn.addEventListener("click", () => this.setStep(this.step + 1));
    this.pauseBtn.addEventListener("click", () => this.stopPlay());
    this.playBtn.addEventListener("click", () => this.play());
  }

  disconnectedCallback(): void {
    this.stopPlay();
  }

  connectedCallback(): void {
    // Take the fence text out of the light DOM so Material's own Mermaid mount finds nothing.
    if (!this.hasAttribute("source") && this.textContent?.trim()) {
      this.setAttribute("source", this.textContent.replace(/^\n+|\s+$/g, ""));
      this.replaceChildren();
    }
    this.schedule();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.schedule();
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      void this.render();
    });
  }

  private fail(msg: string): void {
    this.errorHost.textContent = msg;
  }

  private async render(): Promise<void> {
    this.errorHost.textContent = "";
    const source = this.source;
    if (!source) return this.fail("docdive: no Mermaid source");
    try {
      const indexUrl = this.getAttribute("index-url") ?? new URL("index.json", here).href;
      const mapUrl = this.getAttribute("map-url") ?? new URL("docdive-map.json", here).href;
      // Prefetched: the clipboard write must run synchronously in the click (transient user activation).
      const contextsUrl = this.getAttribute("contexts-url") ?? new URL("contexts.json", here).href;
      getJson<Record<string, string>>(contextsUrl).then(
        (c) => (this.contexts = c),
        () => (this.contexts = undefined),
      );
      // The doc -> URL map is only needed to find the doc from the page URL; an explicit `doc` attribute works without it.
      [this.index, this.map] = await Promise.all([getJson<Index>(indexUrl), getJson<DocMap>(mapUrl).catch(() => ({}))]);
      if (this.index.version !== INDEX_VERSION) {
        return this.fail(
          `docdive: index.json has schema version ${this.index.version ?? "none"}, this element reads version ${INDEX_VERSION}. Rebuild the index with a matching docdive.`,
        );
      }
      const { doc, n } = this.identity();
      const diagramId = `${doc}#${n}`;
      const diagram = this.index.diagrams.find((d) => d.id === diagramId);
      if (!diagram) return this.fail(`docdive: unknown diagram ${diagramId}`);
      const resolved = await resolveMermaid({ injected: injectedMermaid, win: window, loadBundled });
      let used: string = resolved.source;
      let problem: string | null = null;
      try {
        problem = await this.draw(resolved.mermaid, source, diagram, this.index);
      } catch (e) {
        if (resolved.source === "bundled") throw e;
        problem = String(e);
      }
      if (problem && resolved.source !== "bundled") {
        console.warn(`docdive: host Mermaid (${resolved.source}) could not be mapped (${problem}); using the bundled copy`);
        used = "bundled-fallback";
        problem = await this.draw((await resolveMermaid({ loadBundled })).mermaid, source, diagram, this.index);
      }
      // An unmappable flowchart is not an error on the bundled copy (it never was); it only triggers the fallback.
      if (problem && diagram.type !== "flowchart") this.fail(`docdive: ${problem}`);
      this.setAttribute("data-docdive-mermaid", used);
      this.setAttribute("data-docdive-diagram", diagramId);
      this.diagram = diagram;
      this.page = { doc, n };
      this.initTrace();
      this.restoreSelection();
    } catch (e) {
      this.fail(`docdive: ${String(e)}`);
    }
  }

  // Renders and annotates; returns a problem description when the SVG could not be mapped to the index.
  private async draw(mermaid: MermaidApi, source: string, diagram: DiagramEntry, index: Index): Promise<string | null> {
    const { svg } = await mermaid.render(`docdive-r${renderCount++}`, source);
    this.host.innerHTML = svg;
    const svgEl = this.host.querySelector("svg") as unknown as SVGElement | null;
    if (!svgEl) return "Mermaid produced no SVG";
    if (diagram.type === "flowchart") {
      annotateFlowchart(svgEl, diagram);
      const mapped = (attr: string) => svgEl.querySelectorAll(`[${attr}]`).length;
      if (diagram.nodes.length > 0 && mapped("data-docdive-node") === 0) return "no flowchart node could be mapped";
      if (diagram.edges.length > 0 && mapped("data-docdive-edge") === 0) return "no flowchart edge could be mapped";
    }
    return diagram.type === "sequence" ? annotateSequence(svgEl, diagram, index) : null;
  }

  private identity(): { doc: string; n: number } {
    const explicit = this.getAttribute("doc");
    const doc = explicit ?? Object.entries(this.map).find(([, url]) => normPath(url) === normPath(location.href))?.[0];
    if (!doc) throw new Error(`no doc for ${location.pathname}`);
    const n = this.getAttribute("n") ?? [...document.querySelectorAll("docdive-diagram")].indexOf(this);
    return { doc, n: Number(n) };
  }

  private initTrace(): void {
    this.stopPlay();
    const index = this.index;
    const diagram = this.diagram;
    if (!index || !diagram) return;
    const ids = Object.keys(index.scenarios).filter((id) => touchesDiagram(index, id, diagram));
    if (ids.length === 0) {
      this.traceBar.remove();
      this.throughHost.remove();
      this.scenario = "";
      this.step = 0;
      return;
    }
    this.picker.replaceChildren(...ids.map((id) => new Option(id, id)));
    const q = new URLSearchParams(location.search);
    const wanted = q.get("docdive-scenario");
    const owner = wanted === null || !this.page ? undefined : urlStateOwner(index, this.page.doc, qualifier(q), (d) => touchesDiagram(index, wanted, d));
    const restored = wanted !== null && ids.includes(wanted) && owner === this.page?.n;
    this.scenario = restored ? wanted : (ids[0] as string);
    this.picker.value = this.scenario;
    const n = Number.parseInt(q.get("docdive-step") ?? "", 10);
    this.root.insertBefore(this.traceBar, this.errorHost);
    this.root.insertBefore(this.throughHost, this.errorHost);
    this.setStep(restored && Number.isFinite(n) ? n : 0);
  }

  private steps(): Index["scenarios"][string]["steps"] {
    return this.index?.scenarios[this.scenario]?.steps ?? [];
  }

  private setStep(n: number): void {
    const all = this.steps();
    this.step = Math.max(0, Math.min(all.length, n));
    this.stepNo.textContent = String(this.step);
    this.prevBtn.disabled = this.step === 0;
    this.nextBtn.disabled = this.step >= all.length;
    const s = all[this.step - 1];
    this.stepLabel.textContent = s ? `${s.from} ${s.isReturn ? "-->>" : "->>"} ${s.to}: ${s.label}` : "";
    if (this.index && this.diagram) applyTrace(this.host, this.throughHost, this.index, this.diagram, this.scenario, this.step);
    const open = this.panel.querySelector("[data-docdive-open]");
    const url = this.selected ? this.openUrl(this.selected) : undefined;
    if (open && url) open.setAttribute("href", url);
  }

  private play(): void {
    this.stopPlay();
    if (this.step >= this.steps().length) this.setStep(0);
    const ms = Number(new URLSearchParams(location.search).get("docdive-interval")) || 1000;
    this.timer = setInterval(() => {
      if (this.step >= this.steps().length) this.stopPlay();
      else this.setStep(this.step + 1);
    }, ms);
  }

  private stopPlay(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  // Node click only selects. The deep dive is the panel's "Open" link, so the panel stays reachable.
  private onClick(ev: Event): void {
    const id = (ev.target as Element).closest("[data-docdive-node]")?.getAttribute("data-docdive-node");
    if (!id || !this.index) return;
    this.selected = id;
    this.renderPanel();
  }

  // `docdive-select` restores a selection from a copied link, in the one diagram of the page that owns it.
  private restoreSelection(): void {
    const q = new URLSearchParams(location.search);
    const id = q.get("docdive-select");
    const { index, page } = this;
    if (!id || !index?.elements[id] || !page) return;
    const owner = urlStateOwner(index, page.doc, qualifier(q), (d) => d.nodes.includes(id));
    if (owner !== page.n || !this.host.querySelector(`[data-docdive-node="${CSS.escape(id)}"]`)) return;
    this.selected = id;
    this.renderPanel();
  }

  private renderPanel(): void {
    const id = this.selected;
    if (!id || !this.index) return;
    this.panel.replaceChildren(el("h2", { "data-docdive-title": "" }, id));
    for (const [name, values] of panelFields(this.index, id)) {
      if (values.length === 0) continue;
      const row = el("div", { "data-docdive-field": name });
      row.append(el("strong", {}, `${name}: `), el("span", { "data-docdive-value": "" }, values.join(", ")));
      this.panel.append(row);
    }
    const copy = el("button", { "data-docdive-copy": "" }, "Copy context");
    const status = el("span", { "data-docdive-copy-status": "" });
    copy.addEventListener("click", () => {
      const text = this.contexts?.[id];
      if (text === undefined) {
        status.textContent = "unavailable";
        return;
      }
      const shown = (e: unknown) => (status.textContent = e instanceof Error ? e.name : String(e));
      status.textContent = "pending";
      try {
        // navigator.clipboard is undefined outside a secure context.
        navigator.clipboard.writeText(text).then(() => (status.textContent = "ok"), shown);
      } catch (e) {
        shown(e);
      }
    });
    const link = el("button", { "data-docdive-copy-link": "" }, "Copy link");
    const linkStatus = el("span", { "data-docdive-copy-link-status": "" });
    link.addEventListener("click", () => {
      const shown = (e: unknown) => (linkStatus.textContent = e instanceof Error ? e.name : String(e));
      linkStatus.textContent = "pending";
      try {
        navigator.clipboard.writeText(this.selectionUrl(id)).then(() => (linkStatus.textContent = "ok"), shown);
      } catch (e) {
        shown(e);
      }
    });
    const row = el("div");
    row.append(copy, " ", status, " ", link, " ", linkStatus);
    this.panel.append(row);
    const url = this.openUrl(id);
    if (!url) return;
    const open = el("a", { "data-docdive-open": "", href: url }, `Open ${id}`);
    open.addEventListener("click", (e) => {
      const nav = new CustomEvent("docdive-navigate", {
        detail: { url: open.getAttribute("href"), id },
        cancelable: true,
        bubbles: true,
        composed: true,
      });
      if (!this.dispatchEvent(nav)) e.preventDefault();
    });
    this.panel.append(open);
  }

  // This page's URL restoring the selection and, when active, the trace, in this diagram; other query params are kept.
  private selectionUrl(id: string): string {
    const u = new URL(location.href);
    u.hash = "";
    for (const k of ["docdive-select", "docdive-scenario", "docdive-step", "docdive-diagram"]) u.searchParams.delete(k);
    u.searchParams.set("docdive-select", id);
    if (this.index && this.page && hasSeveralFences(this.index, this.page.doc)) u.searchParams.set("docdive-diagram", String(this.page.n));
    if (this.scenario && this.step >= 1) {
      u.searchParams.set("docdive-scenario", this.scenario);
      u.searchParams.set("docdive-step", String(this.step));
    }
    return u.href;
  }

  // Child doc URL, carrying the trace (scenario + step) when one is active.
  private openUrl(id: string): string | undefined {
    const childDoc = this.index?.elements[id]?.doc;
    const url = childDoc ? this.map[childDoc] : undefined;
    if (!url || !this.scenario || this.step < 1) return url;
    const q = new URLSearchParams({ "docdive-scenario": this.scenario, "docdive-step": String(this.step) });
    return `${url}${url.includes("?") ? "&" : "?"}${q}`;
  }
}

if (!customElements.get("docdive-diagram")) customElements.define("docdive-diagram", DocdiveDiagram);
