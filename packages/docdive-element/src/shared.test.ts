import { describe, expect, it } from "vitest";
import {
  annotateFlowchart,
  annotateSequence,
  breadcrumb,
  diagramLabel,
  divable,
  edgeOccurrence,
  hasSeveralFences,
  hostTheme,
  motionAllowed,
  panelFields,
  scenarioElements,
  sourceHref,
  stepSentence,
  systemTree,
  touchesDiagram,
  urlStateOwner,
  withTrace,
  type DiagramEntry,
  type Index,
  type Step,
} from "./shared.js";

const fwd = (from: string, to: string): Step => ({ from, to, label: "", isReturn: false });
const ret = (from: string, to: string): Step => ({ from, to, label: "", isReturn: true });

describe("edgeOccurrence", () => {
  const steps = [fwd("A", "B"), fwd("B", "C"), ret("C", "B"), fwd("B", "C"), ret("C", "B")];

  it("maps the k-th forward message of a pair to its k-th edge", () => {
    expect(edgeOccurrence(steps, 1)).toEqual({ a: "B", b: "C", k: 0 });
    expect(edgeOccurrence(steps, 3)).toEqual({ a: "B", b: "C", k: 1 });
  });

  it("maps a return to the edge of the latest forward message of the reversed pair", () => {
    expect(edgeOccurrence(steps, 2)).toEqual({ a: "B", b: "C", k: 0 });
    expect(edgeOccurrence(steps, 4)).toEqual({ a: "B", b: "C", k: 1 });
  });

  it("clamps a return with no prior forward message to the first edge", () => {
    expect(edgeOccurrence([ret("B", "A")], 0)).toEqual({ a: "A", b: "B", k: 0 });
  });
});

describe("touchesDiagram", () => {
  const diagram = (id: string, nodes: string[]): DiagramEntry => ({ id, type: "flowchart", nodes, edges: [] });
  const index: Index = {
    diagrams: [],
    elements: {
      system: { doc: "system.md", parent: null },
      Orders: { doc: "orders.md", parent: "system" },
      Validator: { doc: "validator.md", parent: "Orders" },
      Billing: { doc: "billing.md", parent: "system" },
    },
    scenarios: { checkout: { doc: "checkout.md", steps: [fwd("API", "Orders")] } },
  };

  it("is true when a step participant is drawn in the diagram", () => {
    expect(touchesDiagram(index, "checkout", diagram("system.md#0", ["API", "Orders"]))).toBe(true);
  });

  it("is true when a step participant is the doc owner or one of its ancestors", () => {
    expect(touchesDiagram(index, "checkout", diagram("orders.md#0", ["Ctl", "Validator"]))).toBe(true);
    expect(touchesDiagram(index, "checkout", diagram("validator.md#0", ["Schema"]))).toBe(true);
  });

  it("is false otherwise, and for an unknown scenario", () => {
    expect(touchesDiagram(index, "checkout", diagram("billing.md#0", ["Invoice"]))).toBe(false);
    expect(touchesDiagram(index, "nope", diagram("system.md#0", ["API", "Orders"]))).toBe(false);
  });
});

describe("urlStateOwner", () => {
  const diagram = (id: string, nodes: string[]): DiagramEntry => ({ id, type: "flowchart", nodes, edges: [] });
  const index: Index = {
    diagrams: [diagram("db.md#1", ["Pool", "Replica"]), diagram("db.md#0", ["Pool", "Primary"]), diagram("db.md#2", ["Other"]), diagram("one.md#0", ["Pool"])],
    elements: {},
    scenarios: {},
  };
  const hasPool = (d: DiagramEntry) => d.nodes.includes("Pool");

  it("gives an unqualified URL to the first matching fence of the doc", () => {
    expect(urlStateOwner(index, "db.md", null, hasPool)).toBe(0);
  });

  it("gives a qualified URL to the named fence only when it matches", () => {
    expect(urlStateOwner(index, "db.md", 1, hasPool)).toBe(1);
    expect(urlStateOwner(index, "db.md", 2, hasPool)).toBeUndefined();
    expect(urlStateOwner(index, "db.md", 9, hasPool)).toBeUndefined();
  });

  it("is undefined when no fence matches, and ignores other docs", () => {
    expect(urlStateOwner(index, "db.md", null, (d) => d.nodes.includes("Nope"))).toBeUndefined();
    expect(urlStateOwner(index, "one.md", null, hasPool)).toBe(0);
  });

  it("flags only docs with several fences", () => {
    expect(hasSeveralFences(index, "db.md")).toBe(true);
    expect(hasSeveralFences(index, "one.md")).toBe(false);
  });
});

describe("sourceHref", () => {
  it("rewrites a GitHub edit URL to a blob URL with the line", () => {
    expect(sourceHref("https://github.com/o/r/edit/main/docs/a.md", undefined, "a.md", 7)).toBe("https://github.com/o/r/blob/main/docs/a.md#L7");
  });

  it("rewrites a GitLab edit URL, including self-hosted", () => {
    expect(sourceHref("https://git.example.com/g/p/-/edit/main/docs/a.md", undefined, "a.md", 3)).toBe("https://git.example.com/g/p/-/blob/main/docs/a.md#L3");
  });

  it("returns null for any other host", () => {
    expect(sourceHref("https://bitbucket.org/o/r/src/main/docs/a.md?mode=edit", undefined, "a.md", 1)).toBeNull();
    expect(sourceHref("https://github.com/o/r/blob/main/docs/a.md", undefined, "a.md", 1)).toBeNull();
  });

  it("lets a template win over the edit URL", () => {
    expect(sourceHref("https://github.com/o/r/edit/main/a.md", "https://x.dev/{path}?l={line}", "guide/a b.md", 9)).toBe("https://x.dev/guide/a%20b.md?l=9");
  });

  it("returns null without any input", () => {
    expect(sourceHref(undefined, undefined, "a.md", 1)).toBeNull();
    expect(sourceHref("not a url", undefined, "a.md", 1)).toBeNull();
  });
});

describe("breadcrumb", () => {
  const index = (elements: Index["elements"]): Index => ({ diagrams: [], elements, scenarios: {} });
  const chain = index({
    system: { doc: "system.md", parent: null },
    Orders: { doc: "orders.md", parent: "system" },
    Validator: { doc: "validator.md", parent: "Orders" },
  });

  it("lists the owner's ancestors root-first, ending at the owner", () => {
    expect(breadcrumb(chain, "validator.md")).toEqual(["system", "Orders", "Validator"]);
  });

  it("is empty for a top-level owner, an unowned doc and a doc owned by several elements", () => {
    expect(breadcrumb(chain, "system.md")).toEqual([]);
    expect(breadcrumb(chain, "nobody.md")).toEqual([]);
    const shared = index({ A: { doc: "x.md", parent: "R" }, B: { doc: "x.md", parent: "R" }, R: { doc: "r.md" } });
    expect(breadcrumb(shared, "x.md")).toEqual([]);
  });

  it("stops at the first repeated ID on a parent cycle", () => {
    const loop = index({ A: { doc: "a.md", parent: "B" }, B: { doc: "b.md", parent: "A" } });
    expect(breadcrumb(loop, "a.md")).toEqual(["B", "A"]);
  });
});

describe("withTrace", () => {
  it("appends scenario and step with the right separator", () => {
    expect(withTrace("/a/", "checkout", 2)).toBe("/a/?docdive-scenario=checkout&docdive-step=2");
    expect(withTrace("/a/?x=1", "checkout", 2)).toBe("/a/?x=1&docdive-scenario=checkout&docdive-step=2");
  });

  it("leaves the URL alone without an active trace", () => {
    expect(withTrace("/a/", "", 2)).toBe("/a/");
    expect(withTrace("/a/", "checkout", 0)).toBe("/a/");
  });
});

describe("hostTheme", () => {
  const node = (attrs: Record<string, string> = {}) => ({ getAttribute: (k: string) => attrs[k] ?? null }) as unknown as Element;
  const doc = (html: Record<string, string>, body: Record<string, string> = {}) => ({ documentElement: node(html), body: node(body) });

  it("reads Docusaurus data-theme on <html>", () => {
    expect(hostTheme(doc({ "data-theme": "dark" }))).toBe("dark");
    expect(hostTheme(doc({ "data-theme": "light" }))).toBe("light");
  });

  it("reads Material data-md-color-scheme on <body>: slate is dark, any other palette light", () => {
    expect(hostTheme(doc({}, { "data-md-color-scheme": "slate" }))).toBe("dark");
    expect(hostTheme(doc({}, { "data-md-color-scheme": "default" }))).toBe("light");
  });

  it("is null when the host declares no scheme, or an unknown data-theme", () => {
    expect(hostTheme(doc({}))).toBeNull();
    expect(hostTheme(doc({ "data-theme": "sepia" }))).toBeNull();
    expect(hostTheme({ documentElement: node(), body: null })).toBeNull();
  });
});

describe("motionAllowed", () => {
  const animatable = { animate: () => undefined };
  const media = (matches: boolean) => ({ matchMedia: () => ({ matches }) });

  it("allows motion when Element.animate exists and reduced motion is not requested", () => {
    expect(motionAllowed(animatable, media(false))).toBe(true);
    expect(motionAllowed(animatable, {})).toBe(true);
  });

  it("skips motion under prefers-reduced-motion or without Element.animate", () => {
    expect(motionAllowed(animatable, media(true))).toBe(false);
    expect(motionAllowed({}, media(false))).toBe(false);
  });
});

describe("annotateSequence", () => {
  // Fake SVG: message texts and lines in DOM order, recording the attributes set on them.
  const svg = (labels: string[]) => {
    const node = (text = "") => ({ textContent: text, attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } });
    const texts = labels.map((l) => node(l));
    const lines = labels.map(() => node());
    const root = { querySelectorAll: (sel: string) => (sel === "text.messageText" ? texts : lines) };
    return { root: root as unknown as SVGElement, texts };
  };
  const seq = (id: string, edges: [string, string][]): DiagramEntry => ({ id, type: "sequence", nodes: [], edges });
  const step = (from: string, to: string, label: string): Step => ({ from, to, label, isReturn: false });
  const index: Index = {
    diagrams: [],
    elements: {},
    scenarios: {
      "ops#0": { doc: "ops.md", steps: [step("A", "B", "first 0"), step("B", "C", "first 1")] },
      "ops#1": { doc: "ops.md", steps: [step("C", "D", "second")] },
    },
  };

  it("maps the second sequence fence of a doc to its own scenario", () => {
    const { root, texts } = svg(["second"]);
    expect(annotateSequence(root, seq("ops.md#1", [["C", "D"]]), index)).toBeNull();
    expect(texts[0].attrs["data-docdive-message"]).toBe("1");
  });

  it("skips a fence that draws no scenario without reporting an error", () => {
    const { root, texts } = svg(["other"]);
    expect(annotateSequence(root, seq("ops.md#2", [["X", "Y"]]), index)).toBeNull();
    expect(texts[0].attrs).toEqual({});
  });

  it("reports a label mismatch on the fence's own scenario", () => {
    const { root } = svg(["first 0", "wrong"]);
    expect(annotateSequence(root, seq("ops.md#0", [["A", "B"], ["B", "C"]]), index)).toMatch(/unreliable/);
  });
});

describe("inspector and overview helpers", () => {
  const index: Index = {
    diagrams: [
      { id: "system.md#0", type: "flowchart", nodes: ["API", "Orders", "DB"], edges: [["API", "Orders"], ["Orders", "DB"]] },
      { id: "db.md#0", type: "flowchart", nodes: ["Pool"], edges: [] },
      { id: "db.md#1", type: "flowchart", nodes: ["Pool"], edges: [] },
      { id: "flow.md#0", type: "sequence", nodes: ["API", "Orders"], edges: [["API", "Orders"]] },
    ],
    elements: {
      system: { doc: "system.md", parent: null, children: ["API", "Orders", "DB"] },
      API: { doc: null, parent: "system", appearsIn: ["system.md#0", "flow.md#0"] },
      Orders: { doc: "orders.md", parent: "system", children: ["Orders"], src: ["src/orders/"] },
      DB: { doc: "db.md", parent: "system", children: ["Pool"] },
      Pool: { doc: null, parent: "DB", appearsIn: ["db.md#0", "db.md#1"] },
      loose: { doc: null, parent: null },
    },
    scenarios: { checkout: { doc: "flow.md", steps: [fwd("API", "Orders"), { from: "Orders", to: "API", label: "201", isReturn: true }] } },
  };

  it("divable means the element owns a doc", () => {
    expect(divable(index, "Orders")).toBe(true);
    expect(divable(index, "API")).toBe(false);
    expect(divable(index, "nope")).toBe(false);
  });

  it("labels a diagram by its owner, numbering fences of a multi-fence doc, falling back to the doc path", () => {
    expect(diagramLabel(index, "system.md#0")).toBe("system");
    expect(diagramLabel(index, "flow.md#0")).toBe("checkout");
    expect(diagramLabel(index, "db.md#1")).toBe("DB · 2");
    expect(diagramLabel(index, "other.md#0")).toBe("other.md");
  });

  it("lists only relation rows, scenarios included, description and src excluded", () => {
    expect(panelFields(index, "Orders")).toEqual([
      ["parent", ["system"]],
      ["children", ["Orders"]],
      ["appearsIn", []],
      ["scenarios", ["checkout"]],
    ]);
  });

  it("phrases a step as a sentence, returns as replies", () => {
    expect(stepSentence({ from: "API", to: "Orders", label: "POST /orders", isReturn: false })).toBe("API → Orders · POST /orders");
    expect(stepSentence({ from: "Orders", to: "API", label: "201", isReturn: true })).toBe("Orders replies 201 to API");
  });

  it("builds the tree from parentless doc owners and stops at a repeated child", () => {
    expect(systemTree(index)).toEqual([
      { id: "system", children: [{ id: "API", children: [] }, { id: "Orders", children: [] }, { id: "DB", children: [{ id: "Pool", children: [] }] }] },
    ]);
  });

  it("lists the elements a scenario crosses once, in order of first appearance", () => {
    expect(scenarioElements(index, "checkout")).toEqual(["API", "Orders"]);
    expect(scenarioElements(index, "nope")).toEqual([]);
  });

  it("marks flowchart nodes focusable and flags the divable ones", () => {
    const g = (id: string) => ({ id, attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } });
    const nodes = [g("r-flowchart-API-1"), g("r-flowchart-Orders-2"), g("r-flowchart-Unknown-3")];
    const svg = { querySelectorAll: (sel: string) => (sel === "g.node" ? nodes : []) } as unknown as SVGElement;
    annotateFlowchart(svg, index.diagrams[0] as DiagramEntry, index);
    expect(nodes[0]!.attrs).toEqual({ "data-docdive-node": "API", tabindex: "0", role: "button", "aria-label": "API" });
    expect(nodes[1]!.attrs["data-docdive-divable"]).toBe("");
    expect(nodes[1]!.attrs["aria-label"]).toBe("Orders, has its own diagram");
    expect(nodes[2]!.attrs).toEqual({});
  });
});
