import { resolveMermaid, type MermaidApi } from "./mermaid-resolver.js";
import {
  annotateActors,
  annotateFlowchart,
  annotateSequence,
  applyTrace,
  breadcrumb,
  diagramLabel,
  divable,
  drawsElement,
  el,
  hasSeveralFences,
  hostTheme,
  panelFields,
  sourceHref,
  stepSentence,
  THEME_ATTRS,
  touchesDiagram,
  urlStateOwner,
  withTrace,
  type DiagramEntry,
  INDEX_VERSION,
  type Index,
} from "./shared.js";

export { resolveMermaid, type MermaidApi } from "./mermaid-resolver.js";

// <docdive-diagram>: renders one Mermaid fence into its own open shadow root, maps IDs through
// index.json, shows the inspector on node click (or Enter/Space on a focused node), and deep-dives through the
// inspector's "Dive into" link to the child doc's SSG page (cancelable, composed `docdive-navigate` event first;
// `detail: { url, id }`). Layout: breadcrumb, scenario player, diagram, inspector in one column; when a node is
// selected and the element is at least 960px wide, the inspector docks to the right of the diagram.
//
// Styling API: the `--docdive-*` custom properties below and the shadow parts `crumbs`, `trace`, `diagram`, `panel`.
//
// Inputs (all overridable by attribute; defaults sit next to this script so they follow the base URL):
//   source      Mermaid source (attribute/property). Falls back to the light-DOM text, which is then removed.
//   index-url   URL of index.json        (default: ./index.json next to this script)
//   map-url     URL of the doc->URL map  (default: ./docdive-map.json next to this script)
//   contexts-url URL of the context bundles `{ id: markdown }` (default: ./contexts.json next to this script)
//   doc, n      Doc path and fence order (default: found from the page URL via the map; n = order among
//               <docdive-diagram> elements on the page)
//
// Scenario trace: a player in the shadow root, shown only when a scenario touches the diagram. Initial state
// comes from the page query (`docdive-scenario`, `docdive-step`), restored paused, and `docdive-select` (an element ID
// shown in this diagram) reopens its panel (the panel's "Copy link" builds such a URL); invalid values are ignored or
// clamped. On a page with several fences, `docdive-diagram` (fence index) names the diagram that owns this state;
// without it the first diagram that matches owns it and the others start idle. Step changes don't rewrite the URL.
// `docdive-interval` (ms) overrides the play interval.

// doc -> page URL, plus the reserved `sources` (doc -> edit URL) and `sourceUrl` (template) used for the Source link.
interface DocMap {
  [doc: string]: string | Record<string, string> | undefined;
  sources?: Record<string, string>;
  sourceUrl?: string;
}

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

const DARK_TOKENS =
  "--docdive-bg: #111113; --docdive-surface: #18181b; --docdive-surface-2: #1f1f23; --docdive-fg: #e4e4e7; --docdive-fg-muted: #9b9ba6; --docdive-border: #2e2e33; --docdive-accent: #818cf8; --docdive-on-accent: #111113; --docdive-selected: #38bdf8; --docdive-ok: #4ade80; --docdive-error: #f87171; --docdive-node-fill: #18181b; --docdive-node-stroke: #71717a; --docdive-edge: #a1a1aa; --docdive-shadow: 0 1px 2px rgb(0 0 0 / .4), 0 8px 24px -12px rgb(0 0 0 / .6);";

const STYLE = `
:host {
  --docdive-bg: #fafafa; --docdive-surface: #fff; --docdive-surface-2: #f4f4f5; --docdive-fg: #18181b; --docdive-fg-muted: #6b6b76;
  --docdive-border: #e4e4e7; --docdive-accent: #4f46e5; --docdive-on-accent: #fff; --docdive-selected: #0284c7; --docdive-ok: #15803d; --docdive-error: #b91c1c;
  --docdive-node-fill: #fff; --docdive-node-stroke: #8e8e96; --docdive-edge: #71717a;
  --docdive-font: inherit; --docdive-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --docdive-radius: 14px; --docdive-space: 16px; --docdive-duration: 160ms;
  --docdive-shadow: 0 1px 2px rgb(0 0 0 / .04), 0 4px 16px -8px rgb(0 0 0 / .08);
  display: block; container-type: inline-size; font-family: var(--docdive-font); color: var(--docdive-fg); line-height: 1.45;
}
@media (prefers-color-scheme: dark) { :host(:not([data-docdive-theme])) { ${DARK_TOKENS} } }
:host([data-docdive-theme="dark"]) { ${DARK_TOKENS} }
*, *::before, *::after { box-sizing: border-box; }
[data-docdive-layout] { display: grid; gap: var(--docdive-space); grid-template-areas: "crumbs" "trace" "error" "diagram" "panel"; }
[data-docdive-breadcrumb] { grid-area: crumbs; }
[data-docdive-trace] { grid-area: trace; }
[data-docdive-error] { grid-area: error; }
[data-docdive-diagram] { grid-area: diagram; }
[data-docdive-panel] { grid-area: panel; }
[data-docdive-error]:empty, [data-docdive-panel]:empty { display: none; }
[data-docdive-error] { color: var(--docdive-error); font-size: .9em; }
/* Dock: a selected inspector sits beside the diagram once the element is wide enough. */
@container (min-width: 960px) {
  [data-docdive-layout][data-docdive-docked] { grid-template-columns: minmax(0, 1fr) 320px; grid-template-areas: "crumbs crumbs" "trace trace" "error error" "diagram panel"; align-items: start; }
  [data-docdive-layout][data-docdive-docked] [data-docdive-panel] { position: sticky; top: var(--docdive-space); }
}
.card { padding: calc(var(--docdive-space) * 1.25); background: var(--docdive-surface); border: 1px solid var(--docdive-border); border-radius: var(--docdive-radius); box-shadow: var(--docdive-shadow); }
[data-docdive-diagram] { padding: calc(var(--docdive-space) * 1.25); background: var(--docdive-surface); border: 1px solid var(--docdive-border); border-radius: var(--docdive-radius); overflow-x: auto; }
[data-docdive-diagram] svg { display: block; max-width: 100%; height: auto; }

/* Controls */
button, select, a.btn { font: inherit; font-size: .93em; color: inherit; background: var(--docdive-surface); border: 1px solid var(--docdive-border); border-radius: 999px; padding: .3em .9em; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: .4em; line-height: 1.3; transition: background-color var(--docdive-duration), border-color var(--docdive-duration), color var(--docdive-duration); }
button:hover:not(:disabled), select:hover, a.btn:hover { border-color: var(--docdive-accent); background: color-mix(in srgb, var(--docdive-accent) 12%, var(--docdive-surface)); }
button:disabled { opacity: .45; cursor: not-allowed; }
.icon { width: 2.25em; height: 2.25em; padding: 0; justify-content: center; }
.btn.primary, button.primary { background: var(--docdive-accent); color: var(--docdive-on-accent); border-color: var(--docdive-accent); font-weight: 600; justify-self: start; }
.btn.primary:hover, button.primary:hover { background: color-mix(in srgb, var(--docdive-accent) 85%, #000); border-color: transparent; color: var(--docdive-on-accent); }
:is(button, select, a, [data-docdive-node], [data-docdive-pill]):focus-visible { outline: 2px solid var(--docdive-accent); outline-offset: 2px; }
.chip, [data-docdive-through] { display: inline-flex; align-items: center; padding: .1em .7em; border-radius: 999px; background: var(--docdive-surface-2); border: 1px solid transparent; color: inherit; text-decoration: none; font: inherit; font-size: .86em; line-height: 1.6; cursor: default; }
:is(a, button).chip { cursor: pointer; }
:is(a, button).chip:hover { border-color: var(--docdive-accent); color: var(--docdive-accent); background: var(--docdive-surface-2); }
.kind { padding: .05em .6em; background: transparent; border-color: var(--docdive-border); color: var(--docdive-fg-muted); text-transform: uppercase; letter-spacing: .06em; font-size: .72em; font-weight: 600; }
[data-docdive-through] { background: color-mix(in srgb, var(--docdive-accent) 12%, transparent); color: var(--docdive-accent); }
.muted { color: var(--docdive-fg-muted); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

/* Breadcrumb */
[data-docdive-breadcrumb] ol { display: flex; flex-wrap: wrap; gap: .4em; margin: 0; padding: 0; list-style: none; align-items: baseline; font-size: 1.05em; }
[data-docdive-breadcrumb] li + li::before { content: "/"; margin-right: .4em; color: var(--docdive-fg-muted); }
[data-docdive-breadcrumb] a { color: var(--docdive-fg-muted); text-decoration: none; }
[data-docdive-breadcrumb] a:hover { color: var(--docdive-accent); text-decoration: underline; }
[data-docdive-breadcrumb] [aria-current] { font-weight: 650; font-size: 1.3em; letter-spacing: -.02em; }

/* Scenario player */
[data-docdive-trace] { display: grid; gap: .6em; }
[data-docdive-step-label] { margin: 0; font-size: 1.25em; line-height: 1.35; letter-spacing: -.01em; font-weight: 600; }
[data-docdive-step-label] .muted { font-weight: 400; font-size: .8em; }
[data-docdive-pills] { display: flex; flex-wrap: wrap; gap: .3em; margin: 0; padding: 0; list-style: none; }
[data-docdive-pill] { width: 2em; height: 2em; padding: 0; justify-content: center; font-size: .86em; color: var(--docdive-fg-muted); }
[data-docdive-pill][aria-current] { background: var(--docdive-accent); color: var(--docdive-on-accent); border-color: var(--docdive-accent); }
.transport { display: flex; align-items: center; gap: .6em; flex-wrap: wrap; }
.transport > span { display: inline-flex; gap: .25em; }
[data-docdive-counter] { font-variant-numeric: tabular-nums; color: var(--docdive-fg-muted); white-space: nowrap; }
[data-docdive-step] { color: var(--docdive-fg); font-weight: 650; }
[data-docdive-through-host]:empty { display: none; }

/* Inspector */
[data-docdive-panel] { display: grid; gap: calc(var(--docdive-space) * .85); align-content: start; }
[data-docdive-panel] header { display: flex; justify-content: space-between; align-items: flex-start; gap: .5em; }
[data-docdive-panel] header > div { display: flex; gap: .5em; align-items: center; flex-wrap: wrap; }
[data-docdive-title] { margin: 0; font-size: 1.3em; font-weight: 650; letter-spacing: -.01em; }
[data-docdive-close] { border-color: transparent; background: transparent; }
[data-docdive-field] { display: grid; gap: .3em; }
[data-docdive-field] > span:first-child { font-size: .78em; text-transform: uppercase; letter-spacing: .06em; color: var(--docdive-fg-muted); font-weight: 600; }
[data-docdive-field="description"] { color: var(--docdive-fg-muted); }
.chips { display: flex; flex-wrap: wrap; gap: .3em; }
[data-docdive-field="src"] code { font-family: var(--docdive-font-mono); font-size: .92em; }
.actions { display: flex; flex-wrap: wrap; gap: .4em; align-items: center; }
.actions a { color: var(--docdive-accent); text-decoration: none; }
.actions a:hover { text-decoration: underline; }
[data-docdive-copy-status], [data-docdive-copy-link-status] { font-size: .86em; color: var(--docdive-ok); }
[data-docdive-hint] { margin: 0; }

/* Mermaid defaults. Its own <style> uses #id selectors, so these need !important to apply; :where() keeps them at zero
   specificity, so author classDef (!important + #id) and inline style/linkStyle (inline !important / stroke:) still win. */
:where(svg .node :is(rect, circle, ellipse, polygon, path):not(.label *)) { fill: var(--docdive-node-fill) !important; stroke: var(--docdive-node-stroke) !important; stroke-width: 1.5px !important; transition: stroke var(--docdive-duration), fill var(--docdive-duration); }
:where(svg .cluster rect) { fill: var(--docdive-bg) !important; stroke: var(--docdive-border) !important; }
:where(svg .label, svg span, svg p) { color: inherit !important; font-family: var(--docdive-font) !important; }
:where(svg text:not(.sequenceNumber), svg tspan:not(.sequenceNumber)) { fill: currentColor !important; font-family: var(--docdive-font) !important; }
:where(svg path.flowchart-link:not([style*="stroke:"])) { stroke: var(--docdive-edge) !important; }
:where(svg .edgeLabel, svg .edgeLabel p, svg .labelBkg) { background-color: var(--docdive-surface) !important; }
:where(svg .edgeLabel rect) { fill: var(--docdive-surface) !important; opacity: 1 !important; }
:where(svg marker:not([id*="__"]) :is(path, circle, polygon)) { fill: var(--docdive-edge) !important; stroke: var(--docdive-edge) !important; }
:where(svg rect.actor) { fill: var(--docdive-node-fill) !important; stroke: var(--docdive-node-stroke) !important; stroke-width: 1.5px !important; transition: stroke var(--docdive-duration), fill var(--docdive-duration); }
:where(svg .actor-line) { stroke: var(--docdive-border) !important; }
:where(svg [class^="messageLine"], svg .loopLine) { stroke: var(--docdive-edge) !important; stroke-width: 1.5px !important; }
:where(svg .labelBox, svg .note) { fill: var(--docdive-surface) !important; stroke: var(--docdive-border) !important; }
:where(svg [class^="activation"]) { fill: var(--docdive-border) !important; stroke: var(--docdive-edge) !important; }

/* Node states: divable (heavier), hover/focus, selected, trace-active. Selected and active can coexist. */
[data-docdive-node] { cursor: pointer; outline: none; }
[data-docdive-divable] :where(rect, circle, ellipse, polygon, path):not(.label *) { stroke: var(--docdive-fg) !important; stroke-width: 2px !important; }
[data-docdive-divable] :is(.label, text) { font-weight: 600 !important; }
[data-docdive-node]:is(:hover, :focus-visible) :where(rect, circle, ellipse, polygon, path):not(.label *) { stroke: color-mix(in srgb, var(--docdive-accent) 70%, var(--docdive-node-stroke)) !important; }
[data-docdive-node]:focus-visible :where(rect, circle, ellipse, polygon, path):not(.label *) { stroke-width: 2.5px !important; }
[data-docdive-selected] :where(rect, circle, ellipse, polygon, path):not(.label *) { fill: color-mix(in srgb, var(--docdive-selected) 14%, var(--docdive-node-fill)) !important; stroke: var(--docdive-selected) !important; stroke-width: 2.5px !important; }
[data-docdive-active].node :where(rect, polygon, circle, path):not(.label *), [data-docdive-active] rect.actor { stroke: var(--docdive-accent) !important; stroke-width: 3px !important; }
path[data-docdive-active] { stroke: var(--docdive-accent) !important; stroke-width: 3px !important; }
text[data-docdive-active] { fill: var(--docdive-accent) !important; font-weight: bold; }
[class^="messageLine"][data-docdive-active] { stroke: var(--docdive-accent) !important; stroke-width: 3px !important; }
.node[data-docdive-active], path[data-docdive-active], [class^="messageLine"][data-docdive-active] { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--docdive-accent) 55%, transparent)); }
`;

let renderCount = 0;

// A button copying `text()` to the clipboard, and its status (`Copied` for 1.5 s, else `unavailable` or the error name).
// The write stays synchronous in the click: an await before it can lose the transient user activation.
function copyButton(label: string, attr: string, text: () => string | undefined): [HTMLButtonElement, HTMLSpanElement] {
  const button = el("button", { [attr]: "" }, label);
  const status = el("span", { [`${attr}-status`]: "", role: "status" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener("click", () => {
    const value = text();
    clearTimeout(timer);
    if (value === undefined) return void (status.textContent = "unavailable");
    const shown = (e: unknown) => (status.textContent = e instanceof Error ? e.name : String(e));
    status.textContent = "";
    try {
      // navigator.clipboard is undefined outside a secure context.
      navigator.clipboard.writeText(value).then(() => {
        status.textContent = "Copied";
        timer = setTimeout(() => (status.textContent = ""), 1500);
      }, shown);
    } catch (e) {
      shown(e);
    }
  });
  return [button, status];
}

// `docdive-diagram`: the fence a link was copied from; null (absent or invalid) means unqualified.
const qualifier = (q: URLSearchParams): number | null => {
  const n = Number.parseInt(q.get("docdive-diagram") ?? "", 10);
  return Number.isFinite(n) ? n : null;
};

const FIELD_LABELS: Record<string, string> = { parent: "Parent", children: "Children", appearsIn: "Appears in", scenarios: "Scenarios" };

export class DocdiveDiagram extends HTMLElement {
  static observedAttributes = ["source", "index-url", "map-url", "contexts-url", "doc", "n"];

  private root = this.attachShadow({ mode: "open" });
  private layout = el("div", { "data-docdive-layout": "" });
  private host = el("div", { "data-docdive-diagram": "", part: "diagram" });
  private errorHost = el("div", { "data-docdive-error": "" });
  private panel = el("aside", { "data-docdive-panel": "", part: "panel", "aria-label": "Element details" });
  private index?: Index;
  private map: DocMap = {};
  private contexts?: Record<string, string>;
  private scheduled = false;
  private selected: string | null = null;
  private scenario = "";
  private step = 0;
  private diagram?: DiagramEntry;
  private page?: { doc: string; n: number };
  private themeObserver?: MutationObserver;
  private timer?: ReturnType<typeof setInterval>;
  private traceBar = el("div", { "data-docdive-trace": "", part: "trace", "aria-label": "Scenario player" });
  private picker = el("select", { "data-docdive-scenario-picker": "", "aria-label": "Scenario" });
  private prevBtn = el("button", { "data-docdive-prev": "", class: "icon", "aria-label": "Previous step", title: "Previous step" }, "\u2039");
  private nextBtn = el("button", { "data-docdive-next": "", class: "icon", "aria-label": "Next step", title: "Next step" }, "\u203A");
  // One toggle: carries `data-docdive-play` while paused and `data-docdive-pause` while playing.
  private playBtn = el("button", { "data-docdive-play": "", class: "icon", "aria-label": "Play", title: "Play" }, "\u25B6");
  private stepNo = el("span", { "data-docdive-step": "" }, "0");
  private stepTotal = el("span", {}, " / 0");
  private pills = el("ol", { "data-docdive-pills": "", "aria-label": "Steps" });
  private stepLabel = el("p", { "data-docdive-step-label": "", "aria-live": "polite" });
  private crumbs = el("nav", { "data-docdive-breadcrumb": "", part: "crumbs", "aria-label": "Breadcrumb" });
  private crumbLinks: [HTMLAnchorElement, string][] = [];
  private throughHost = el("div", { "data-docdive-through-host": "" });

  get source(): string {
    return this.getAttribute("source") ?? "";
  }
  set source(v: string) {
    this.setAttribute("source", v);
  }

  constructor() {
    super();
    this.layout.append(this.errorHost, this.host, this.panel);
    this.root.append(el("style", {}, STYLE), this.layout);
    this.host.addEventListener("click", (ev) => this.onSelect(ev));
    this.host.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") this.onSelect(ev);
    });
    const counter = el("span", { "data-docdive-counter": "" });
    counter.append(this.stepNo, this.stepTotal);
    const buttons = el("span");
    buttons.append(this.prevBtn, this.playBtn, this.nextBtn);
    const transport = el("div", { class: "transport" });
    transport.append(this.picker, buttons, counter);
    this.traceBar.append(this.stepLabel, this.pills, transport, this.throughHost);
    this.picker.addEventListener("change", () => {
      this.stopPlay();
      this.scenario = this.picker.value;
      this.setStep(0);
    });
    this.prevBtn.addEventListener("click", () => this.setStep(this.step - 1));
    this.nextBtn.addEventListener("click", () => this.setStep(this.step + 1));
    this.playBtn.addEventListener("click", () => (this.timer ? this.stopPlay() : this.play()));
    this.pills.addEventListener("click", (ev) => {
      const n = (ev.target as Element).closest("[data-docdive-pill]")?.getAttribute("data-docdive-pill");
      if (!n) return;
      this.stopPlay();
      this.setStep(Number(n));
    });
    this.traceBar.addEventListener("keydown", (ev) => {
      if ((ev.target as Element).tagName === "SELECT") return;
      if (ev.key === "ArrowRight") this.setStep(this.step + 1);
      if (ev.key === "ArrowLeft") this.setStep(this.step - 1);
    });
  }

  disconnectedCallback(): void {
    this.stopPlay();
    this.themeObserver?.disconnect();
  }

  // Shadow DOM cannot see host attributes from CSS, so the host theme is mirrored onto this element.
  private syncTheme = (): void => {
    const theme = hostTheme(document);
    if (theme) this.setAttribute("data-docdive-theme", theme);
    else this.removeAttribute("data-docdive-theme");
  };

  connectedCallback(): void {
    this.syncTheme();
    this.themeObserver ??= new MutationObserver(this.syncTheme);
    const opts = { attributes: true, attributeFilter: THEME_ATTRS };
    this.themeObserver.observe(document.documentElement, opts);
    if (document.body) this.themeObserver.observe(document.body, opts);
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
      const resolved = await resolveMermaid({ injected: injectedMermaid, win: window, loadBundled });
      if (!diagram) {
        // Not indexed (pie, state, a flowchart docdive cannot parse): draw it plain rather than hide it.
        this.host.innerHTML = (await resolved.mermaid.render(`docdive-r${renderCount++}`, source)).svg;
        return;
      }
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
      this.renderBreadcrumb();
      this.initTrace();
      this.renderPanel();
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
      annotateFlowchart(svgEl, diagram, index);
      const mapped = (attr: string) => svgEl.querySelectorAll(`[${attr}]`).length;
      if (diagram.nodes.length > 0 && mapped("data-docdive-node") === 0) return "no flowchart node could be mapped";
      if (diagram.edges.length > 0 && mapped("data-docdive-edge") === 0) return "no flowchart edge could be mapped";
    }
    if (diagram.type !== "sequence") return null;
    annotateActors(svgEl, diagram, index);
    return annotateSequence(svgEl, diagram, index);
  }

  private identity(): { doc: string; n: number } {
    const explicit = this.getAttribute("doc");
    const doc = explicit ?? Object.entries(this.map).find(([, url]) => typeof url === "string" && normPath(url) === normPath(location.href))?.[0];
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
    this.layout.insertBefore(this.traceBar, this.errorHost);
    this.setStep(restored && Number.isFinite(n) ? n : 0);
  }

  private steps(): Index["scenarios"][string]["steps"] {
    return this.index?.scenarios[this.scenario]?.steps ?? [];
  }

  private setStep(n: number): void {
    const all = this.steps();
    this.step = Math.max(0, Math.min(all.length, n));
    this.stepNo.textContent = String(this.step);
    this.stepTotal.textContent = ` / ${all.length}`;
    this.prevBtn.disabled = this.step === 0;
    this.nextBtn.disabled = this.step >= all.length;
    if (this.pills.getAttribute("data-for") !== this.scenario) {
      this.pills.setAttribute("data-for", this.scenario);
      this.pills.replaceChildren(
        ...all.map((s, i) => {
          const li = el("li");
          li.append(el("button", { "data-docdive-pill": String(i + 1), title: stepSentence(s), "aria-label": `Step ${i + 1}: ${stepSentence(s)}` }, String(i + 1)));
          return li;
        }),
      );
    }
    for (const pill of this.pills.querySelectorAll("[data-docdive-pill]")) {
      if (pill.getAttribute("data-docdive-pill") === String(this.step)) pill.setAttribute("aria-current", "step");
      else pill.removeAttribute("aria-current");
    }
    const s = all[this.step - 1];
    this.stepLabel.replaceChildren();
    if (s) this.stepLabel.textContent = stepSentence(s);
    else this.stepLabel.append(el("span", { class: "muted" }, "Press play or step through the scenario."));
    if (this.index && this.diagram) applyTrace(this.host, this.throughHost, this.index, this.diagram, this.scenario, this.step);
    const open = this.panel.querySelector("[data-docdive-open]");
    const url = this.selected ? this.openUrl(this.selected) : undefined;
    if (open && url) open.setAttribute("href", url);
    for (const [a, id] of this.crumbLinks) a.setAttribute("href", this.openUrl(id) ?? "");
  }

  // Root-to-owner trail above the diagram; absent (no DOM) when the owner has no unambiguous ancestor.
  private renderBreadcrumb(): void {
    const trail = this.index && this.page ? breadcrumb(this.index, this.page.doc) : [];
    this.crumbLinks = [];
    if (trail.length === 0) return this.crumbs.remove();
    const ol = el("ol");
    trail.forEach((id, i) => {
      const li = el("li");
      const url = i < trail.length - 1 ? this.openUrl(id) : undefined;
      if (url) {
        const a = el("a", { "data-docdive-crumb": id, href: url }, id);
        this.linkNavigate(a, id);
        this.crumbLinks.push([a, id]);
        li.append(a);
      } else {
        li.append(el("span", i === trail.length - 1 ? { "data-docdive-crumb": id, "aria-current": "page" } : { "data-docdive-crumb": id }, id));
      }
      ol.append(li);
    });
    this.crumbs.replaceChildren(ol);
    this.layout.prepend(this.crumbs);
  }

  // Lets an SSG route in-app: the cancelable, composed `docdive-navigate` fires before the link is followed.
  private linkNavigate(a: HTMLAnchorElement, id: string): void {
    a.addEventListener("click", (e) => {
      const nav = new CustomEvent("docdive-navigate", {
        detail: { url: a.getAttribute("href"), id },
        cancelable: true,
        bubbles: true,
        composed: true,
      });
      if (!this.dispatchEvent(nav)) e.preventDefault();
    });
  }

  private play(): void {
    this.stopPlay();
    if (this.step >= this.steps().length) this.setStep(0);
    const ms = Number(new URLSearchParams(location.search).get("docdive-interval")) || 1000;
    this.timer = setInterval(() => {
      if (this.step >= this.steps().length) this.stopPlay();
      else this.setStep(this.step + 1);
    }, ms);
    this.setPlaying(true);
  }

  private stopPlay(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.setPlaying(false);
  }

  private setPlaying(on: boolean): void {
    this.playBtn.toggleAttribute("data-docdive-play", !on);
    this.playBtn.toggleAttribute("data-docdive-pause", on);
    this.playBtn.textContent = on ? "\u23F8" : "\u25B6";
    this.playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    this.playBtn.setAttribute("title", on ? "Pause" : "Play");
  }

  // Node click (or Enter/Space) only selects. The deep dive is the inspector's link, so the inspector stays reachable.
  private onSelect(ev: Event): void {
    const id = (ev.target as Element).closest("[data-docdive-node]")?.getAttribute("data-docdive-node");
    if (!id || !this.index) return;
    ev.preventDefault();
    this.selected = id;
    this.renderPanel();
  }

  // `docdive-select` restores a selection from a copied link, in the one diagram of the page that owns it.
  private restoreSelection(): void {
    const q = new URLSearchParams(location.search);
    const id = q.get("docdive-select");
    const { index, page } = this;
    if (!id || !index?.elements[id] || !page) return;
    const owner = urlStateOwner(index, page.doc, qualifier(q), (d) => drawsElement(d, id));
    if (owner !== page.n || !this.host.querySelector(`[data-docdive-node="${CSS.escape(id)}"]`)) return;
    this.selected = id;
    this.renderPanel();
  }

  // A relation value as a chip: a link when it leads somewhere, a scenario chip plays that scenario, else plain text.
  private chip(name: string, value: string): HTMLElement {
    const attrs = { "data-docdive-value": "", class: "chip" };
    if (name === "scenarios") {
      const b = el("button", attrs, value);
      b.addEventListener("click", () => {
        if (![...this.picker.options].some((o) => o.value === value)) return;
        this.stopPlay();
        this.picker.value = value;
        this.scenario = value;
        this.setStep(1);
      });
      return b;
    }
    const index = this.index as Index;
    const url = name === "appearsIn" ? this.docUrl(value.slice(0, value.lastIndexOf("#"))) : this.openUrl(value);
    const label = name === "appearsIn" ? diagramLabel(index, value) : value;
    if (!url) return el("span", attrs, label);
    const a = el("a", { ...attrs, href: url }, label);
    this.linkNavigate(a, name === "appearsIn" ? label : value);
    return a;
  }

  private renderPanel(): void {
    const id = this.selected;
    const index = this.index;
    this.layout.toggleAttribute("data-docdive-docked", Boolean(id));
    for (const n of this.host.querySelectorAll("[data-docdive-selected]")) n.removeAttribute("data-docdive-selected");
    if (!id || !index) {
      this.panel.replaceChildren();
      this.panel.classList.remove("card");
      if (this.host.querySelector("[data-docdive-divable]")) {
        this.panel.append(el("p", { "data-docdive-hint": "", class: "muted" }, "Click a box to inspect it; bold boxes have a diagram of their own."));
      }
      return;
    }
    this.host.querySelector(`[data-docdive-node="${CSS.escape(id)}"]`)?.setAttribute("data-docdive-selected", "");
    this.panel.classList.add("card");
    const deep = divable(index, id);
    const titleRow = el("div");
    titleRow.append(el("h2", { "data-docdive-title": "" }, id), el("span", { class: "chip kind" }, deep ? "has diagram" : "leaf"));
    const close = el("button", { "data-docdive-close": "", class: "icon", "aria-label": "Close", title: "Close" }, "\u00D7");
    close.addEventListener("click", () => {
      this.selected = null;
      this.renderPanel();
    });
    const header = el("header");
    header.append(titleRow, close);
    this.panel.replaceChildren(header);
    const description = index.elements[id]?.description;
    if (description) {
      const row = el("div", { "data-docdive-field": "description" });
      row.append(el("span", { "data-docdive-value": "" }, description));
      this.panel.append(row);
    }
    const url = this.openUrl(id);
    if (url) {
      const open = el("a", { "data-docdive-open": "", class: "btn primary", href: url }, `Dive into ${id} \u2192`);
      this.linkNavigate(open, id);
      this.panel.append(open);
    }
    for (const [name, values] of panelFields(index, id)) {
      if (values.length === 0) continue;
      const row = el("div", { "data-docdive-field": name });
      const chips = el("div", { class: "chips" });
      chips.append(...values.map((v) => this.chip(name, v)));
      row.append(el("span", {}, FIELD_LABELS[name] ?? name), chips);
      this.panel.append(row);
    }
    const src = index.elements[id]?.src ?? [];
    if (src.length > 0) {
      const row = el("div", { "data-docdive-field": "src" });
      const list = el("div", { class: "chips" });
      list.append(...src.map((p) => el("code", { "data-docdive-value": "" }, p)));
      row.append(el("span", {}, "Source"), list);
      this.panel.append(row);
    }
    const actions = el("div", { class: "actions" });
    const [copy, copyStatus] = copyButton("Copy context", "data-docdive-copy", () => this.contexts?.[id]);
    const [link, linkStatus] = copyButton("Copy link", "data-docdive-copy-link", () => this.selectionUrl(id));
    actions.append(copy, link);
    const line = this.diagram?.lines?.[id];
    const doc = this.page?.doc;
    const href = doc && line ? sourceHref(this.map.sources?.[doc], this.map.sourceUrl, doc, line) : null;
    if (href) actions.append(el("a", { "data-docdive-source": "", href, target: "_blank", rel: "noopener" }, "Source \u2197"));
    actions.append(copyStatus, linkStatus);
    this.panel.append(actions);
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

  // Page URL of a doc from the map, undefined when unmapped.
  private docUrl(doc: string): string | undefined {
    const mapped = this.map[doc];
    return typeof mapped === "string" ? mapped : undefined;
  }

  // Child doc URL, carrying the trace (scenario + step) when one is active.
  private openUrl(id: string): string | undefined {
    const childDoc = this.index?.elements[id]?.doc;
    const url = childDoc ? this.docUrl(childDoc) : undefined;
    return url && withTrace(url, this.scenario, this.step);
  }
}

if (!customElements.get("docdive-diagram")) customElements.define("docdive-diagram", DocdiveDiagram);
