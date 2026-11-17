import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDocs, parseDoc } from "./loader.js";
import { buildModel, resolveParticipant } from "./model.js";
import { proposeFuzzyIds } from "./fuzzy.js";
import { renderAllContexts } from "./context.js";

const dirs: string[] = [];
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "docdive-"));
  dirs.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const fc = (body: string) => "```mermaid\nflowchart LR\n" + body + "\n```\n";

describe("loader", () => {
  it("reads .mdx, indented fences and Mermaid in-block frontmatter", () => {
    const root = project({
      "a.mdx": "# A\n\n1. step\n\n   ```mermaid\n   ---\n   title: Hello\n   ---\n   sequenceDiagram\n     X->>Y: hi\n   ```\n",
      "b.md": "```mermaid\nstateDiagram-v2\n  [*] --> S\n```\n",
    });
    const docs = loadDocs(root);
    expect(docs.map((d) => d.path)).toEqual(["a.mdx", "b.md"]);
    expect(docs[0].blocks[0]).toMatchObject({ type: "sequenceDiagram", startLine: 9, source: "sequenceDiagram\n  X->>Y: hi" });
  });

  it("survives malformed doc frontmatter", () => {
    expect(parseDoc("x.md", "---\n: : bad\n  - [\n---\nbody").frontmatter).toEqual({});
  });
});

describe("buildModel", () => {
  it("links docs by frontmatter id and parent, and makes a doc's nodes its children", () => {
    const root = project({
      "system.md": "---\nid: system\n---\n" + fc("  Api --> Orders"),
      "orders.md": "---\nid: Orders\nparent: system\nsrc: [src/orders/]\ndescription: Takes orders.\n---\n" + fc("  Controller --> Repo"),
      "notes.md": fc("  Reports --> Exports"),
    });
    const { elements } = buildModel(loadDocs(root));
    expect(elements.Orders).toMatchObject({ doc: "orders.md", parent: "system", src: ["src/orders/"], description: "Takes orders." });
    expect(elements.system.children.sort()).toEqual(["Api", "Orders"]);
    expect(elements.Controller.parent).toBe("Orders");
    expect(elements.Reports.parent).toBeNull();
    expect(elements.notes).toBeUndefined();
  });

  it("merges frontmatter entities across docs, string or list, and ignores malformed ones", () => {
    const root = project({
      "a.md": "---\nid: Orders\nentities:\n  Order: src/orders/order.ts\n---\n" + fc("  X --> Y"),
      "b.md": "---\nid: flow\nkind: scenario\nentities:\n  Order: [src/orders/order.ts, src/orders/order.sql]\n  Payment: [src/pay/payment.ts]\n---\n```mermaid\nsequenceDiagram\n  X->>Y: go\n```\n",
      "c.md": "---\nid: Bad\nentities: [Order]\n---\n" + fc("  Z --> W"),
    });
    const { entities } = buildModel(loadDocs(root));
    expect(entities).toEqual({
      Order: { src: ["src/orders/order.ts", "src/orders/order.sql"] },
      Payment: { src: ["src/pay/payment.ts"] },
    });
  });

  it("indexes bare .mmd files and skips unsupported or broken blocks", () => {
    const root = project({
      "sys.mmd": "flowchart LR\n  Api --> Billing",
      "d.md": ["```mermaid\ngantt\n  title x\n```", "```mermaid\nflowchart LR\n  A --> B !!\n```", fc("  Billing --> Ledger")].join("\n\n"),
    });
    const index = buildModel(loadDocs(root));
    expect(index.diagrams.map((d) => d.id).sort()).toEqual(["d.md#2", "sys.mmd#0"]);
    expect(index.elements.Billing.appearsIn).toHaveLength(2);
    expect(index.diagnostics.filter((d) => d.rule === "parse-failed")).toHaveLength(1);
  });

  it("builds hierarchy from subgraphs, leaving parent unset when two containers claim an element", () => {
    const root = project({
      "a.md": fc("  subgraph Left\n    Shared --> Alpha\n    subgraph Inner\n      Cache\n    end\n  end"),
      "b.md": fc("  subgraph Right\n    Shared --> Beta\n  end"),
    });
    const { elements } = buildModel(loadDocs(root));
    expect(elements.Left.children).toEqual(["Alpha", "Inner"]);
    expect(elements.Cache.parent).toBe("Inner");
    expect(elements.Shared.parent).toBeNull();
  });

  it("gives a subgraph member to the subgraph, not to the doc that draws it", () => {
    const root = project({ "app.md": "---\nid: App\n---\n" + fc("  subgraph Backend\n    Api --> Db\n  end\n  Web --> Api") });
    const { elements } = buildModel(loadDocs(root));
    expect(elements.Api.parent).toBe("Backend");
    expect(elements.Backend.parent).toBe("App");
    expect(elements.Web.parent).toBe("App");
  });

  it("keeps a node with the outermost doc when a zoom diagram redraws it", () => {
    const root = project({
      "system.md": "---\nid: system\n---\n" + fc("  Api --> Orders"),
      "orders.md": "---\nid: Orders\nparent: system\n---\n" + fc("  Api --> Controller"),
    });
    const { elements } = buildModel(loadDocs(root));
    expect(elements.Api.parent).toBe("system");
    expect(elements.Controller.parent).toBe("Orders");
  });

  it("keeps IDs of ≤2 chars out of the elements", () => {
    const root = project({ "a.md": "---\nid: guide\n---\n" + fc("  A --> Gateway") });
    const { elements } = buildModel(loadDocs(root));
    expect(elements.A).toBeUndefined();
    expect(elements.guide.children).toEqual(["Gateway"]);
  });

  it("records node lines as absolute Markdown lines", () => {
    const root = project({
      "a.md": "# A\n\n```mermaid\n---\ntitle: T\n---\nflowchart LR\n  X --> Y[Why]\n```\n\n```mermaid\nsequenceDiagram\n  participant Z\n  Z->>W: hi\n```\n",
    });
    expect(buildModel(loadDocs(root)).diagrams.map((d) => d.lines)).toEqual([{ X: 8, Y: 8 }, { Z: 13, W: 14 }]);
  });

  it("names scenarios by id, infers the others, and flags scenario steps missing from a flowchart", () => {
    const root = project({
      "flow.md": "---\nid: checkout\nkind: scenario\n---\n```mermaid\nsequenceDiagram\n  Gateway->>Worker: run\n```\n",
      "ops.md": "---\nid: Ops\n---\n```mermaid\nsequenceDiagram\n  Worker->>Queue: push\n```\n",
      "b.md": fc("  Gateway --> Queue\n  Worker --> Queue"),
    });
    const index = buildModel(loadDocs(root));
    expect(Object.keys(index.scenarios).sort()).toEqual(["Ops#0", "checkout"]);
    expect(index.scenarios["Ops#0"].inferred).toBe(true);
    expect(resolveParticipant(index, "Gateway")).toBe(true);
    expect(resolveParticipant(index, "Nobody")).toBe(false);
    expect(index.diagnostics.filter((d) => d.rule === "edge-not-in-diagram")).toMatchObject([{ scenario: "checkout", from: "Gateway", to: "Worker" }]);
  });

  it("carries state notes on steps and the initial state, and warns on a note over a silent participant", () => {
    const root = project({
      "flow.md": "---\nid: checkout\nkind: scenario\n---\n```mermaid\nsequenceDiagram\n  Note over Cart: Cart items=0\n  API->>Orders: POST\n  Note over Orders: Order status=pending\n  Note over Ordres: Order status=lost\n```\n",
    });
    const index = buildModel(loadDocs(root));
    const sc = index.scenarios.checkout!;
    expect(sc.initial).toEqual([{ over: ["Cart"], entity: "Cart", fields: { items: "0" }, text: "" }]);
    expect(sc.steps[0]?.notes?.map((n) => n.over)).toEqual([["Orders"], ["Ordres"]]);
    expect(index.diagnostics.filter((d) => d.rule === "note-participant-unknown").map((d) => d.participant).sort()).toEqual(["Cart", "Ordres"]);
  });
});

describe("fuzzy IDs", () => {
  it("proposes normalised and near matches but skips digit-only variants", () => {
    const el = { doc: null, parent: null, children: [], src: [], appearsIn: [] };
    const d = proposeFuzzyIds({ "order-service": el, OrderService: el, PaymentGateway: el, PaymentGatway: el, worker1: el, worker2: el });
    expect(d.map((x) => [x.a, x.b, x.kind])).toEqual([
      ["OrderService", "order-service", "normalized"],
      ["PaymentGateway", "PaymentGatway", "edit-distance"],
    ]);
  });
});

describe("renderAllContexts", () => {
  it("renders every element, with the doc body when it has one", () => {
    const root = project({
      "system.md": "---\nid: system\n---\n" + fc("  API --> Orders"),
      "orders.md": "---\nid: Orders\nparent: system\n---\nOrders body.\n\n" + fc("  Ctl --> Repo"),
    });
    const docs = loadDocs(root);
    const all = renderAllContexts(buildModel(docs), docs);
    expect(Object.keys(all).sort()).toEqual(["API", "Ctl", "Orders", "Repo", "system"]);
    expect(all.Orders).toContain("Orders body.");
    expect(all.API).not.toContain("## Doc");
  });

  it("lists the state an element holds at each scenario step", () => {
    const root = project({
      "flow.md": "---\nid: checkout\nkind: scenario\n---\n```mermaid\nsequenceDiagram\n  API->>Orders: POST\n  Note over Orders: Order status=pending\n  Note over API: ack\n```\n",
    });
    const docs = loadDocs(root);
    const all = renderAllContexts(buildModel(docs), docs);
    expect(all.Orders).toContain("1. API -> Orders: POST\n   state: Order status=pending");
    expect(all.API).toContain("1. API -> Orders: POST\n   state: ack");
  });
});
