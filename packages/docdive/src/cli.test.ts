import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
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
    "---\nid: A\n---\n```mermaid\nflowchart LR\n  Alpha --> Beta\n```\n",
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
    [["build"], "missing <folder>"],
    [["build", "x"], "missing --out"],
    [["watch", "x"], "missing --out"],
    [["lint"], "missing <folder>"],
    [["lint", "x", "--nope"], "Unknown option"],
  ])("%j exits 2 with usage on stderr", (args, message) => {
    const r = exec(args);
    expect(r.code).toBe(EXIT_USAGE);
    expect(r.out).toBe("");
    expect(r.err).toContain(message);
    expect(r.err).toContain("usage: docdive");
  });

  it("exits 1 for a missing folder, with no usage text", () => {
    const missing = exec(["lint", join(tmp(), "nope")]);
    expect(missing.code).toBe(EXIT_ERROR);
    expect(missing.err).toContain("folder not found");
    expect(missing.err).not.toContain("usage:");
  });
});

describe("--version and --help", () => {
  it("prints the package.json version", () => {
    expect(exec(["--version"])).toMatchObject({ code: EXIT_OK, out: pkg("../package.json").version });
  });

  it("prints usage on stdout and exits 0", () => {
    const r = exec(["build", "--help"]);
    expect(r.code).toBe(EXIT_OK);
    expect(r.out).toContain("usage: docdive");
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

  it("copies the src and entities files found under --root, skipping directories, missing and outside paths", () => {
    const repo = tmp();
    mkdirSync(join(repo, "docs"));
    mkdirSync(join(repo, "src", "orders"), { recursive: true });
    writeFileSync(join(repo, "src", "orders", "order.ts"), "export type Order = { id: number };\n");
    writeFileSync(join(repo, "src", "orders", "service.ts"), "");
    writeFileSync(
      join(repo, "docs", "a.md"),
      "---\nid: A\nsrc: [src/orders/, src/orders/service.ts, src/nope.ts, ../outside.ts]\nentities:\n  Order: [src/orders/order.ts]\n---\n```mermaid\nflowchart LR\n  Alpha --> Beta\n```\n",
    );
    const out = join(repo, "dist");
    expect(exec(["build", join(repo, "docs"), "--out", out, "--root", repo]).code).toBe(EXIT_OK);
    const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8")) as { files: string[] };
    expect(index.files).toEqual(["src/orders/order.ts", "src/orders/service.ts"]);
    expect(readFileSync(join(out, "src", "src", "orders", "order.ts"), "utf8")).toContain("Order");
    expect(existsSync(join(out, "src", "src", "nope.ts"))).toBe(false);
  });
});

describe("lint", () => {
  it("prints errors and exits 1, then exits 0 once fixed", () => {
    const folder = docs();
    writeFileSync(join(folder, "b.md"), "---\nid: B\nparent: Nope\n---\n");
    const bad = exec(["lint", folder]);
    expect(bad.code).toBe(EXIT_ERROR);
    expect(bad.out).toContain("error missing-parent b.md");
    writeFileSync(join(folder, "b.md"), "---\nid: B\nparent: A\n---\n");
    expect(exec(["lint", folder, "--json"]).code).toBe(EXIT_OK);
  });
});

const page = (id: string, node: string) => `---\nid: ${id}\n---\n\`\`\`mermaid\nflowchart LR\n  ${node} --> Sink\n\`\`\`\n`;

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

  it("survives a failed initial build and recovers on the next save", async () => {
    const folder = docs();
    // a dangling .md symlink makes the folder walk throw
    symlinkSync(join(folder, "missing.md"), join(folder, "bad.md"));
    const out = join(tmp(), "out");
    const watcher = start(folder, out);
    await until(() => expect(readdirSync(out).some((f) => f.endsWith(".js"))).toBe(true));
    expect(watcher.err.join("\n")).toContain("initial build failed");
    expect(existsSync(join(out, "index.json"))).toBe(false);

    unlinkSync(join(folder, "bad.md"));
    writeFileSync(join(folder, "a.md"), page("A", "Gamma"));
    await until(() => expect(read(out, "index.json")).toContain("Gamma"));
    expect(await watcher.stop()).toBe(EXIT_OK);
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
