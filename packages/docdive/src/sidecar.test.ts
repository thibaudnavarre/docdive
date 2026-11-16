import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildContext, renderContextMarkdown } from "./context.js";
import { lint } from "./lint.js";
import { buildModel } from "./model.js";
import { loadSidecar, stampSidecar } from "./sidecar.js";

const dirs: string[] = [];
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "docdive-sidecar-"));
  dirs.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const fence = (body: string) => `\`\`\`mermaid\n${body}\n\`\`\`\n`;
const DOCS = {
  "docs/system.md": fence("flowchart LR\n  Web --> Api\n  Api --> Worker"),
  "docs/flow.md": fence("sequenceDiagram\n  UI->>Api: submit\n  Api->>Workers: run"),
};
const folder = (root: string) => join(root, "docs");
const withSidecar = (yaml: string, docs: Record<string, string> = DOCS) => repo({ ...docs, "docs/docdive.model.yaml": yaml });
const errors = (root: string) => lint(folder(root), root).errors.map((e) => `${e.rule}`);

describe("loadSidecar", () => {
  it("returns nothing for a missing file", () => {
    expect(loadSidecar(folder(repo(DOCS)))).toEqual({ sidecar: null, problems: [] });
  });

  it("turns bad YAML into a problem instead of throwing", () => {
    const { sidecar, problems } = loadSidecar(folder(withSidecar("elements: [unclosed")));
    expect(sidecar).toBeNull();
    expect(problems[0]).toMatchObject({ rule: "sidecar-invalid" });
  });

  it("drops a malformed entry, keeps the others and fills defaults", () => {
    const { sidecar, problems } = loadSidecar(folder(withSidecar("elements:\n  Bad: { aliases: nope }\n  Good: { parent: Api }\n")));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ element: "Bad" });
    expect(sidecar?.elements).toEqual({ Good: { aliases: [], src: [], kind: "element", parent: "Api" } });
  });
});

describe("merge", () => {
  const yaml = "elements:\n  Web: { aliases: [UI], parent: Api, description: front }\n  Worker: { aliases: [Workers] }\n";

  it("resolves alias nodes to the canonical element everywhere", () => {
    const root = withSidecar(yaml);
    const index = buildModel(folder(root), folder(root));
    expect(index.elements.UI).toBeUndefined();
    expect(index.elements.Web).toMatchObject({ aliases: ["UI"], description: "front", origin: "sidecar", parent: "Api" });
    expect(index.elements.Web?.appearsIn.sort()).toEqual(["flow.md#0", "system.md#0"]);
    expect(index.elements.Api?.children).toContain("Web");
    expect(index.diagrams.find((d) => d.id === "flow.md#0")?.nodeElement).toEqual({ UI: "Web", Workers: "Worker" });
    expect(index.diagrams.find((d) => d.id === "system.md#0")?.nodeElement).toBeUndefined();
    expect(index.scenarios["flow#0"]?.steps.map((s) => [s.from, s.to])).toEqual([["Web", "Api"], ["Api", "Worker"]]);
  });

  it("keeps frontmatter above the sidecar, and the sidecar above inference", () => {
    const root = withSidecar(
      "elements:\n  Api: { parent: Wrong, src: [from-sidecar/], description: sidecar text }\n  Web: { parent: Api }\n",
      {
        "docs/api.md": `---\nid: Api\nparent: Top\nsrc: [from-doc/]\ndescription: doc text\n---\n${fence("flowchart LR\n  Web --> Db")}`,
        "docs/top.md": `---\nid: Top\n---\n${fence("flowchart LR\n  Api --> X1x")}`,
      },
    );
    const { elements } = buildModel(folder(root), folder(root));
    expect(elements.Api).toMatchObject({ parent: "Top", src: ["from-doc/"] });
    expect(elements.Api?.description).toBeUndefined();
    expect(elements.Web?.parent).toBe("Api");
  });

  it("changes nothing without a sidecar: no new fields, same JSON as an empty sidecar", () => {
    const plain = repo(DOCS);
    const empty = withSidecar("elements: {}\n");
    const a = JSON.stringify(buildModel(folder(plain), plain));
    expect(a).not.toMatch(/aliases|nodeElement|origin|description/);
    expect(JSON.stringify(buildModel(folder(empty), empty))).toBe(a);
  });
});

describe("sidecar lint", () => {
  it.each([
    ["alias in no diagram", "elements:\n  Web: { aliases: [Ghost] }\n", "sidecar-alias-unused"],
    ["alias claimed twice", "elements:\n  Web: { aliases: [UI] }\n  Api: { aliases: [UI] }\n", "sidecar-alias-conflict"],
    ["unknown parent", "elements:\n  Web: { parent: Nowhere }\n", "sidecar-unknown-parent"],
    ["parent cycle", "elements:\n  Web: { parent: Api }\n  Api: { parent: Web }\n", "sidecar-parent-cycle"],
    ["missing src", "elements:\n  Web: { src: [nope/] }\n", "sidecar-missing-src"],
    ["invalid entry", "elements:\n  Web: 3\n", "sidecar-invalid"],
  ])("errors on %s", (_name, yaml, rule) => {
    expect(errors(withSidecar(yaml))).toContain(rule);
  });

  it("does not flag a sequence participant that is a sidecar alias of a documented element", () => {
    const root = withSidecar("elements:\n  Operator: { aliases: [Operateur] }\n", {
      "docs/a.md": `---\nid: Operator\n---\n${fence("flowchart LR\n  Operator --> Api")}`,
      "docs/flow.md": fence("sequenceDiagram\n  Operateur->>Api: go"),
    });
    expect(errors(root)).not.toContain("unresolved-participant");
  });

  it("is clean for a valid, stamped sidecar", () => {
    const root = withSidecar("elements:\n  Web: { aliases: [UI], parent: Api }\n  Worker: { aliases: [Workers] }\n  Order: { kind: entity, parent: Api }\n");
    stampSidecar(folder(root));
    expect(lint(folder(root), root)).toMatchObject({ errors: [], warnings: [] });
  });

  it("warns about changed, deleted and unstamped docs, and orphan elements", () => {
    const root = withSidecar("elements:\n  Lonely: {}\n");
    stampSidecar(folder(root));
    writeFileSync(join(root, "docs/system.md"), fence("flowchart LR\n  Web --> Api"));
    writeFileSync(join(root, "docs/new.md"), fence("flowchart LR\n  Web --> Api"));
    const warnings = lint(folder(root), root).warnings;
    expect(warnings.find((w) => w.rule === "sidecar-stale-sources")?.sources).toEqual(["new.md (not stamped)", "system.md (changed)"]);
    expect(warnings.map((w) => w.rule)).toContain("sidecar-orphan-element");
  });
});

describe("stampSidecar", () => {
  it("rewrites only sources and keeps comments", () => {
    const root = withSidecar("# keep me\nelements:\n  Web: { aliases: [UI] }\n");
    expect(stampSidecar(folder(root)).docs).toBe(2);
    const text = readFileSync(join(folder(root), "docdive.model.yaml"), "utf8");
    expect(text).toContain("# keep me");
    expect(loadSidecar(folder(root)).sidecar?.sources).toHaveProperty(["system.md"]);
  });

  it("refuses to stamp without a sidecar", () => {
    expect(() => stampSidecar(folder(repo(DOCS)))).toThrow(/no docdive.model.yaml/);
  });
});

describe("context bundle", () => {
  it("carries aliases, description and entities", () => {
    const root = withSidecar("elements:\n  Api: { description: the api }\n  Web: { aliases: [UI] }\n  Order: { kind: entity, parent: Api }\n");
    const index = buildModel(folder(root), folder(root));
    const web = buildContext(index, folder(root), "Web");
    expect(web.aliases).toEqual(["UI"]);
    const api = buildContext(index, folder(root), "Api");
    expect(api).toMatchObject({ description: "the api", entities: ["Order"] });
    expect(renderContextMarkdown(api)).toContain("## Entities\n- Order");
  });
});
