import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyFixes } from "./fix.js";
import { floorStats } from "./floor.js";
import { isAbbreviation, lint } from "./lint.js";

const dirs: string[] = [];
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "docdive-lint-"));
  dirs.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const doc = (front: string, diagram = "flowchart LR\n  X --> Y") => `---\n${front}\n---\n\`\`\`mermaid\n${diagram}\n\`\`\`\n`;
const rules = (root: string) => lint(join(root, "docs"), root).errors.map((e) => e.rule);

describe("lint errors", () => {
  it("flags a missing src path and accepts an existing one", () => {
    const root = repo({
      "src/orders/index.ts": "",
      "docs/a.md": doc("id: A\nsrc: [src/orders/]"),
      "docs/b.md": doc("id: B\nsrc: [src/nope/]"),
    });
    const errors = lint(join(root, "docs"), root).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rule: "missing-src", file: "docs/b.md", src: "src/nope/" });
  });

  it("flags a parent that is no doc id, with a suggestion only when one candidate fits", () => {
    const root = repo({
      "docs/system.md": doc("id: system"),
      "docs/a.md": doc("id: A\nparent: sytem"),
      "docs/b.md": doc("id: B\nparent: nowhere"),
    });
    const errors = lint(join(root, "docs"), root).errors.filter((e) => e.rule === "missing-parent");
    expect(errors.map((e) => [e.file, e.suggestion])).toEqual([
      ["docs/a.md", "system"],
      ["docs/b.md", undefined],
    ]);
  });

  it("flags the same id declared by sibling docs, but not under different parents", () => {
    const siblings = repo({
      "docs/p.md": doc("id: P"),
      "docs/a.md": doc("id: Svc\nparent: P"),
      "docs/b.md": doc("id: Svc\nparent: P"),
    });
    expect(rules(siblings)).toEqual(["duplicate-id-siblings", "duplicate-id-siblings"]);
    const cousins = repo({
      "docs/p.md": doc("id: P"),
      "docs/q.md": doc("id: Q"),
      "docs/a.md": doc("id: Svc\nparent: P"),
      "docs/b.md": doc("id: Svc\nparent: Q"),
    });
    expect(rules(cousins)).toEqual([]);
  });

  it("flags a participant that is a near-miss of a documented ID but allows plain actors", () => {
    const seq = "sequenceDiagram\n  User->>OrderSvc: go\n  OrderSvc->>Gateway: pay";
    const root = repo({
      "docs/order.md": doc("id: OrderService", "flowchart LR\n  Order --> OrderService"),
      "docs/flow.md": doc("kind: scenario\nid: place", seq),
    });
    const errors = lint(join(root, "docs"), root).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rule: "unresolved-participant", participant: "OrderSvc", suggestion: "OrderService" });
  });

  it("abbreviation needs the same first letter, subsequence order and enough length", () => {
    expect(isAbbreviation("OrderSvc", "OrderService")).toBe(true);
    expect(isAbbreviation("Client", "ClientService")).toBe(false);
    expect(isAbbreviation("Service", "OrderService")).toBe(false);
  });
});

describe("--fix", () => {
  it("rewrites a missing parent to the single closest doc id and renames normalized near-duplicates", () => {
    const root = repo({
      "docs/system.md": doc("id: system"),
      "docs/a.md": doc("id: Billing\nparent: sytem", "flowchart LR\n  Order_Service --> Billing\n  OrderService --> Billing"),
    });
    const fixes = applyFixes(join(root, "docs"), root);
    expect(fixes.map((f) => [f.rule, f.from, f.to])).toEqual([
      ["missing-parent", "sytem", "system"],
      ["fuzzy-id-candidate", "Order_Service", "OrderService"],
    ]);
    const a = readFileSync(join(root, "docs/a.md"), "utf8");
    expect(a).toContain("parent: system");
    expect(a).not.toContain("Order_Service");
    expect(lint(join(root, "docs"), root).errors).toEqual([]);
  });

  it("leaves ambiguous and unfixable errors alone", () => {
    const root = repo({ "docs/a.md": doc("id: A\nparent: nowhere\nsrc: [nope/]") });
    const before = readFileSync(join(root, "docs/a.md"), "utf8");
    expect(applyFixes(join(root, "docs"), root)).toEqual([]);
    expect(readFileSync(join(root, "docs/a.md"), "utf8")).toBe(before);
  });
});

describe("floor stats", () => {
  const files: Record<string, string> = { "docs/s.md": doc("id: S", "flowchart LR\n  A1x --> B1x --> C1x --> D1x --> E1x") };
  for (const n of ["a", "b", "c", "d"]) {
    files[`docs/${n}.md`] = doc(`id: ${n.toUpperCase()}doc\nparent: S`, "flowchart LR\n  A1x --> B1x --> C1x --> D1x --> E1x");
  }

  it("is not met without a scenario, and met once all four conditions hold", () => {
    const thinRoot = repo(files);
    const thin = floorStats(join(thinRoot, "docs"), thinRoot);
    expect(thin).toMatchObject({ docs: 5, parentLinks: 4, scenarios: 0, sharedIds: 5, floorMet: false });
    const root = repo({ ...files, "docs/flow.md": doc("kind: scenario\nid: go", "sequenceDiagram\n  A1x->>B1x: hi") });
    expect(floorStats(join(root, "docs"), root)).toMatchObject({ docs: 6, scenarios: 1, floorMet: true });
  });

  it("is not met on an empty doc set", () => {
    const root = repo({ "docs/x.md": "# nothing\n" });
    expect(floorStats(join(root, "docs"), root).floorMet).toBe(false);
  });
});
