import { describe, expect, it } from "vitest";
import { extractFlowchart } from "./flowchart.js";
import { extractSequence } from "./sequence.js";

describe("extractFlowchart", () => {
  it("extracts chained arrows and shape labels", () => {
    const r = extractFlowchart("flowchart LR\n  API --> OrderService --> PaymentGateway\n  OrderService --> OrdersDB[(orders)]");
    expect(r.nodes).toEqual(["API", "OrderService", "PaymentGateway", "OrdersDB"]);
    expect(r.edges).toEqual([
      ["API", "OrderService"],
      ["OrderService", "PaymentGateway"],
      ["OrderService", "OrdersDB"],
    ]);
    expect(r.labels.OrdersDB).toBe("orders");
  });

  it.each([
    ["A[a]", "a"],
    ["A(a)", "a"],
    ["A[(a)]", "a"],
    ["A{a}", "a"],
    ["A((a))", "a"],
    ["A>a]", "a"],
  ])("handles shape %s", (node, label) => {
    const r = extractFlowchart(`flowchart TB\n  ${node} --> B`);
    expect(r.labels.A).toBe(label);
    expect(r.edges).toEqual([["A", "B"]]);
  });

  it("handles edge labels and tight arrows", () => {
    const r = extractFlowchart("graph TD\n A-->|yes|B\n B -- no --> C\n C-.->D");
    expect(r.edges).toEqual([["A", "B"], ["B", "C"], ["C", "D"]]);
  });

  it("handles quoted labels with `&`, :::class, fan-out, and multi-line labels", () => {
    const r = extractFlowchart(
      'flowchart LR\n  A["Cats & Dogs"]:::cls & B --> |yes| C{Is it\n  ok}\n  C --maybe--> D\n  D -.note.-> E',
    );
    expect(r.nodes).toEqual(["A", "B", "C", "D", "E"]);
    expect(r.labels.A).toBe("Cats & Dogs");
    expect(r.labels.C).toBe("Is it\n  ok");
    expect(r.edges).toEqual([["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"]]);
  });

  it.each([
    "A <--> B",
    "A <-.-> B",
    "A <-. text .-> B",
    'A <-. "quoted" .-> B',
    "A <-- text --> B",
    'A<--"multi\nline"-->B',
    "A <== text ==> B",
    "A ---x B",
    "A --text---x B",
    "A -- text -----x B",
    "A x--x B",
    "A o--o B",
  ])("reads bidirectional and crossed arrow %j as one edge", (line) => {
    const r = extractFlowchart(`flowchart LR\n  ${line}`);
    expect(r.nodes).toEqual(["A", "B"]);
    expect(r.edges).toEqual([["A", "B"]]);
  });

  it("skips accessibility lines and parses @{ label } nodes", () => {
    const r = extractFlowchart('flowchart TD\n  accTitle: T\n  accDescr: d\n  A@{ shape: rect, label: "hi" } --> B');
    expect(r.labels.A).toBe("hi");
    expect(r.edges).toEqual([["A", "B"]]);
  });

  it("records the declaration line, else the first mention, and ignores multi-line directives", () => {
    const r = extractFlowchart(
      'flowchart LR\n  %%{init: {\n"theme": "base"}}%%\n  A --> B\n  B[Bee]\n  subgraph S [Group]\n    C\n  end\n  A --> C',
    );
    expect(r.lines).toEqual({ A: 4, B: 5, S: 6, C: 7 });
  });

  it("fails loudly on unsupported node syntax", () => {
    expect(() => extractFlowchart("flowchart LR\n A --> B !!")).toThrow(/Unrecognised|Unsupported/);
    expect(() => extractFlowchart("flowchart LR\n A --> B@oops")).toThrow(/Unrecognised/);
  });
});

describe("extractSequence", () => {
  it("extracts ordered steps and flags return messages", () => {
    const r = extractSequence(
      "sequenceDiagram\n  API->>OrderService: POST /orders\n  PaymentGateway-->>OrderService: ok",
    );
    expect(r.participants).toEqual(["API", "OrderService", "PaymentGateway"]);
    expect(r.steps).toEqual([
      { from: "API", to: "OrderService", label: "POST /orders", isReturn: false },
      { from: "PaymentGateway", to: "OrderService", label: "ok", isReturn: true },
    ]);
  });

  it("keeps explicit participants first", () => {
    const r = extractSequence("sequenceDiagram\n  participant DB\n  A->>B: x");
    expect(r.participants).toEqual(["DB", "A", "B"]);
  });

  it("skips accTitle and accepts participants with spaces", () => {
    const r = extractSequence("sequenceDiagram\n  accTitle: x\n  participant Git on client\n  Git on client->>Server: push");
    expect(r.participants).toEqual(["Git on client", "Server"]);
    expect(r.steps).toHaveLength(1);
  });

  it("records the participant declaration line, else the first message, past multi-line blocks", () => {
    const r = extractSequence(
      "sequenceDiagram\n  %%{init: {\n\"theme\": \"base\"}}%%\n  accDescr {\n  text\n  }\n  A->>B: x\n  participant B\n  actor C\n  A->>C: y",
    );
    expect(r.lines).toEqual({ A: 7, B: 8, C: 9 });
  });

  it("fails loudly on unrecognised lines", () => {
    expect(() => extractSequence("sequenceDiagram\n  this is nonsense")).toThrow(/Unrecognised/);
  });
});
