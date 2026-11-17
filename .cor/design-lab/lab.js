// Style lab for the docdive viewer. Renders real Mermaid SVGs from fixtures/toy through the real index.json, with
// mock chrome (header, player, inspector, map) in light DOM so the three variants can restructure it with CSS only.
// Served from the repo root: node scripts/serve-static.mjs . 4300 /  →  http://localhost:4300/.cor/design-lab/
import mermaid from "/node_modules/mermaid/dist/mermaid.esm.min.mjs";

const BUILD = "/examples/docusaurus/build/docdive/";
const [index, contexts] = await Promise.all([fetch(`${BUILD}index.json`).then((r) => r.json()), fetch(`${BUILD}contexts.json`).then((r) => r.json())]);
// Toy fixtures carry no descriptions; the lab adds a few so the inspector shows the row.
const DESCRIPTIONS = {
  system: "Order-taking platform: public API, the order service and its payment and storage dependencies.",
  OrderService: "Validates and persists orders, and drives the payment capture flow.",
  OrdersDB: "PostgreSQL cluster behind a connection pool; primary for writes, replica for reads.",
  PaymentGateway: "Third-party PSP. Two-phase: charge() then capture().",
  Validator: "Schema and stock checks before an order is accepted.",
};
const SOURCES = {
  "architecture/system.md": `flowchart LR\n  API --> OrderService --> PaymentGateway\n  OrderService -->|capture| PaymentGateway\n  OrderService --> OrdersDB[(orders)]`,
  "architecture/order-service.md": `flowchart TB\n  Controller --> Validator --> Repository`,
  "scenarios/checkout.md": `sequenceDiagram\n  API->>OrderService: POST /orders\n  OrderService->>PaymentGateway: charge()\n  PaymentGateway-->>OrderService: ok\n  OrderService->>PaymentGateway: capture()\n  PaymentGateway-->>OrderService: ok\n  OrderService->>OrdersDB: INSERT`,
};

mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: { fontFamily: "inherit" } });

const h = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return n;
};

// ---- model helpers (candidates for shared.ts) --------------------------------------------------
const ownerOf = (doc) => Object.entries(index.elements).find(([, e]) => e.doc === doc)?.[0];
const trail = (doc) => {
  const out = [];
  for (let id = ownerOf(doc); id && !out.includes(id); id = index.elements[id]?.parent) out.unshift(id);
  return out;
};
const divable = (id) => Boolean(index.elements[id]?.doc);
const drawn = (diagram, id) => diagram.nodes.includes(id);
const ownerChain = (diagram) => trail(diagram.id.split("#")[0]).reverse();
const touches = (scenarioId, diagram) => {
  const chain = ownerChain(diagram);
  return index.scenarios[scenarioId].steps.some((s) => [s.from, s.to].some((id) => drawn(diagram, id) || chain.includes(id)));
};
const scenariosOf = (id) => Object.entries(index.scenarios).filter(([, sc]) => sc.steps.some((s) => s.from === id || s.to === id)).map(([k]) => k);
const diagramLabel = (diagramId) => {
  const [doc, n] = diagramId.split("#");
  const owner = ownerOf(doc) ?? Object.entries(index.scenarios).find(([, sc]) => sc.doc === doc)?.[0] ?? doc;
  const fences = index.diagrams.filter((d) => d.id.startsWith(`${doc}#`)).length;
  return fences > 1 ? `${owner} · ${Number(n) + 1}` : owner;
};
const sentence = (s) =>
  s.isReturn
    ? [h("b", {}, s.from), " replies ", h("em", {}, s.label), " to ", h("b", {}, s.to)]
    : [h("b", {}, s.from), " → ", h("b", {}, s.to), " · ", h("em", {}, s.label)];

// ---- diagram rendering + annotation --------------------------------------------------------------
let n = 0;
async function renderDiagram(doc, fence) {
  const diagram = index.diagrams.find((d) => d.id === `${doc}#${fence}`);
  const { svg } = await mermaid.render(`lab-${n++}`, SOURCES[doc]);
  const host = h("div", { class: "dd-svg" });
  host.innerHTML = svg;
  const svgEl = host.querySelector("svg");
  if (diagram.type === "flowchart") {
    for (const g of svgEl.querySelectorAll("g.node")) {
      const id = /flowchart-(.+)-\d+$/.exec(g.id)?.[1];
      if (!id || !drawn(diagram, id)) continue;
      g.setAttribute("data-docdive-node", id);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", divable(id) ? `${id}, has its own diagram` : id);
      if (divable(id)) g.setAttribute("data-docdive-divable", "");
    }
    const links = [...svgEl.querySelectorAll("path.flowchart-link")];
    const seen = new Map();
    for (const [a, b] of diagram.edges) {
      const key = `${a}>${b}`;
      const k = seen.get(key) ?? 0;
      seen.set(key, k + 1);
      const re = new RegExp(`(^|-)L_${a}_${b}_(\\d+)$`);
      const m = links.map((p) => ({ p, m: re.exec(p.id) })).filter((x) => x.m).sort((x, y) => Number(x.m[2]) - Number(y.m[2]));
      m[k]?.p.setAttribute("data-docdive-edge", `${key}#${k}`);
    }
  } else {
    svgEl.querySelectorAll("text.messageText").forEach((t, i) => t.setAttribute("data-docdive-message", String(i + 1)));
    svgEl.querySelectorAll('[class^="messageLine"]').forEach((l, i) => l.setAttribute("data-docdive-message", String(i + 1)));
    svgEl.querySelectorAll("rect.actor").forEach((r) => {
      const id = r.getAttribute("name");
      if (id && drawn(diagram, id)) r.parentElement.setAttribute("data-docdive-node", id), divable(id) && r.parentElement.setAttribute("data-docdive-divable", "");
    });
  }
  return { diagram, host, svgEl };
}

function applyTrace(svgEl, diagram, scenarioId, step) {
  svgEl.querySelectorAll("[data-docdive-active]").forEach((e) => e.removeAttribute("data-docdive-active"));
  const steps = index.scenarios[scenarioId]?.steps ?? [];
  const s = steps[step - 1];
  if (!s) return [];
  if (diagram.type === "sequence") svgEl.querySelectorAll(`[data-docdive-message="${step}"]`).forEach((e) => e.setAttribute("data-docdive-active", ""));
  if (diagram.type !== "flowchart") return [];
  for (const id of new Set([s.from, s.to])) svgEl.querySelector(`[data-docdive-node="${id}"]`)?.setAttribute("data-docdive-active", "");
  const fwd = s.isReturn ? [s.to, s.from] : [s.from, s.to];
  const count = steps.slice(0, step - 1).filter((x) => !x.isReturn && x.from === fwd[0] && x.to === fwd[1]).length;
  const k = s.isReturn ? Math.max(0, count - 1) : count;
  const edges = [...svgEl.querySelectorAll(`[data-docdive-edge^="${fwd[0]}>${fwd[1]}#"]`)];
  (edges[k] ?? edges.at(-1))?.setAttribute("data-docdive-active", "");
  return ownerChain(diagram).filter((id) => (id === s.from || id === s.to) && !drawn(diagram, id));
}

// ---- page: header + player + diagram + inspector ----------------------------------------------
async function renderPage(root) {
  const doc = root.dataset.doc;
  const { diagram, host, svgEl } = await renderDiagram(doc, Number(root.dataset.fence));
  const scenarios = Object.keys(index.scenarios).filter((id) => touches(id, diagram));
  const state = { scenario: scenarios[0] ?? "", step: Number(root.dataset.step ?? 0), selected: root.dataset.select ?? null, playing: false, timer: 0 };
  const steps = () => index.scenarios[state.scenario]?.steps ?? [];

  // header / breadcrumb
  const t = trail(doc);
  const scenarioOwner = Object.entries(index.scenarios).find(([, sc]) => sc.doc === doc)?.[0];
  const crumbs = h(
    "header",
    { class: "dd-head", part: "crumbs" },
    h(
      "nav",
      { "aria-label": "Breadcrumb" },
      h("ol", {}, ...(t.length ? t : [scenarioOwner]).map((id, i, arr) => h("li", {}, i < arr.length - 1 ? h("a", { href: "#" }, id) : h("span", { "aria-current": "page" }, id)))),
    ),
    h("span", { class: "dd-chip dd-chip-kind" }, scenarioOwner ? "scenario" : diagram.type),
  );

  // player
  const picker = h("select", { "aria-label": "Scenario" }, ...scenarios.map((id) => h("option", { value: id }, id)));
  const prev = h("button", { class: "dd-btn dd-icon", "aria-label": "Previous step" }, "‹");
  const next = h("button", { class: "dd-btn dd-icon", "aria-label": "Next step" }, "›");
  const play = h("button", { class: "dd-btn dd-icon dd-play", "aria-label": "Play" }, "▶");
  const counter = h("span", { class: "dd-counter" }, h("span", { class: "dd-step" }, "0"), h("span", { class: "dd-total" }, ` / ${steps().length}`));
  const range = h("input", { type: "range", min: 0, max: steps().length, value: 0, "aria-label": "Step", class: "dd-range" });
  const pills = h("ol", { class: "dd-pills", "aria-label": "Steps" }, ...steps().map((s, i) => h("li", {}, h("button", { class: "dd-pill", "data-step": i + 1, title: s.label }, String(i + 1)))));
  const sentenceEl = h("p", { class: "dd-sentence", "aria-live": "polite" });
  const through = h("div", { class: "dd-through" });
  const player = h(
    "div",
    { class: "dd-player", part: "trace", hidden: scenarios.length === 0 },
    h("div", { class: "dd-transport" }, picker, h("div", { class: "dd-transport-btns" }, prev, play, next), counter),
    range,
    pills,
    sentenceEl,
    through,
  );

  // inspector
  const inspector = h("aside", { class: "dd-inspector", part: "panel", "aria-label": "Element details" });
  const renderInspector = () => {
    const id = state.selected;
    inspector.replaceChildren();
    inspector.toggleAttribute("data-empty", !id);
    if (!id) return inspector.append(h("p", { class: "dd-empty" }, "Click a box to inspect it."));
    const e = index.elements[id];
    const rel = (label, ids, map = (x) => x) =>
      ids.length ? h("div", { class: "dd-rel" }, h("span", { class: "dd-rel-label" }, label), h("div", { class: "dd-chips" }, ...ids.map((x) => h("a", { class: "dd-chip", href: "#" }, map(x))))) : null;
    const status = h("span", { class: "dd-status", role: "status" });
    const flash = (txt, cls) => ((status.textContent = txt), (status.className = `dd-status ${cls}`), setTimeout(() => (status.textContent = ""), 1500));
    inspector.append(
      h(
        "header",
        { class: "dd-insp-head" },
        h("div", {}, h("h3", { class: "dd-title" }, id), h("span", { class: "dd-chip dd-chip-kind" }, divable(id) ? "has diagram" : "leaf")),
        h("button", { class: "dd-btn dd-icon dd-close", "aria-label": "Close", onclick: () => ((state.selected = null), renderInspector(), paint()) }, "×"),
      ),
      DESCRIPTIONS[id] ? h("p", { class: "dd-desc" }, DESCRIPTIONS[id]) : null,
      divable(id) ? h("a", { class: "dd-btn dd-primary", href: "#" }, `Dive into ${id} →`) : null,
      rel("Parent", e.parent ? [e.parent] : []),
      rel("Children", e.children ?? []),
      rel("Appears in", e.appearsIn ?? [], diagramLabel),
      rel("Scenarios", scenariosOf(id)),
      e.src?.length ? h("div", { class: "dd-rel" }, h("span", { class: "dd-rel-label" }, "Source"), h("ul", { class: "dd-src" }, ...e.src.map((p) => h("li", {}, h("code", {}, p), " ", h("a", { href: "#" }, "open ↗"))))) : null,
      h(
        "div",
        { class: "dd-actions" },
        h("button", { class: "dd-btn", onclick: () => navigator.clipboard.writeText(contexts[id] ?? "").then(() => flash("Copied", "ok"), () => flash("Clipboard unavailable", "err")) }, "Copy context"),
        h("button", { class: "dd-btn", onclick: () => flash("Link copied", "ok") }, "Copy link"),
        status,
      ),
    );
  };

  const paint = () => {
    const all = steps();
    state.step = Math.max(0, Math.min(all.length, state.step));
    counter.firstChild.textContent = String(state.step);
    counter.lastChild.textContent = ` / ${all.length}`;
    range.value = state.step;
    range.style.setProperty("--p", `${(state.step / Math.max(1, all.length)) * 100}%`);
    prev.disabled = state.step === 0;
    next.disabled = state.step >= all.length;
    play.textContent = state.playing ? "⏸" : "▶";
    play.setAttribute("aria-label", state.playing ? "Pause" : "Play");
    pills.querySelectorAll(".dd-pill").forEach((p) => p.toggleAttribute("aria-current", Number(p.dataset.step) === state.step));
    const s = all[state.step - 1];
    sentenceEl.replaceChildren(...(s ? sentence(s) : [h("span", { class: "dd-muted" }, "Press play or step through the scenario.")]));
    const passes = applyTrace(svgEl, diagram, state.scenario, state.step);
    through.replaceChildren(...passes.map((id) => h("span", { class: "dd-chip dd-chip-through" }, `passes through ${id}`)));
    svgEl.querySelectorAll("[data-docdive-selected]").forEach((e) => e.removeAttribute("data-docdive-selected"));
    if (state.selected) svgEl.querySelector(`[data-docdive-node="${state.selected}"]`)?.setAttribute("data-docdive-selected", "");
  };
  const stop = () => ((state.playing = false), clearInterval(state.timer));
  const go = (k) => (stop(), (state.step = k), paint());
  prev.onclick = () => go(state.step - 1);
  next.onclick = () => go(state.step + 1);
  range.oninput = () => go(Number(range.value));
  pills.onclick = (ev) => ev.target.dataset.step && go(Number(ev.target.dataset.step));
  picker.onchange = () => ((state.scenario = picker.value), go(0));
  play.onclick = () => {
    if (state.playing) return stop(), paint();
    if (state.step >= steps().length) state.step = 0;
    state.playing = true;
    state.timer = setInterval(() => (state.step >= steps().length ? (stop(), paint()) : ((state.step += 1), paint())), 1000);
    paint();
  };
  player.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowRight") go(state.step + 1);
    if (ev.key === "ArrowLeft") go(state.step - 1);
  });
  host.addEventListener("click", (ev) => {
    const id = ev.target.closest("[data-docdive-node]")?.getAttribute("data-docdive-node");
    if (!id) return;
    state.selected = id;
    renderInspector();
    paint();
  });
  host.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const id = ev.target.closest("[data-docdive-node]")?.getAttribute("data-docdive-node");
    if (id) ev.preventDefault(), (state.selected = id), renderInspector(), paint();
  });

  const diagramWrap = h("div", { class: "dd-diagram" }, host);
  root.append(h("div", { class: "dd-page" }, crumbs, player, diagramWrap, inspector));
  renderInspector();
  paint();
}

// ---- overview map -----------------------------------------------------------------------------
function renderMap(root) {
  const roots = Object.entries(index.elements).filter(([, e]) => !e.parent && e.doc).map(([id]) => id);
  const node = (id) => {
    const e = index.elements[id];
    const sc = scenariosOf(id).length;
    return h(
      "li",
      {},
      h(
        "div",
        { class: "dd-tree-row", "data-divable": divable(id) || undefined },
        divable(id) ? h("a", { href: "#", class: "dd-tree-name" }, id) : h("span", { class: "dd-tree-name" }, id),
        DESCRIPTIONS[id] ? h("span", { class: "dd-tree-desc" }, DESCRIPTIONS[id]) : null,
        sc ? h("span", { class: "dd-chip dd-chip-count", title: `${sc} scenario(s) cross ${id}` }, `${sc} flow${sc > 1 ? "s" : ""}`) : null,
      ),
      e.children?.length ? h("ul", {}, ...e.children.map(node)) : null,
    );
  };
  const scenarios = Object.entries(index.scenarios).map(([id, sc]) => {
    const crossed = [...new Set(sc.steps.flatMap((s) => [s.from, s.to]))];
    return h(
      "li",
      { class: "dd-scn" },
      h("a", { href: "#", class: "dd-scn-name" }, id),
      h("span", { class: "dd-muted" }, `${sc.steps.length} steps`),
      h("div", { class: "dd-chips" }, ...crossed.map((c) => h("span", { class: "dd-chip" }, c))),
    );
  });
  root.append(
    h(
      "div",
      { class: "dd-map", part: "map" },
      h("section", { class: "dd-map-col" }, h("h3", { class: "dd-map-h" }, "System"), h("ul", { class: "dd-tree" }, ...roots.map(node))),
      h("section", { class: "dd-map-col" }, h("h3", { class: "dd-map-h" }, "Flows"), h("ul", { class: "dd-scns" }, ...scenarios)),
    ),
  );
}

renderMap(document.getElementById("map"));
for (const page of document.querySelectorAll(".dd[data-doc]")) await renderPage(page);
document.documentElement.dataset.ready = "";
