import { describe, expect, it } from "vitest";
import { edgeOccurrence, hasSeveralFences, sourceHref, touchesDiagram, urlStateOwner, type DiagramEntry, type Index, type Step } from "./shared.js";

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
