import { describe, expect, it } from "vitest";
import { edgeOccurrence, touchesDiagram, type DiagramEntry, type Index, type Step } from "./shared.js";

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
