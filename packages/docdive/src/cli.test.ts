import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT_ERROR, EXIT_OK, EXIT_USAGE, run } from "./run.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "docdive-cli-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function docs(): string {
  const root = tmp();
  const folder = join(root, "docs");
  mkdirSync(folder);
  writeFileSync(
    join(folder, "a.md"),
    "---\nid: A\n---\n```mermaid\nflowchart LR\n  X[Alpha] --> Y[Beta]\n```\n",
  );
  return folder;
}

function exec(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(args, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const pkg = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Record<string, unknown>;

describe("usage errors", () => {
  it.each([
    [[], "missing command"],
    [["bogus"], 'unknown command "bogus"'],
    [["index"], "missing <folder>"],
    [["build", "x"], "missing --out"],
    [["context", "A"], "missing --folder"],
    [["index", "x", "--nope"], "Unknown option"],
  ])("%j exits 2 with usage on stderr", (args, message) => {
    const r = exec(args);
    expect(r.code).toBe(EXIT_USAGE);
    expect(r.out).toBe("");
    expect(r.err).toContain(message);
    expect(r.err).toContain("usage: docdive");
  });

  it("exits 1 for a missing folder or unknown element, with no usage text", () => {
    const missing = exec(["index", join(tmp(), "nope")]);
    expect(missing.code).toBe(EXIT_ERROR);
    expect(missing.err).toContain("folder not found");
    expect(missing.err).not.toContain("usage:");

    const unknown = exec(["context", "ZZZ", "--folder", docs()]);
    expect(unknown.code).toBe(EXIT_ERROR);
    expect(unknown.err).toContain('Unknown element "ZZZ"');
  });
});

describe("--version and --help", () => {
  it("prints the package.json version", () => {
    expect(exec(["--version"])).toMatchObject({ code: EXIT_OK, out: pkg("../package.json").version });
  });

  it("prints usage on stdout and exits 0", () => {
    const r = exec(["context", "--help"]);
    expect(r.code).toBe(EXIT_OK);
    expect(r.out).toContain("usage: docdive");
  });
});

describe("index --out", () => {
  it("writes index.json to --out and leaves the docs folder untouched", () => {
    const folder = docs();
    const out = join(tmp(), "nested", "out");
    const r = exec(["index", folder, "--out", out]);
    expect(r.code).toBe(EXIT_OK);
    expect(readdirSync(folder)).toEqual(["a.md"]);
    expect(Object.keys(JSON.parse(readFileSync(join(out, "index.json"), "utf8")).elements)).toContain("A");
    expect(r.err).toContain("indexed");
  });

  it("prints the JSON on stdout when --out is omitted and keeps diagnostics on stderr", () => {
    const r = exec(["index", docs()]);
    expect(JSON.parse(r.out).elements.A).toBeDefined();
    expect(r.err).toContain("indexed");
    expect(r.err).not.toContain("{");
  });
});

describe("build", () => {
  it("writes index.json, contexts.json and the element assets", () => {
    const out = join(tmp(), "dist");
    const r = exec(["build", docs(), "--out", out]);
    expect(r.code).toBe(EXIT_OK);
    const files = readdirSync(out);
    expect(files).toEqual(expect.arrayContaining(["index.json", "contexts.json", "docdive-element.js"]));
    const contexts = JSON.parse(readFileSync(join(out, "contexts.json"), "utf8")) as Record<string, string>;
    expect(contexts.A).toContain("# Context: A");
  });
});

describe("context", () => {
  it("prints the same markdown that contexts.json carries", () => {
    const folder = docs();
    const single = exec(["context", "A", "--folder", folder]).out;
    const all = JSON.parse(exec(["context", "--all", "--folder", folder]).out) as Record<string, string>;
    expect(single).toBe(all.A);
  });
});

describe("package bins", () => {
  it("ddv aliases docdive", () => {
    const { bin } = pkg("../package.json") as { bin: Record<string, string> };
    expect(bin.ddv).toBe(bin.docdive);
  });
});
