import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  if (typeof code !== "number") throw new Error("exec: command is asynchronous");
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const pkg = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Record<string, unknown>;

describe("usage errors", () => {
  it.each([
    [[], "missing command"],
    [["bogus"], 'unknown command "bogus"'],
    [["index"], "missing <folder>"],
    [["build", "x"], "missing --out"],
    [["watch"], "missing <folder>"],
    [["watch", "x"], "missing --out"],
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

const page = (id: string, label: string) => `---\nid: ${id}\n---\n\`\`\`mermaid\nflowchart LR\n  P[${label}] --> Q[End]\n\`\`\`\n`;

describe("watch", () => {
  const stops: (() => Promise<number>)[] = [];
  afterEach(async () => {
    await Promise.all(stops.splice(0).map((stop) => stop()));
  });

  function start(folder: string, out: string) {
    const err: string[] = [];
    const controller = new AbortController();
    const done = run(["watch", folder, "--out", out], { out: () => {}, err: (l) => err.push(l), signal: controller.signal });
    if (typeof done === "number") throw new Error("watch must be asynchronous");
    const stop = () => {
      controller.abort();
      return done;
    };
    stops.push(stop);
    const rebuilds = () => err.filter((l) => /\.mdx?: indexed/.test(l));
    return { done, err, rebuilds, stop };
  }

  const read = (out: string, file: string) => readFileSync(join(out, file), "utf8");
  const until = (check: () => void) => vi.waitFor(check, { timeout: 4000, interval: 25 });

  it("builds once at start, then follows edits, additions and deletions", async () => {
    const folder = docs();
    const out = join(tmp(), "out");
    const watcher = start(folder, out);
    await until(() => expect(existsSync(join(out, "contexts.json"))).toBe(true));
    expect(read(out, "index.json")).toContain("Alpha");
    expect(readdirSync(out).some((f) => f.endsWith(".js"))).toBe(true);

    writeFileSync(join(folder, "a.md"), page("A", "Gamma"));
    await until(() => expect(read(out, "index.json")).toContain("Gamma"));

    writeFileSync(join(folder, "b.md"), page("B", "Delta"));
    await until(() => expect(JSON.parse(read(out, "contexts.json"))).toHaveProperty("B"));

    unlinkSync(join(folder, "b.md"));
    await until(() => expect(JSON.parse(read(out, "contexts.json"))).not.toHaveProperty("B"));

    expect(await watcher.stop()).toBe(EXIT_OK);
  });

  it("ignores non-Markdown changes and its own outputs when --out is inside the docs folder", async () => {
    const folder = docs();
    const out = join(folder, "out");
    const watcher = start(folder, out);
    await until(() => expect(existsSync(join(out, "index.json"))).toBe(true));

    writeFileSync(join(folder, "notes.txt"), "not markdown");
    writeFileSync(join(folder, "a.md"), page("A", "Gamma"));
    await until(() => expect(read(out, "index.json")).toContain("Gamma"));
    writeFileSync(join(folder, "a.md"), page("A", "Omega"));
    await until(() => expect(read(out, "index.json")).toContain("Omega"));

    expect(watcher.rebuilds()).toHaveLength(2);
    expect(watcher.err.join("\n")).not.toContain("notes.txt");
    await watcher.stop();
  });

  it("exits 1 when the docs folder disappears", async () => {
    const folder = docs();
    const out = join(tmp(), "out");
    const watcher = start(folder, out);
    await until(() => expect(existsSync(join(out, "index.json"))).toBe(true));

    rmSync(folder, { recursive: true });
    expect(await watcher.done).toBe(EXIT_ERROR);
    expect(watcher.err.join("\n")).toContain("folder disappeared");
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
