import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractFlowchart } from "./flowchart.js";
import { proposeFuzzyIds } from "./fuzzy.js";
import { loadDocs, parseDoc } from "./loader.js";
import { buildModel, resolveParticipant } from "./model.js";
import { buildReport } from "./report.js";
import { buildContext, renderAllContexts, renderContextMarkdown } from "./context.js";

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

describe("loader", () => {
  it("reads .mdx, indented fences and Mermaid in-block frontmatter", () => {
    const root = project({
      "a.mdx": "# A\n\n1. step\n\n   ```mermaid\n   ---\n   title: Hello\n   ---\n   sequenceDiagram\n     X->>Y: hi\n   ```\n",
      "b.md": "```mermaid\nstateDiagram-v2\n  [*] --> S\n```\n",
    });
    const docs = loadDocs(root, root);
    expect(docs.map((d) => d.path)).toEqual(["a.mdx", "b.md"]);
    expect(docs[0].blocks[0]).toMatchObject({
      type: "sequenceDiagram",
      title: "Hello",
      startLine: 9,
      source: "sequenceDiagram\n  X->>Y: hi",
    });
    expect(docs[1].blocks[0].type).toBe("stateDiagram-v2");
  });

  it("survives malformed doc frontmatter", () => {
    expect(parseDoc("x.md", "---\n: : bad\n  - [\n---\nbody").frontmatter).toEqual({});
  });
});

describe("buildModel on brownfield input", () => {
  it("indexes bare .mmd files as one diagram each", () => {
    const root = project({ "sys.mmd": "flowchart LR\n  Api --> Billing", "md.md": "```mermaid\nflowchart LR\n  Billing --> Ledger\n```" });
    const index = buildModel(root, root);
    expect(index.diagrams.map((d) => d.id).sort()).toEqual(["md.md#0", "sys.mmd#0"]);
    expect(index.elements.Billing.appearsIn).toHaveLength(2);
  });

  it("counts unsupported and failed blocks instead of aborting", () => {
    const root = project({
      "d.md": [
        "```mermaid\ngantt\n  title x\n```",
        "```mermaid\nflowchart LR\n  A --> B !!\n```",
        "```mermaid\nflowchart LR\n  A --> B\n```",
      ].join("\n\n"),
    });
    const index = buildModel(root, root);
    expect(index.stats.byStatus).toEqual({ supported: 1, "unsupported-type": 1, "parse-failed": 1 });
    expect(index.diagnostics.filter((d) => d.rule === "parse-failed")).toHaveLength(1);
    expect(index.diagrams).toHaveLength(1);
  });

  it("infers scenarios, doc ids and folder parents without frontmatter", () => {
    const root = project({
      "ci/_index.md": "# CI\n",
      "ci/deploy.md": "# Deploy\n\n```mermaid\nsequenceDiagram\n  Runner->>Server: push\n```\n",
    });
    const index = buildModel(root, root);
    expect(index.scenarios["deploy#0"]).toMatchObject({ doc: "ci/deploy.md", inferred: true });
    expect(index.elements.deploy).toMatchObject({ doc: "ci/deploy.md", parent: "ci", confidence: 0.6 });
    expect(index.elements.ci.children).toContain("deploy");
  });

  it("builds hierarchy from nested subgraphs", () => {
    const root = project({
      "d.md": "```mermaid\nflowchart LR\n  subgraph Outer [Outer box]\n    Api --> Database\n    subgraph Inner\n      Cache\n    end\n  end\n```\n",
    });
    const { elements } = buildModel(root, root);
    expect(elements.Outer.children).toEqual(["Api", "Database", "Inner"]);
    expect(elements.Inner).toMatchObject({ parent: "Outer", children: ["Cache"] });
    expect(elements.Cache.parent).toBe("Inner");
  });
});

describe("extractFlowchart subgraphs", () => {
  it("records members, labels and nesting", () => {
    const r = extractFlowchart("flowchart TB\n  subgraph P [Phase 1]\n    direction LR\n    A --> B\n  end\n  C --> A");
    expect(r.subgraphs).toEqual([{ id: "P", label: "Phase 1", parent: null, members: ["A", "B"] }]);
  });
});

describe("fuzzy IDs", () => {
  const el = (doc: string | null = null) => ({
    scope: "global" as const,
    doc,
    parent: null,
    parentCandidates: [],
    children: [],
    src: [],
    appearsIn: [],
    confidence: 0.5,
  });

  it("proposes normalised and near matches but skips digit-only variants", () => {
    const d = proposeFuzzyIds({
      "order-service": el(),
      OrderService: el(),
      PaymentGateway: el(),
      PaymentGatway: el(),
      worker1: el(),
      worker2: el(),
    });
    expect(d.map((x) => [x.a, x.b, x.kind])).toEqual([
      ["OrderService", "order-service", "normalized"],
      ["PaymentGateway", "PaymentGatway", "edit-distance"],
    ]);
  });
});

describe("report", () => {
  it("counts a cross-linked element only when its exact ID is in ≥2 diagrams", () => {
    const root = project({
      "a.md": "```mermaid\nflowchart LR\n  Api --> Database\n```\n",
      "b.md": "```mermaid\nflowchart LR\n  Api --> Cache\n```\n",
    });
    const report = buildReport(buildModel(root, root), root, false);
    expect(report.elements.crossLinked).toBe(1);
    expect(report.elements.crossLinkedPct).toBeCloseTo(33.3, 1);
  });
});

const fc = (body: string) => "```mermaid\nflowchart LR\n" + body + "\n```\n";

describe("identity scope", () => {
  it("makes IDs of ≤2 chars placeholders keyed per diagram, outside cross-linking and hierarchy", () => {
    const root = project({
      "a.md": "---\nid: guide\n---\n" + fc("  A --> Gateway"),
      "b.md": fc("  A --> Gateway"),
    });
    const { elements } = buildModel(root, root);
    expect(elements.A).toBeUndefined();
    expect(elements["a.md#0::A"]).toMatchObject({ scope: "placeholder", appearsIn: ["a.md#0"], parent: null });
    expect(elements.guide.children).toEqual(["Gateway"]);
  });

  it("makes IDs with conflicting labels local in every diagram", () => {
    const root = project({
      "a.md": fc('  Start["Begin job"] --> Worker'),
      "b.md": fc('  Start["Open ticket"] --> Worker'),
    });
    const { elements } = buildModel(root, root);
    expect(elements.Start).toBeUndefined();
    expect(elements["a.md#0::Start"].scope).toBe("local");
    expect(elements["b.md#0::Start"].scope).toBe("local");
    expect(elements.Worker).toMatchObject({ scope: "global", appearsIn: ["a.md#0", "b.md#0"] });
  });

  it("honours frontmatter `ids: local` and `ids: { shared }`", () => {
    const root = project({
      "a.md": "---\nids: local\n---\n" + fc("  Gateway --> Cache"),
      "b.md": "---\nids:\n  shared: [A, Cache]\n---\n" + fc("  A --> Cache"),
    });
    const { elements } = buildModel(root, root);
    expect(elements["a.md#0::Gateway"].scope).toBe("local");
    expect(elements.A.scope).toBe("global");
    expect(elements.Cache.scope).toBe("global");
    expect(elements["a.md#0::Cache"].scope).toBe("local");
  });
});

describe("parent candidates", () => {
  it("leaves parent unset when two subgraphs claim an element", () => {
    const root = project({
      "a.md": fc("  subgraph Left\n    Shared --> Alpha\n  end"),
      "b.md": fc("  subgraph Right\n    Shared --> Beta\n  end"),
    });
    const { elements } = buildModel(root, root);
    expect(elements.Shared).toMatchObject({ parent: null, parentCandidates: ["Left", "Right"] });
    expect(elements.Left.children).toEqual(["Alpha"]);
    expect(elements.Alpha.parent).toBe("Left");
  });

  it("makes nodes children of a doc only when the doc declares an explicit id", () => {
    const root = project({
      "explicit.md": "---\nid: Billing\n---\n" + fc("  Invoices --> Ledger"),
      "inferred.md": fc("  Reports --> Exports"),
    });
    const { elements } = buildModel(root, root);
    expect(elements.Invoices.parent).toBe("Billing");
    expect(elements.Reports.parent).toBeNull();
    expect(elements.inferred.children).toEqual([]);
  });
});

describe("node lines", () => {
  it("are absolute Markdown lines, offset past fence frontmatter", () => {
    const root = project({
      "a.md": "# A\n\n```mermaid\n---\ntitle: T\n---\nflowchart LR\n  X --> Y[Why]\n```\n\n```mermaid\nsequenceDiagram\n  participant Z\n  Z->>W: hi\n```\n",
    });
    const { diagrams } = buildModel(root, root);
    expect(diagrams.map((d) => d.lines)).toEqual([{ X: 8, Y: 8 }, { Z: 13, W: 14 }]);
  });
});

describe("SSG frontmatter id", () => {
  const doc = "---\nid: intro-page\n---\n" + fc("  Server --> Client");

  it("is an explicit element ID without an SSG config", () => {
    const root = project({ "a.md": doc });
    const { elements } = buildModel(root, root);
    expect(elements["intro-page"]).toMatchObject({ confidence: 1 });
    expect(elements.Server.parent).toBe("intro-page");
  });

  it("is an inferred doc id (0.6, no doc-children) next to a Docusaurus or MkDocs config", () => {
    for (const config of ["docusaurus.config.js", "mkdocs.yml"]) {
      const root = project({ [config]: "", "docs/a.md": doc });
      const { elements } = buildModel(join(root, "docs"), join(root, "docs"));
      expect(elements["intro-page"]).toMatchObject({ confidence: 0.6 });
      expect(elements.Server.parent).toBeNull();
    }
  });
});

describe("scenario anchoring", () => {
  const seq = "```mermaid\nsequenceDiagram\n  Gateway->>Worker: run\n  Worker->>Queue: push\n```\n";

  it("resolves participants that have a doc or appear in ≥2 diagrams, and skips edge diagnostics for inferred scenarios", () => {
    const root = project({
      "ops/Worker.md": "# Worker\n\n" + fc("  Worker --> Pool"),
      "a.md": seq,
      "b.md": fc("  Gateway --> Queue"),
    });
    const index = buildModel(root, root);
    expect(resolveParticipant(index, "Gateway")).toBe(true);
    expect(resolveParticipant(index, "Worker")).toBe(true);
    expect(resolveParticipant(index, "Nobody")).toBe(false);
    expect(index.diagnostics.some((d) => d.rule === "edge-not-in-diagram")).toBe(false);
  });
});

describe("renderAllContexts", () => {
  it("maps every element to its single-element render, documented or not", () => {
    const root = project({
      "system.md": "---\nid: system\n---\n" + "```mermaid\nflowchart LR\n  API --> Orders\n```\n",
      "orders.md": "---\nid: Orders\nparent: system\n---\nOrders body.\n\n```mermaid\nflowchart LR\n  Ctl --> Repo\n```\n",
    });
    const index = buildModel(root, root);
    const all = renderAllContexts(index, root);
    expect(Object.keys(all).sort()).toEqual(Object.keys(index.elements).sort());
    for (const id of Object.keys(index.elements)) {
      expect(all[id]).toBe(renderContextMarkdown(buildContext(index, root, id)));
    }
    expect(all.Orders).toContain("Orders body.");
    expect(all.API).not.toContain("## Doc");
  });
});
