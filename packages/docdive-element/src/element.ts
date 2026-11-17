import { resolveMermaid, type MermaidApi } from "./mermaid-resolver.js";
import { getJson, here, observeTheme, TOKEN_STYLE } from "./runtime.js";
import "./map.js";
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
  entityTrail,
  hasSeveralFences,
  hasState,
  panelFields,
  relevantHolder,
  sourceHref,
  stateAt,
  stateSteps,
  stepSentence,
  touchesDiagram,
  urlStateOwner,
  withTrace,
  type DiagramEntry,
  INDEX_VERSION,
  type Index,
  type StateCard,
  type StateField,
} from "./shared.js";

export { resolveMermaid, type MermaidApi } from "./mermaid-resolver.js";

// <docdive-diagram>: renders one Mermaid fence into its own open shadow root, maps IDs through
// index.json, shows the inspector on node click (or Enter/Space on a focused node), and deep-dives through the
// inspector's "Dive into" link to the child doc's SSG page (cancelable, composed `docdive-navigate` event first;
// `detail: { url, id }`). Layout: breadcrumb, scenario player, diagram, inspector in one column; when a node is
// selected and the element is at least 960px wide, the inspector docks to the right of the diagram.
//
// Styling API: the `--docdive-*` custom properties below and the shadow parts `crumbs`, `trace`, `diagram`, `zoom`, `panel`.
//
// Inputs (all overridable by attribute; defaults sit next to this script so they follow the base URL):
//   source      Mermaid source (attribute/property). Falls back to the light-DOM text, which is then removed.
//   index-url   URL of index.json        (default: ./index.json next to this script)
//   map-url     URL of the doc->URL map  (default: ./docdive-map.json next to this script)
//   contexts-url URL of the context bundles `{ id: markdown }` (default: ./contexts.json next to this script)
//   doc, n      Doc path and fence order (default: found from the page URL via the map; n = order among
//               <docdive-diagram> elements on the page)
//
// Scenario trace: a player in the shadow root, shown only when a scenario touches the diagram: one play/pause glyph,
// a scrubbable rail (`data-docdive-scrub`, a slider; `data-docdive-mark` per step), the `n / N` counter, the step
// sentence, and under it the state strip (`data-docdive-state`): what each drawn participant holds at this step,
// The diagram card fits the window by default (width and `--docdive-diagram-max-height`); its zoom controls
// (`data-docdive-zoom`: Fit, −, +, 100%) scale the SVG, the viewport then scrolls and follows the active message.
// Clicking a message jumps to its step.
// from the scenario's `Note over X: Entity k=v …` lines, by participant or by entity. Initial state
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

// Compare URLs by path only, ignoring trailing slash, index.html and .html.
const normPath = (u: string): string =>
  new URL(u, location.href).pathname.replace(/\/index\.html$/, "").replace(/\.html$/, "").replace(/\/+$/, "");

const STYLE = `
${TOKEN_STYLE}
:host { container-type: inline-size; }
[hidden] { display: none !important; }
[data-docdive-layout] { display: grid; gap: var(--docdive-space); grid-template-columns: minmax(0, 1fr); grid-template-areas: "crumbs" "trace" "error" "diagram" "panel"; }
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
/* The diagram card: the zoom bar on its own row (it never covers a node), then a viewport that fits the window
   (width and height) by default and scrolls once zoomed in. The SVG's width is set inline by setZoom(). */
[data-docdive-diagram] { display: grid; grid-template-columns: minmax(0, 1fr); gap: .6em; padding: calc(var(--docdive-space) * 1.25); background: var(--docdive-surface); border: 1px solid var(--docdive-border); border-radius: var(--docdive-radius); }
[data-docdive-viewport] { min-width: 0; overflow: auto; max-height: var(--docdive-diagram-max-height); scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { [data-docdive-viewport] { scroll-behavior: auto; } }
[data-docdive-viewport] svg { display: block; height: auto; max-width: none; }
[data-docdive-zoom] { justify-self: end; }
[data-docdive-zoom] button { min-width: 2.2em; justify-content: center; }
[data-docdive-zoom-level] { align-self: center; min-width: 3.6em; text-align: center; font-size: .86em; font-variant-numeric: tabular-nums; }

/* Controls */
button, select, a.btn { font: inherit; font-size: .93em; color: inherit; background: var(--docdive-surface); border: 1px solid var(--docdive-border); border-radius: 999px; padding: .3em .9em; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: .4em; line-height: 1.3; transition: background-color var(--docdive-duration), border-color var(--docdive-duration), color var(--docdive-duration); }
button:hover:not(:disabled), select:hover, a.btn:hover { border-color: var(--docdive-accent); background: color-mix(in srgb, var(--docdive-accent) 12%, var(--docdive-surface)); }
button:disabled { opacity: .45; cursor: not-allowed; }
.icon { width: 2.25em; height: 2.25em; padding: 0; justify-content: center; }
.btn.primary, button.primary { background: var(--docdive-accent); color: var(--docdive-on-accent); border-color: var(--docdive-accent); font-weight: 600; justify-self: start; }
.btn.primary:hover, button.primary:hover { background: color-mix(in srgb, var(--docdive-accent) 85%, #000); border-color: transparent; color: var(--docdive-on-accent); }
:is(button, select, a, [data-docdive-node], [data-docdive-scrub]):focus-visible { outline: 2px solid var(--docdive-accent); outline-offset: 2px; }
[data-docdive-through] { display: inline-flex; align-items: center; padding: .1em .7em; border-radius: 999px; font-size: .86em; line-height: 1.6; background: color-mix(in srgb, var(--docdive-accent) 12%, transparent); color: var(--docdive-accent); }

/* Breadcrumb */
[data-docdive-breadcrumb] ol { display: flex; flex-wrap: wrap; gap: .4em; margin: 0; padding: 0; list-style: none; align-items: baseline; font-size: 1.05em; }
[data-docdive-breadcrumb] li + li::before { content: "/"; margin-right: .4em; color: var(--docdive-fg-muted); }
[data-docdive-breadcrumb] a { color: var(--docdive-fg-muted); text-decoration: none; }
[data-docdive-breadcrumb] a:hover { color: var(--docdive-accent); text-decoration: underline; }
[data-docdive-breadcrumb] [aria-current] { font-weight: 650; font-size: 1.3em; letter-spacing: -.02em; }

/* Scenario player: glyph + rail + counter on one row, the sentence under it, then the state strip. */
[data-docdive-trace] { display: grid; gap: .75em; }
.rail-row { display: flex; align-items: center; gap: 1em; }
[data-docdive-step-label] { margin: 0; font-size: 1.25em; line-height: 1.35; letter-spacing: -.01em; font-weight: 600; }
[data-docdive-step-label] .muted { font-weight: 400; font-size: .8em; }
[data-docdive-counter] { font-variant-numeric: tabular-nums; color: var(--docdive-fg-muted); white-space: nowrap; font-size: .93em; }
[data-docdive-step] { color: var(--docdive-fg); font-weight: 650; }
[data-docdive-through-host]:empty { display: none; }
/* One button: ▶ while paused (data-docdive-play), ⏸ while playing (data-docdive-pause); the icon is CSS. */
.glyph { background: var(--docdive-accent); border-color: var(--docdive-accent); color: var(--docdive-on-accent); flex: none; }
.glyph:hover:not(:disabled) { background: color-mix(in srgb, var(--docdive-accent) 85%, #000); border-color: transparent; box-shadow: var(--docdive-shadow); }
.glyph-icon { display: block; width: 0; height: 0; border-style: solid; border-width: 7px 0 7px 12px; border-color: transparent transparent transparent currentColor; margin-left: 3px; transition: border-width var(--docdive-duration), margin var(--docdive-duration); }
[data-docdive-pause] .glyph-icon { width: 4px; height: 14px; border-width: 0 4px; border-color: currentColor; margin-left: 0; }
/* Rail: the slider. Track + fill behind, one mark per step on top (28px targets, 10px dots). */
[data-docdive-scrub] { position: relative; flex: 1; height: 2.25em; min-width: 8em; cursor: pointer; touch-action: none; border-radius: 999px; }
.rail-track { position: absolute; left: 0; right: 0; top: 50%; height: 4px; transform: translateY(-50%); border-radius: 999px; background: var(--docdive-border); overflow: hidden; }
.rail-fill { height: 100%; width: 0; background: var(--docdive-accent); transition: width var(--docdive-duration) ease-out; }
.marks { position: absolute; inset: 0; margin: 0; padding: 0; list-style: none; }
.marks li { position: absolute; top: 50%; transform: translate(-50%, -50%); }
[data-docdive-mark] { display: block; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: transparent; cursor: pointer; position: relative; }
[data-docdive-mark]::before { content: ""; position: absolute; inset: 50%; width: 10px; height: 10px; transform: translate(-50%, -50%); border-radius: 999px; background: var(--docdive-surface); border: 2px solid var(--docdive-node-stroke); transition: all var(--docdive-duration); }
[data-docdive-mark][data-has-state]::after { content: ""; position: absolute; inset: 50%; width: 4px; height: 4px; transform: translate(-50%, -50%); border-radius: 999px; background: var(--docdive-fg-muted); }
[data-docdive-mark]:is([data-past], [aria-current])::after { background: var(--docdive-on-accent); }
[data-docdive-mark][data-past]::before { background: var(--docdive-accent); border-color: var(--docdive-accent); }
[data-docdive-mark]:hover::before { transform: translate(-50%, -50%) scale(1.3); border-color: var(--docdive-accent); }
/* Dense rail (< 20px per step): only the playhead and the steps that write state keep a dot. */
[data-dense] [data-docdive-mark]:not([aria-current], [data-has-state])::before { display: none; }
[data-docdive-mark][aria-current]::before { width: 16px; height: 16px; background: var(--docdive-accent); border-color: var(--docdive-surface); box-shadow: 0 0 0 2px var(--docdive-accent), 0 0 0 6px color-mix(in srgb, var(--docdive-accent) 12%, transparent); }
/* State strip: cards per participant, or one trail per entity. */
[data-docdive-state] { display: grid; gap: .75em; padding-top: .75em; border-top: 1px solid var(--docdive-border); }
.state-head { display: flex; justify-content: space-between; align-items: center; gap: .5em; flex-wrap: wrap; }
.state-head .label { font-size: .78em; text-transform: uppercase; letter-spacing: .06em; color: var(--docdive-fg-muted); font-weight: 600; }
.mode { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--docdive-border); border-radius: 999px; }
.mode button { border: 0; background: transparent; padding: .2em .8em; font-size: .86em; color: var(--docdive-fg-muted); }
.mode button[aria-pressed="true"] { background: var(--docdive-fg); color: var(--docdive-bg); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: .75em; }
[data-docdive-state-card] { display: grid; gap: .5em; align-content: start; padding: .75em; border-radius: calc(var(--docdive-radius) - 4px); background: var(--docdive-bg); border: 1px solid var(--docdive-border); transition: border-color var(--docdive-duration), box-shadow var(--docdive-duration); }
[data-docdive-state-card] header { display: flex; justify-content: space-between; align-items: center; gap: .5em; }
[data-docdive-state-card][data-changed] { border-color: var(--docdive-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--docdive-accent) 12%, transparent); }
.owner { font: inherit; font-weight: 650; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; border-radius: 4px; }
.owner:hover { color: var(--docdive-accent); text-decoration: underline; }
.chip.entity { background: transparent; border: 1px solid var(--docdive-border); font-weight: 650; font-size: .8em; }
.fields { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: flex-start; }
[data-docdive-field-chip] { display: inline-flex; align-items: baseline; gap: 4px; padding: 1px 8px; border-radius: 6px; background: var(--docdive-surface-2); font-family: var(--docdive-font-mono); font-size: .82em; line-height: 1.6; }
[data-docdive-field-chip] .k { color: var(--docdive-fg-muted); }
[data-docdive-field-chip] .k::after { content: "="; margin-left: 2px; }
[data-docdive-field-chip][data-changed] { background: color-mix(in srgb, var(--docdive-accent) 12%, transparent); color: var(--docdive-accent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--docdive-accent) 35%, transparent); }
[data-docdive-field-chip][data-changed] .k { color: color-mix(in srgb, var(--docdive-accent) 70%, var(--docdive-fg-muted)); }
.state-text { margin: 0; font-size: .86em; color: var(--docdive-fg-muted); }
.state-empty { margin: 0; color: var(--docdive-fg-muted); }
.trails { display: grid; gap: 1em; }
.trail-row { display: grid; grid-template-columns: 180px 1fr; gap: .75em; align-items: start; }
.trail-head { display: grid; gap: 4px; justify-items: start; font-size: .9em; color: var(--docdive-fg-muted); }
.trail-row[data-changed] .chip.entity { border-color: var(--docdive-accent); color: var(--docdive-accent); }
.trail { display: flex; flex-wrap: wrap; gap: 6px 0; margin: 0; padding: 0; list-style: none; align-items: center; }
.trail li { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 2px; border-radius: 999px; border: 1px solid transparent; transition: border-color var(--docdive-duration), color var(--docdive-duration); }
.trail li + li::before { content: "→"; color: var(--docdive-fg-muted); margin-right: 6px; }
.trail li[data-future], .trail li[data-future] [data-docdive-field-chip] { color: var(--docdive-fg-muted); }
.trail li[data-now] { border-color: var(--docdive-accent); background: color-mix(in srgb, var(--docdive-accent) 12%, transparent); }
.trail li[data-now] [data-docdive-field-chip] { background: var(--docdive-surface); }
[data-docdive-trail-step] { width: 28px; height: 28px; padding: 0; justify-content: center; font-size: .78em; color: var(--docdive-fg-muted); }
.trail li:not([data-future]) [data-docdive-trail-step] { background: var(--docdive-accent); color: var(--docdive-on-accent); border-color: var(--docdive-accent); }
.trail-owner { font-size: .86em; font-weight: 600; }
@container (max-width: 720px) { .trail-row { grid-template-columns: 1fr; } }

/* Inspector */
[data-docdive-panel] { display: grid; gap: calc(var(--docdive-space) * .85); align-content: start; }
[data-docdive-panel] header { display: flex; justify-content: space-between; align-items: flex-start; gap: .5em; }
[data-docdive-panel] header > div { display: flex; gap: .5em; align-items: center; flex-wrap: wrap; }
[data-docdive-title] { margin: 0; font-size: 1.3em; font-weight: 650; letter-spacing: -.01em; }
[data-docdive-close] { border-color: transparent; background: transparent; }
[data-docdive-field] { display: grid; gap: .3em; }
[data-docdive-field] > .label { font-size: .78em; text-transform: uppercase; letter-spacing: .06em; color: var(--docdive-fg-muted); font-weight: 600; }
[data-docdive-field="description"] { color: var(--docdive-fg-muted); }
.chips { display: flex; flex-wrap: wrap; gap: .3em; }
[data-docdive-field="src"] code { font-family: var(--docdive-font-mono); font-size: .92em; }
.actions { display: flex; flex-wrap: wrap; gap: .4em; align-items: center; }
.actions a { color: var(--docdive-accent); text-decoration: none; }
.actions a:hover { text-decoration: underline; }
[data-docdive-copy-status], [data-docdive-copy-link-status] { font-size: .86em; color: var(--docdive-ok); }
[data-docdive-field="state"] { padding: .6em .75em; border-radius: calc(var(--docdive-radius) - 4px); background: var(--docdive-bg); border: 1px solid var(--docdive-border); justify-items: start; gap: .5em; }
[data-docdive-field="state"]:empty { display: none; }
[data-docdive-field="state"] > div { display: grid; gap: .4em; justify-items: start; }
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
/* A message is a step: click it to jump there. */
[data-docdive-message] { cursor: pointer; }
text[data-docdive-message]:hover { fill: var(--docdive-accent) !important; }
[class^="messageLine"][data-docdive-message]:hover { stroke: var(--docdive-accent) !important; }
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
  // The scroll container holding the SVG; `zoom` is a scale factor, "fit" = the largest scale (≤ 1) showing it whole.
  private viewport = el("div", { "data-docdive-viewport": "" });
  private zoom: number | "fit" = "fit";
  private zoomBar = el("div", { "data-docdive-zoom": "", part: "zoom", class: "mode", role: "group", "aria-label": "Zoom" });
  private zoomReadout = el("span", { "data-docdive-zoom-level": "", class: "muted" });
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
  private unobserveTheme?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private traceBar = el("div", { "data-docdive-trace": "", part: "trace", "aria-label": "Scenario player" });
  private picker = el("select", { "data-docdive-scenario-picker": "", "aria-label": "Scenario" });
  // One toggle: carries `data-docdive-play` while paused and `data-docdive-pause` while playing; the icon is CSS.
  private playBtn = el("button", { "data-docdive-play": "", class: "icon glyph", "aria-label": "Play", title: "Play" });
  private stepNo = el("span", { "data-docdive-step": "" }, "0");
  private stepTotal = el("span", {}, " / 0");
  // The rail is the slider (one focus stop); each step is a mark on it.
  private rail = el("div", { "data-docdive-scrub": "", role: "slider", tabindex: "0", "aria-label": "Scenario step", "aria-valuemin": "0" });
  private railFill = el("div", { class: "rail-fill" });
  private marks = el("ol", { class: "marks", "aria-hidden": "true" });
  private strip = el("div", { "data-docdive-state": "", part: "state", "aria-label": "State at this step" });
  private stripMode: "participants" | "entities" = "participants";
  private panelState = el("div", { "data-docdive-field": "state" });
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
    this.viewport.addEventListener("click", (ev) => this.onSelect(ev));
    this.viewport.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") this.onSelect(ev);
    });
    // Zoom: Fit (default) | − | readout | + | 100 %. ± step by 1.25×; the viewport refits on resize while in Fit.
    const zoomBtn = (action: string, label: string, aria: string) => el("button", { "data-docdive-zoom-action": action, "aria-label": aria, title: aria }, label);
    this.zoomBar.append(zoomBtn("fit", "Fit", "Fit the diagram in the window"), zoomBtn("out", "\u2212", "Zoom out"), this.zoomReadout, zoomBtn("in", "+", "Zoom in"), zoomBtn("reset", "100%", "Actual size"));
    this.zoomBar.addEventListener("click", (ev) => {
      const action = (ev.target as Element).closest("[data-docdive-zoom-action]")?.getAttribute("data-docdive-zoom-action");
      if (!action) return;
      const z = this.currentZoom();
      this.setZoom(action === "fit" ? "fit" : action === "reset" ? 1 : Math.min(4, Math.max(0.1, action === "in" ? z * 1.25 : z / 1.25)));
      this.followStep();
    });
    this.host.append(this.zoomBar, this.viewport);
    new ResizeObserver(() => this.zoom === "fit" && this.setZoom("fit")).observe(this.viewport);
    const counter = el("span", { "data-docdive-counter": "" });
    counter.append(this.stepNo, this.stepTotal);
    this.playBtn.append(el("span", { class: "glyph-icon", "aria-hidden": "true" }));
    const track = el("div", { class: "rail-track" });
    track.append(this.railFill);
    this.rail.append(track, this.marks);
    const railRow = el("div", { class: "rail-row" });
    railRow.append(this.playBtn, this.rail, counter, this.picker);
    this.traceBar.append(railRow, this.stepLabel, this.throughHost, this.strip);
    this.picker.addEventListener("change", () => {
      this.stopPlay();
      this.scenario = this.picker.value;
      this.setStep(0);
    });
    this.playBtn.addEventListener("click", () => (this.timer ? this.stopPlay() : this.play()));
    this.marks.addEventListener("click", (ev) => {
      const n = (ev.target as Element).closest("[data-docdive-mark]")?.getAttribute("data-docdive-mark");
      if (!n) return;
      this.stopPlay();
      this.setStep(Number(n));
    });
    // Drag anywhere on the rail: the pointer's x picks the nearest step. Marks keep their own click.
    this.rail.addEventListener("pointerdown", (ev) => {
      if ((ev.target as Element).closest("[data-docdive-mark]")) return;
      this.rail.setPointerCapture(ev.pointerId);
      this.stopPlay();
      this.scrubTo(ev.clientX);
      const move = (e: PointerEvent) => this.scrubTo(e.clientX);
      this.rail.addEventListener("pointermove", move);
      this.rail.addEventListener("pointerup", () => this.rail.removeEventListener("pointermove", move), { once: true });
    });
    this.traceBar.addEventListener("keydown", (ev) => {
      if ((ev.target as Element).tagName === "SELECT") return;
      const next = { ArrowRight: this.step + 1, ArrowLeft: this.step - 1, Home: 0, End: this.steps().length }[ev.key];
      if (next === undefined) return;
      ev.preventDefault();
      this.stopPlay();
      this.setStep(next);
    });
    new ResizeObserver(() => this.fitRail()).observe(this.rail);
    this.strip.addEventListener("click", (ev) => {
      const t = ev.target as Element;
      const mode = t.closest("[data-docdive-state-mode]")?.getAttribute("data-docdive-state-mode");
      if (mode === "participants" || mode === "entities") {
        this.stripMode = mode;
        return this.renderStrip();
      }
      const owner = t.closest("[data-docdive-state-owner]")?.getAttribute("data-docdive-state-owner");
      if (owner && this.host.querySelector(`[data-docdive-node="${CSS.escape(owner)}"]`)) {
        this.selected = owner;
        return this.renderPanel();
      }
      const jump = t.closest("[data-docdive-trail-step]")?.getAttribute("data-docdive-trail-step");
      if (jump) {
        this.stopPlay();
        this.setStep(Number(jump));
      }
    });
  }

  // Marks overlap below ~20px per step: the rail switches to a dense mode (CSS) that keeps only meaningful dots.
  private fitRail(): void {
    const n = this.steps().length;
    this.rail.toggleAttribute("data-dense", n > 0 && this.rail.clientWidth / n < 20);
  }

  private scrubTo(clientX: number): void {
    const r = this.rail.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - r.left), r.width);
    this.setStep(Math.round((x / r.width) * this.steps().length));
  }

  disconnectedCallback(): void {
    this.stopPlay();
    this.unobserveTheme?.();
    this.unobserveTheme = undefined;
  }

  connectedCallback(): void {
    this.unobserveTheme ??= observeTheme(this);
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
        this.viewport.innerHTML = (await resolved.mermaid.render(`docdive-r${renderCount++}`, source)).svg;
        this.setZoom(this.zoom);
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
    this.viewport.innerHTML = svg;
    const svgEl = this.viewport.querySelector("svg") as unknown as SVGElement | null;
    if (!svgEl) return "Mermaid produced no SVG";
    this.setZoom(this.zoom);
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
    this.picker.hidden = ids.length === 1;
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
    const s = all[this.step - 1];
    this.rail.setAttribute("aria-valuemax", String(all.length));
    this.rail.setAttribute("aria-valuenow", String(this.step));
    this.rail.setAttribute("aria-valuetext", s ? `Step ${this.step} of ${all.length}: ${stepSentence(s)}` : "Before the first step");
    this.railFill.style.width = `${(this.step / Math.max(1, all.length)) * 100}%`;
    this.fitRail();
    if (this.marks.getAttribute("data-for") !== this.scenario) {
      this.marks.setAttribute("data-for", this.scenario);
      const withState = this.index ? stateSteps(this.index, this.scenario) : [];
      this.marks.replaceChildren(
        ...all.map((st, i) => {
          const li = el("li", { style: `left: ${((i + 1) / all.length) * 100}%` });
          const mark = el("button", { "data-docdive-mark": String(i + 1), tabindex: "-1", title: stepSentence(st), "aria-label": `Step ${i + 1}: ${stepSentence(st)}` });
          if (withState.includes(i + 1)) mark.setAttribute("data-has-state", "");
          li.append(mark);
          return li;
        }),
      );
    }
    for (const mark of this.marks.querySelectorAll("[data-docdive-mark]")) {
      const k = Number(mark.getAttribute("data-docdive-mark"));
      mark.toggleAttribute("data-past", k < this.step);
      if (k === this.step) mark.setAttribute("aria-current", "step");
      else mark.removeAttribute("aria-current");
    }
    this.stepLabel.replaceChildren();
    if (s) this.stepLabel.textContent = stepSentence(s);
    else this.stepLabel.append(el("span", { class: "muted" }, "Press play or step through the scenario."));
    if (this.index && this.diagram) applyTrace(this.host, this.throughHost, this.index, this.diagram, this.scenario, this.step);
    this.followStep();
    this.renderStrip();
    this.renderPanelState();
    const open = this.panel.querySelector("[data-docdive-open]");
    const url = this.selected ? this.openUrl(this.selected) : undefined;
    if (open && url) open.setAttribute("href", url);
    for (const [a, id] of this.crumbLinks) a.setAttribute("href", this.openUrl(id) ?? "");
  }

  // Natural size of the drawn SVG from its viewBox; null when there is none.
  private natural(): { svg: SVGElement; w: number; h: number } | null {
    const svg = this.viewport.querySelector("svg") as unknown as SVGElement | null;
    const [, , w, h] = (svg?.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
    return svg && w && h ? { svg, w, h } : null;
  }

  // Fit = whole diagram inside the viewport's width and max-height, never above 1:1.
  private fitZoom(): number {
    const n = this.natural();
    if (!n) return 1;
    const maxH = Number.parseFloat(getComputedStyle(this.viewport).maxHeight) || Infinity;
    // A hidden element (tab, details) has no width yet; the ResizeObserver refits it once shown.
    return Math.min(1, (this.viewport.clientWidth || Infinity) / n.w, maxH / n.h);
  }

  private currentZoom(): number {
    return this.zoom === "fit" ? this.fitZoom() : this.zoom;
  }

  // Applies the zoom as the SVG's width (the viewBox scales the rest) and updates the readout and the Fit toggle.
  private setZoom(zoom: number | "fit"): void {
    this.zoom = zoom;
    const n = this.natural();
    const z = this.currentZoom();
    if (n) n.svg.style.width = `${n.w * z}px`;
    this.zoomReadout.textContent = `${Math.round(z * 100)}%`;
    this.zoomBar.querySelector('[data-docdive-zoom-action="fit"]')?.setAttribute("aria-pressed", String(zoom === "fit"));
    this.host.setAttribute("data-docdive-scale", zoom === "fit" ? "fit" : String(z));
  }

  // Scrolls the viewport so the active message sits at its centre; the page itself never moves (no scrollIntoView).
  private followStep(): void {
    const v = this.viewport;
    const line = v.querySelector(`[class^="messageLine"][data-docdive-message="${this.step}"]`);
    if (!line) return void (this.step === 0 && v.scrollTo(0, 0));
    const h = v.getBoundingClientRect();
    const r = line.getBoundingClientRect();
    v.scrollTo(v.scrollLeft + (r.left + r.width / 2 - h.left) - h.width / 2, v.scrollTop + (r.top + r.height / 2 - h.top) - h.height / 2);
  }

  // `k = v` chip; tinted when the current step set it.
  private fieldChip(f: StateField): HTMLElement {
    const chip = el("span", { "data-docdive-field-chip": f.k });
    if (f.changed) chip.setAttribute("data-changed", "");
    chip.append(el("span", { class: "k" }, f.k), el("span", { class: "v" }, f.v));
    return chip;
  }

  // Participant name as a button that selects it when this diagram draws it, plain text otherwise.
  private ownerName(id: string): HTMLElement {
    const drawn = this.host.querySelector(`[data-docdive-node="${CSS.escape(id)}"]`);
    return drawn ? el("button", { "data-docdive-state-owner": id, class: "owner" }, id) : el("span", { class: "owner" }, id);
  }

  // Cards this diagram should show: what it draws (or a drawn ancestor of) or owns.
  private stateCards(): StateCard[] {
    const { index, diagram } = this;
    if (!index || !diagram) return [];
    return stateAt(index, this.scenario, this.step).filter((c) => relevantHolder(index, diagram, c.over));
  }

  // The strip under the sentence: by participant (cards) or by entity (trails). Absent when the scenario has no notes.
  private renderStrip(): void {
    const { index } = this;
    if (!index || !hasState(index, this.scenario)) return void this.strip.replaceChildren();
    const head = el("div", { class: "state-head" });
    head.append(el("span", { class: "label" }, this.step ? `State at step ${this.step}` : "Initial state"));
    const mode = el("div", { class: "mode", role: "group", "aria-label": "Group state by" });
    for (const [m, label] of [["participants", "By participant"], ["entities", "By entity"]] as const) {
      mode.append(el("button", { "data-docdive-state-mode": m, "aria-pressed": String(this.stripMode === m) }, label));
    }
    head.append(mode);
    this.strip.replaceChildren(head, this.stripMode === "participants" ? this.participantCards() : this.entityTrails());
  }

  private participantCards(): HTMLElement {
    const cards = this.stateCards();
    const grid = el("div", { class: "cards" });
    if (cards.length === 0) {
      grid.append(el("p", { class: "state-empty" }, this.step === 0 ? "No state yet. Step through the scenario." : "Nothing drawn here holds state yet."));
      return grid;
    }
    for (const c of cards) {
      const card = el("article", { "data-docdive-state-card": c.over });
      if (c.changed) card.setAttribute("data-changed", "");
      const header = el("header");
      header.append(this.ownerName(c.over));
      if (c.entity) header.append(el("span", { class: "chip entity" }, c.entity));
      const fields = el("div", { class: "fields" });
      fields.append(...c.fields.map((f) => this.fieldChip(f)));
      card.append(header, fields);
      if (c.text) card.append(el("p", { class: "state-text" }, c.text));
      grid.append(card);
    }
    return grid;
  }

  private entityTrails(): HTMLElement {
    const index = this.index as Index;
    const list = el("div", { class: "trails" });
    for (const [entity, items] of entityTrail(index, this.scenario)) {
      const now = items.filter((i) => i.step <= this.step).at(-1);
      const row = el("div", { class: "trail-row", "data-docdive-trail": entity });
      if (now?.step === this.step) row.setAttribute("data-changed", "");
      const head = el("div", { class: "trail-head" });
      head.append(el("span", { class: "chip entity" }, entity));
      const where = el("span");
      if (now) where.append("lives at ", this.ownerName(now.over));
      else where.textContent = "not created yet";
      head.append(where);
      const trail = el("ol", { class: "trail" });
      for (const it of items) {
        const li = el("li");
        if (it.step > this.step) li.setAttribute("data-future", "");
        if (it.step === this.step) li.setAttribute("data-now", "");
        const fields = el("span", { class: "fields" });
        fields.append(...Object.entries(it.fields).map(([k, v]) => this.fieldChip({ k, v, changed: false })));
        li.append(el("button", { "data-docdive-trail-step": String(it.step), class: "icon", "aria-label": `Go to step ${it.step}` }, String(it.step)), el("span", { class: "trail-owner" }, `@${it.over}`), fields);
        trail.append(li);
      }
      row.append(head, trail);
      list.append(row);
    }
    return list;
  }

  // "State at step n" in the inspector: the selected element's cards at this step; empty (hidden) when none.
  private renderPanelState(): void {
    this.panelState.replaceChildren();
    const id = this.selected;
    if (!id || !this.index || !this.scenario) return;
    const mine = stateAt(this.index, this.scenario, this.step).filter((c) => c.over === id);
    if (mine.length === 0) return;
    this.panelState.append(el("span", { class: "label" }, this.step ? `State at step ${this.step}` : "Initial state"));
    for (const c of mine) {
      const card = el("div");
      if (c.entity) card.append(el("span", { class: "chip entity" }, c.entity));
      const fields = el("div", { class: "fields" });
      fields.append(...c.fields.map((f) => this.fieldChip(f)));
      card.append(fields);
      if (c.text) card.append(el("span", { class: "state-text" }, c.text));
      this.panelState.append(card);
    }
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
    this.playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    this.playBtn.setAttribute("title", on ? "Pause" : "Play");
  }

  // Node click (or Enter/Space) only selects. The deep dive is the inspector's link, so the inspector stays reachable.
  // A message click jumps to its step.
  private onSelect(ev: Event): void {
    const message = (ev.target as Element).closest("[data-docdive-message]")?.getAttribute("data-docdive-message");
    if (message) {
      this.stopPlay();
      return this.setStep(Number(message));
    }
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
    this.panel.append(this.panelState);
    this.renderPanelState();
    for (const [name, values] of panelFields(index, id)) {
      if (values.length === 0) continue;
      const row = el("div", { "data-docdive-field": name });
      const chips = el("div", { class: "chips" });
      chips.append(...values.map((v) => this.chip(name, v)));
      row.append(el("span", { class: "label" }, FIELD_LABELS[name] ?? name), chips);
      this.panel.append(row);
    }
    const src = index.elements[id]?.src ?? [];
    if (src.length > 0) {
      const row = el("div", { "data-docdive-field": "src" });
      const list = el("div", { class: "chips" });
      list.append(...src.map((p) => el("code", { "data-docdive-value": "" }, p)));
      row.append(el("span", { class: "label" }, "Source"), list);
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
