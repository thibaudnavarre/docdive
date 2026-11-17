// Style lab, round 2: timeline player + "data living through the steps". Base layout is the round-1 lock (reading
// flow, inspector docked on selection ≥ 960px). The three variants restructure the player and the state surfaces;
// every surface is driven by one `paint()` per page so the comparison is fair. Real Mermaid SVGs, real index.json.
// Served from the repo root: node scripts/serve-static.mjs . 4300 /  →  http://localhost:4300/.cor/design-lab/
import mermaid from "/node_modules/mermaid/dist/mermaid.esm.min.mjs";

const BUILD = "/examples/docusaurus/build/docdive/";
const index = await fetch(`${BUILD}index.json`).then((r) => r.json());
const DESCRIPTIONS = {
  system: "Order-taking platform: public API, the order service and its payment and storage dependencies.",
  OrderService: "Validates and persists orders, and drives the payment capture flow.",
  OrdersDB: "PostgreSQL cluster behind a connection pool; primary for writes, replica for reads.",
  PaymentGateway: "Third-party PSP. Two-phase: charge() then capture().",
};

// Mock of the proposed model: a `Note over X: Entity k=v …` right after a message is X's state at that step.
// Indexed as `steps[k].notes` (k = 1-based step; 0 would be the initial state). Mirrors what sequence.ts will parse.
const NOTES = {
  1: [{ over: ["API"], entity: "Order", fields: { status: "draft", items: "2", total: "42€" }, text: "" }],
  2: [
    { over: ["OrderService"], entity: "Order", fields: { status: "pending" }, text: "" },
    { over: ["PaymentGateway"], entity: "Payment", fields: { status: "authorized", amount: "42€" }, text: "hold for 7 days" },
  ],
  4: [{ over: ["PaymentGateway"], entity: "Payment", fields: { status: "captured" }, text: "" }],
  5: [{ over: ["OrderService"], entity: "Order", fields: { status: "paid", payment: "captured" }, text: "" }],
  6: [
    { over: ["OrdersDB"], entity: "Order", fields: { id: "42", status: "paid", total: "42€" }, text: "row in orders" },
    { over: ["API"], entity: "Order", fields: { status: "paid", id: "42" }, text: "" },
  ],
};
for (const [k, notes] of Object.entries(NOTES)) index.scenarios["checkout-happy-path"].steps[k - 1].notes = notes;

const SOURCES = {
  "architecture/system.md": `flowchart LR\n  API --> OrderService --> PaymentGateway\n  OrderService -->|capture| PaymentGateway\n  OrderService --> OrdersDB[(orders)]`,
  "architecture/orders-db.md": `flowchart LR\n  ConnectionPool --> Primary`,
  "scenarios/checkout.md": `sequenceDiagram
  API->>OrderService: POST /orders
  Note over API: Order status=draft items=2 total=42€
  OrderService->>PaymentGateway: charge()
  Note over OrderService: Order status=pending
  Note over PaymentGateway: Payment status=authorized amount=42€
  PaymentGateway-->>OrderService: ok
  OrderService->>PaymentGateway: capture()
  Note over PaymentGateway: Payment status=captured
  PaymentGateway-->>OrderService: ok
  Note over OrderService: Order status=paid payment=captured
  OrderService->>OrdersDB: INSERT
  Note over OrdersDB: Order id=42 status=paid total=42€
  Note over API: Order status=paid id=42`,
};

mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: { fontFamily: "inherit" } });

const h = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== false && v !== null) n.setAttribute(k, v === true ? "" : v);
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
const plain = (s) => (s.isReturn ? `${s.from} replies ${s.label} to ${s.to}` : `${s.from} → ${s.to} · ${s.label}`);

// State of every participant at `step`: notes up to `step` merged field by field, later wins. One card per
// participant+entity: `{ over, entity, fields: [{ k, v, changedAt }], text, changed }`. `changed` = touched at `step`.
function stateAt(scenarioId, step) {
  const cards = new Map();
  (index.scenarios[scenarioId]?.steps ?? []).slice(0, step).forEach((s, i) => {
    for (const note of s.notes ?? []) {
      for (const over of note.over) {
        const key = `${over}/${note.entity ?? ""}`;
        const card = cards.get(key) ?? { over, entity: note.entity, fields: new Map(), text: "", changed: false };
        for (const [k, v] of Object.entries(note.fields ?? {})) card.fields.set(k, { v, changedAt: i + 1 });
        if (note.text) card.text = note.text;
        card.changed = i + 1 === step;
        cards.set(key, card);
      }
    }
  });
  return [...cards.values()].map((c) => ({ ...c, fields: [...c.fields].map(([k, { v, changedAt }]) => ({ k, v, changed: changedAt === step })) }));
}
// Entity ledger: per entity, every state change in step order `{ step, over, fields }`, past and future (the viewer
// dims the future ones so the time-travel reads).
function ledger(scenarioId) {
  const out = new Map();
  (index.scenarios[scenarioId]?.steps ?? []).forEach((s, i) => {
    for (const note of s.notes ?? []) {
      if (!note.entity) continue;
      const rows = out.get(note.entity) ?? [];
      for (const over of note.over) rows.push({ step: i + 1, over, fields: note.fields ?? {} });
      out.set(note.entity, rows);
    }
  });
  return out;
}
const holders = (scenarioId) => [...new Set((index.scenarios[scenarioId]?.steps ?? []).flatMap((s) => (s.notes ?? []).flatMap((n) => n.over)))];
const hasNotes = (scenarioId) => (index.scenarios[scenarioId]?.steps ?? []).some((s) => s.notes?.length);

// ---- diagram rendering + annotation --------------------------------------------------------------
let n = 0;
async function renderDiagram(doc, fence) {
  const diagram = index.diagrams.find((d) => d.id === `${doc}#${fence}`);
  const { svg } = await mermaid.render(`lab-${n++}`, SOURCES[doc]);
  const host = h("div", { class: "dd-svg" });
  host.innerHTML = svg;
  const svgEl = host.querySelector("svg");
  const mark = (g, id) => {
    g.setAttribute("data-docdive-node", id);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", divable(id) ? `${id}, has its own diagram` : id);
    if (divable(id)) g.setAttribute("data-docdive-divable", "");
  };
  if (diagram.type === "flowchart") {
    for (const g of svgEl.querySelectorAll("g.node")) {
      const id = /flowchart-(.+)-\d+$/.exec(g.id)?.[1];
      if (id && drawn(diagram, id)) mark(g, id);
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
      if (id && drawn(diagram, id)) mark(r.parentElement, id);
    });
  }
  return { diagram, host, svgEl };
}

// Nearest drawn element for a participant (itself or an ancestor the diagram draws).
const proxy = (diagram, id) => {
  for (let cur = id; cur; cur = index.elements[cur]?.parent) if (drawn(diagram, cur)) return cur;
  return null;
};

function applyTrace(svgEl, diagram, scenarioId, step) {
  svgEl.querySelectorAll("[data-docdive-active]").forEach((e) => e.removeAttribute("data-docdive-active"));
  const steps = index.scenarios[scenarioId]?.steps ?? [];
  const s = steps[step - 1];
  if (!s) return [];
  if (diagram.type === "sequence") svgEl.querySelectorAll(`[data-docdive-message="${step}"]`).forEach((e) => e.setAttribute("data-docdive-active", ""));
  if (diagram.type !== "flowchart") return [];
  const [pf, pt] = [proxy(diagram, s.from), proxy(diagram, s.to)];
  for (const id of new Set([pf, pt])) if (id) svgEl.querySelector(`[data-docdive-node="${id}"]`)?.setAttribute("data-docdive-active", "");
  const fwd = s.isReturn ? [s.to, s.from] : [s.from, s.to];
  const count = steps.slice(0, step - 1).filter((x) => !x.isReturn && x.from === fwd[0] && x.to === fwd[1]).length;
  const k = s.isReturn ? Math.max(0, count - 1) : count;
  const edges = [...svgEl.querySelectorAll(`[data-docdive-edge^="${fwd[0]}>${fwd[1]}#"]`)];
  (edges[k] ?? edges.at(-1))?.setAttribute("data-docdive-active", "");
  return ownerChain(diagram).filter((id) => (id === s.from || id === s.to) && !drawn(diagram, id));
}

// ---- shared player pieces ---------------------------------------------------------------------
const glyph = (state, toggle) =>
  h("button", { class: "dd-btn dd-icon dd-glyph", "aria-label": "Play", onclick: toggle }, h("span", { class: "dd-glyph-icon", "aria-hidden": "true" }));
const counterEl = () => h("span", { class: "dd-counter" }, h("span", { class: "dd-step" }, "0"), h("span", { class: "dd-total" }, " / 0"));
const fieldChips = (fields) => fields.map((f) => h("span", { class: "dd-field", "data-changed": f.changed || undefined }, h("span", { class: "dd-k" }, f.k), h("span", { class: "dd-v" }, f.v)));
// Slider semantics for the three timelines: the host is the focusable slider, ←/→ and Home/End move the step.
const slider = (node, state, steps, go) => {
  node.setAttribute("role", "slider");
  node.setAttribute("tabindex", "0");
  node.setAttribute("aria-label", "Scenario step");
  node.setAttribute("aria-valuemin", "0");
  node.addEventListener("keydown", (ev) => {
    const k = { ArrowRight: state.step + 1, ArrowLeft: state.step - 1, Home: 0, End: steps().length }[ev.key];
    if (k === undefined) return;
    ev.preventDefault();
    go(k);
  });
  return (step) => {
    const s = steps()[step - 1];
    node.setAttribute("aria-valuemax", String(steps().length));
    node.setAttribute("aria-valuenow", String(step));
    node.setAttribute("aria-valuetext", s ? `Step ${step} of ${steps().length}: ${plain(s)}` : "Before the first step");
  };
};
// Pointer scrub: x within `node` → nearest step among `count` slots (0..count), `inset` = half a slot at both ends.
const scrub = (node, count, go, inset = true) => {
  const at = (ev) => {
    const r = node.getBoundingClientRect();
    const x = Math.min(Math.max(0, ev.clientX - r.left), r.width);
    go(inset ? Math.round((x / r.width) * count()) : Math.min(count(), Math.floor((x / r.width) * count()) + 1));
  };
  node.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button")) return;
    node.setPointerCapture(ev.pointerId);
    at(ev);
    const move = (e) => at(e);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", () => node.removeEventListener("pointermove", move), { once: true });
  });
};

// ---- page: header + player + diagram + inspector ----------------------------------------------
async function renderPage(root) {
  const doc = root.dataset.doc;
  const { diagram, host, svgEl } = await renderDiagram(doc, Number(root.dataset.fence));
  const scenarios = Object.keys(index.scenarios).filter((id) => touches(id, diagram));
  const state = { scenario: scenarios[0] ?? "", step: Number(root.dataset.step ?? 0), selected: root.dataset.select ?? null, playing: false, timer: 0 };
  const steps = () => index.scenarios[state.scenario]?.steps ?? [];
  const N = () => steps().length;

  // header / breadcrumb
  const t = trail(doc);
  const scenarioOwner = Object.entries(index.scenarios).find(([, sc]) => sc.doc === doc)?.[0];
  const crumbs = h(
    "header",
    { class: "dd-head" },
    h("nav", { "aria-label": "Breadcrumb" }, h("ol", {}, ...(t.length ? t : [scenarioOwner]).map((id, i, arr) => h("li", {}, i < arr.length - 1 ? h("a", { href: "#" }, id) : h("span", { "aria-current": "page" }, id))))),
    h("span", { class: "dd-chip dd-chip-kind" }, scenarioOwner ? "scenario" : diagram.type),
  );

  const stop = () => ((state.playing = false), clearInterval(state.timer));
  const go = (k) => (stop(), (state.step = k), paint());
  const toggle = () => {
    if (state.playing) return stop(), paint();
    if (state.step >= N()) state.step = 0;
    state.playing = true;
    state.timer = setInterval(() => (state.step >= N() ? (stop(), paint()) : ((state.step += 1), paint())), 1000);
    paint();
  };
  const select = (id) => ((state.selected = id), renderInspector(), paint());

  const picker = h("select", { "aria-label": "Scenario", onchange: () => ((state.scenario = picker.value), go(0)) }, ...scenarios.map((id) => h("option", { value: id }, id)));
  const sentenceEl = h("p", { class: "dd-sentence", "aria-live": "polite" });
  const through = h("div", { class: "dd-through" });

  // ---- Variant A: dotted rail + state strip + SVG badges ----
  const railMarks = h("ol", { class: "dd-marks" });
  const railFill = h("div", { class: "dd-rail-fill" });
  const rail = h("div", { class: "dd-rail" }, h("div", { class: "dd-rail-track" }, railFill), railMarks);
  const railAria = slider(rail, state, steps, go);
  scrub(rail, N, go);
  railMarks.onclick = (ev) => ev.target.closest("[data-step]") && go(Number(ev.target.closest("[data-step]").dataset.step));
  const glyphA = glyph(state, toggle);
  const counterA = counterEl();
  const strip = h("div", { class: "dd-strip", "aria-label": "State at this step" });
  const badges = h("div", { class: "dd-badges", "aria-hidden": "true" });
  const playerA = h("div", { class: "dd-player v-a" }, h("div", { class: "dd-rail-row" }, glyphA, rail, counterA), sentenceEl.cloneNode(), through.cloneNode(), strip);

  // ---- Variant B: segmented story bar + entity ledger ----
  const segs = h("div", { class: "dd-segs" });
  const segCaption = h("div", { class: "dd-seg-caption dd-muted" });
  const storyAria = slider(segs, state, steps, go);
  scrub(segs, N, go, false);
  segs.onclick = (ev) => ev.target.closest("[data-step]") && go(Number(ev.target.closest("[data-step]").dataset.step));
  segs.addEventListener("pointerover", (ev) => {
    const k = ev.target.closest("[data-step]")?.dataset.step;
    segCaption.textContent = k ? `${k} · ${plain(steps()[k - 1])}` : "";
  });
  segs.addEventListener("pointerleave", () => (segCaption.textContent = ""));
  const glyphB = glyph(state, toggle);
  const counterB = counterEl();
  const ledgerEl = h("div", { class: "dd-ledger", "aria-label": "Entity ledger" });
  const playerB = h("div", { class: "dd-player v-b" }, h("div", { class: "dd-story-row" }, glyphB, h("div", { class: "dd-story" }, segs, segCaption), counterB), sentenceEl.cloneNode(), through.cloneNode(), ledgerEl);

  // ---- Variant C: swimlane timeline (rows = holders, columns = steps) ----
  const lanes = h("div", { class: "dd-lanes" });
  const lanesAria = slider(lanes, state, steps, go);
  lanes.onclick = (ev) => {
    const k = ev.target.closest("[data-step]")?.dataset.step;
    if (k !== undefined) go(Number(k));
  };
  const glyphC = glyph(state, toggle);
  const counterC = counterEl();
  const playerC = h("div", { class: "dd-player v-c" }, h("div", { class: "dd-lanes-wrap" }, lanes), sentenceEl.cloneNode(), through.cloneNode());

  const players = [playerA, playerB, playerC];
  const sentences = players.map((p) => p.querySelector(".dd-sentence"));
  const throughs = players.map((p) => p.querySelector(".dd-through"));
  const player = h("div", { class: "dd-players", hidden: scenarios.length === 0 }, h("div", { class: "dd-picker-row" }, picker), ...players);

  // inspector
  const inspector = h("aside", { class: "dd-inspector", "aria-label": "Element details" });
  const inspState = h("div", { class: "dd-rel dd-insp-state" });
  const renderInspector = () => {
    const id = state.selected;
    inspector.replaceChildren();
    inspector.toggleAttribute("data-empty", !id);
    if (!id) return inspector.append(h("p", { class: "dd-empty" }, "Click a box to inspect it; bold boxes have a diagram of their own."));
    const e = index.elements[id];
    const rel = (label, ids, map = (x) => x) =>
      ids.length ? h("div", { class: "dd-rel" }, h("span", { class: "dd-rel-label" }, label), h("div", { class: "dd-chips" }, ...ids.map((x) => h("a", { class: "dd-chip", href: "#" }, map(x))))) : null;
    const status = h("span", { class: "dd-status", role: "status" });
    inspector.append(
      h(
        "header",
        { class: "dd-insp-head" },
        h("div", {}, h("h3", { class: "dd-title" }, id), h("span", { class: "dd-chip dd-chip-kind" }, divable(id) ? "has diagram" : "leaf")),
        h("button", { class: "dd-btn dd-icon dd-close", "aria-label": "Close", onclick: () => select(null) }, "×"),
      ),
      DESCRIPTIONS[id] ? h("p", { class: "dd-desc" }, DESCRIPTIONS[id]) : null,
      divable(id) ? h("a", { class: "dd-btn dd-primary", href: "#" }, `Dive into ${id} →`) : null,
      inspState,
      rel("Parent", e.parent ? [e.parent] : []),
      rel("Children", e.children ?? []),
      rel("Appears in", e.appearsIn ?? [], diagramLabel),
      rel("Scenarios", scenariosOf(id)),
      e.src?.length ? h("div", { class: "dd-rel" }, h("span", { class: "dd-rel-label" }, "Source"), h("ul", { class: "dd-src" }, ...e.src.map((p) => h("li", {}, h("code", {}, p), " ", h("a", { href: "#" }, "open ↗"))))) : null,
      h("div", { class: "dd-actions" }, h("button", { class: "dd-btn" }, "Copy context"), h("button", { class: "dd-btn" }, "Copy link"), status),
    );
  };

  const diagramWrap = h("div", { class: "dd-diagram" }, host, badges);
  const page = h("div", { class: "dd-page" }, crumbs, player, diagramWrap, inspector);

  const positionBadges = () => {
    badges.replaceChildren();
    if (!document.documentElement.dataset.style.startsWith("a") || diagram.type !== "flowchart") return;
    const wrap = diagramWrap.getBoundingClientRect();
    for (const card of stateAt(state.scenario, state.step).filter((c) => c.changed)) {
      const node = svgEl.querySelector(`[data-docdive-node="${proxy(diagram, card.over)}"]`);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      const changed = card.fields.filter((f) => f.changed);
      badges.append(
        h(
          "div",
          { class: "dd-badge", style: `left:${r.left - wrap.left + r.width / 2}px; top:${r.bottom - wrap.top + 6}px` },
          h("span", { class: "dd-badge-entity" }, card.entity ?? ""),
          ...changed.map((f) => h("span", { class: "dd-badge-field" }, `${f.k}=${f.v}`)),
        ),
      );
    }
  };
  new ResizeObserver(positionBadges).observe(diagramWrap);

  const paint = () => {
    const all = steps();
    state.step = Math.max(0, Math.min(all.length, state.step));
    const s = all[state.step - 1];
    for (const c of [counterA, counterB, counterC]) (c.firstChild.textContent = String(state.step)), (c.lastChild.textContent = ` / ${all.length}`);
    for (const g of [glyphA, glyphB, glyphC]) {
      g.toggleAttribute("data-playing", state.playing);
      g.setAttribute("aria-label", state.playing ? "Pause" : "Play");
      g.setAttribute("title", state.playing ? "Pause" : "Play");
    }
    for (const el of sentences) el.replaceChildren(...(s ? sentence(s) : [h("span", { class: "dd-muted" }, "Press play or step through the scenario.")]));
    const passes = applyTrace(svgEl, diagram, state.scenario, state.step);
    for (const el of throughs) el.replaceChildren(...passes.map((id) => h("span", { class: "dd-chip dd-chip-through" }, `passes through ${id}`)));
    svgEl.querySelectorAll("[data-docdive-selected]").forEach((e) => e.removeAttribute("data-docdive-selected"));
    if (state.selected) svgEl.querySelector(`[data-docdive-node="${state.selected}"]`)?.setAttribute("data-docdive-selected", "");
    page.toggleAttribute("data-docked", Boolean(state.selected));
    // A child page shows only the state of what it draws (or owns): the DB page shows the DB, not the whole flow.
    const relevant = (id) => diagram.type === "sequence" || Boolean(proxy(diagram, id)) || ownerChain(diagram).includes(id);
    const cards = stateAt(state.scenario, state.step).filter((c) => relevant(c.over));
    const notes = hasNotes(state.scenario);

    // A — rail + strip
    railAria(state.step);
    railFill.style.width = `${(state.step / Math.max(1, all.length)) * 100}%`;
    if (railMarks.dataset.for !== state.scenario) {
      railMarks.dataset.for = state.scenario;
      railMarks.replaceChildren(
        ...all.map((st, i) =>
          h(
            "li",
            { style: `left:${((i + 1) / all.length) * 100}%` },
            h("button", { class: "dd-mark", "data-step": i + 1, title: plain(st), "aria-label": `Step ${i + 1}: ${plain(st)}`, tabindex: -1, "data-has-state": st.notes?.length ? "" : undefined }),
          ),
        ),
      );
    }
    railMarks.querySelectorAll(".dd-mark").forEach((m) => {
      const k = Number(m.dataset.step);
      m.toggleAttribute("aria-current", k === state.step);
      m.toggleAttribute("data-past", k < state.step);
    });
    strip.hidden = !notes;
    strip.replaceChildren(
      ...(cards.length
        ? cards.map((c) =>
            h(
              "article",
              { class: "dd-state-card", "data-changed": c.changed || undefined },
              h("header", {}, h("button", { class: "dd-state-owner", onclick: () => select(c.over) }, c.over), c.entity ? h("span", { class: "dd-chip dd-chip-entity" }, c.entity) : null),
              h("div", { class: "dd-fields" }, ...fieldChips(c.fields)),
              c.text ? h("p", { class: "dd-state-text dd-muted" }, c.text) : null,
            ),
          )
        : [h("p", { class: "dd-muted dd-state-empty" }, (state.step === 0 ? "No state yet — the first step creates the order." : "Nothing drawn here holds state yet."))]),
    );
    positionBadges();

    // B — story bar + ledger
    storyAria(state.step);
    if (segs.dataset.for !== state.scenario) {
      segs.dataset.for = state.scenario;
      segs.replaceChildren(...all.map((st, i) => h("button", { class: "dd-seg", "data-step": i + 1, "aria-label": `Step ${i + 1}: ${plain(st)}`, tabindex: -1, "data-has-state": st.notes?.length ? "" : undefined })));
    }
    segs.querySelectorAll(".dd-seg").forEach((sg) => {
      const k = Number(sg.dataset.step);
      sg.toggleAttribute("data-past", k < state.step);
      sg.toggleAttribute("aria-current", k === state.step);
    });
    ledgerEl.hidden = !notes;
    const rows = [...ledger(state.scenario)];
    ledgerEl.replaceChildren(
      ...rows.map(([entity, changes]) => {
        const now = changes.filter((c) => c.step <= state.step).at(-1);
        return h(
          "div",
          { class: "dd-ledger-row", "data-changed": now?.step === state.step || undefined },
          h("div", { class: "dd-ledger-head" }, h("span", { class: "dd-chip dd-chip-entity" }, entity), now ? h("span", { class: "dd-muted" }, "lives at ", h("button", { class: "dd-state-owner", onclick: () => select(now.over) }, now.over)) : h("span", { class: "dd-muted" }, "not created yet")),
          h(
            "ol",
            { class: "dd-trail" },
            ...changes.map((c) =>
              h(
                "li",
                { class: "dd-trail-item", "data-future": c.step > state.step || undefined, "data-now": c.step === state.step || undefined },
                h("button", { class: "dd-trail-step", "data-step": c.step, onclick: () => go(c.step), "aria-label": `Go to step ${c.step}` }, String(c.step)),
                h("span", { class: "dd-trail-owner" }, "@", c.over),
                h("span", { class: "dd-fields" }, ...Object.entries(c.fields).map(([k, v]) => h("span", { class: "dd-field" }, h("span", { class: "dd-k" }, k), h("span", { class: "dd-v" }, v)))),
              ),
            ),
          ),
        );
      }),
    );

    // C — swimlanes
    lanesAria(state.step);
    const hold = holders(state.scenario).filter(relevant);
    lanes.style.setProperty("--cols", String(all.length));
    lanes.replaceChildren(
      h("div", { class: "dd-lane-corner" }, glyphC, counterC),
      ...all.map((st, i) =>
        h(
          "button",
          { class: "dd-lane-col", "data-step": i + 1, "aria-current": i + 1 === state.step || undefined, "data-past": i + 1 < state.step || undefined, title: plain(st) },
          h("span", { class: "dd-lane-no" }, String(i + 1)),
          h("span", { class: "dd-lane-msg" }, st.isReturn ? `${st.from} ⇠ ${st.label}` : `${st.from} → ${st.to}`),
        ),
      ),
      ...hold.flatMap((id) => [
        h("div", { class: "dd-lane-name" }, h("button", { class: "dd-state-owner", onclick: () => select(id) }, id)),
        ...all.map((st, i) => {
          const notesHere = (st.notes ?? []).filter((nt) => nt.over.includes(id));
          return h(
            "div",
            { class: "dd-lane-cell", "data-step": i + 1, "aria-current": i + 1 === state.step || undefined, "data-future": i + 1 > state.step || undefined, "data-active": (st.from === id || st.to === id) || undefined },
            ...notesHere.map((nt) => h("div", { class: "dd-lane-note" }, nt.entity ? h("span", { class: "dd-chip dd-chip-entity" }, nt.entity) : null, ...Object.entries(nt.fields ?? {}).map(([k, v]) => h("span", { class: "dd-field" }, h("span", { class: "dd-k" }, k), h("span", { class: "dd-v" }, v))))),
          );
        }),
      ]),
    );
    lanes.querySelector('.dd-lane-col[aria-current]')?.scrollIntoView({ block: "nearest", inline: "nearest" });

    // inspector state section (all variants)
    const mine = state.selected ? cards.filter((c) => c.over === state.selected) : [];
    inspState.replaceChildren();
    inspState.hidden = mine.length === 0;
    if (mine.length) {
      inspState.append(
        h("span", { class: "dd-rel-label" }, `State at step ${state.step}`),
        ...mine.map((c) => h("div", { class: "dd-insp-state-card", "data-changed": c.changed || undefined }, c.entity ? h("span", { class: "dd-chip dd-chip-entity" }, c.entity) : null, h("div", { class: "dd-fields" }, ...fieldChips(c.fields)), c.text ? h("span", { class: "dd-muted" }, c.text) : null)),
      );
    }
  };

  host.addEventListener("click", (ev) => {
    const id = ev.target.closest("[data-docdive-node]")?.getAttribute("data-docdive-node");
    if (id) select(id);
  });
  host.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const id = ev.target.closest("[data-docdive-node]")?.getAttribute("data-docdive-node");
    if (id) ev.preventDefault(), select(id);
  });
  new MutationObserver(positionBadges).observe(document.documentElement, { attributes: true, attributeFilter: ["data-style"] });

  root.append(page);
  renderInspector();
  paint();
}

for (const page of document.querySelectorAll(".dd[data-doc]")) await renderPage(page);
document.documentElement.dataset.ready = "";
