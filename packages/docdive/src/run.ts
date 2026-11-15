import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, watch as fsWatch, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { buildModel, type Index } from "./model.js";
import { buildReport, renderReportMarkdown } from "./report.js";
import { lint } from "./lint.js";
import { applyFixes } from "./fix.js";
import { floorStats } from "./floor.js";
import { buildContext, renderAllContexts, renderContextMarkdown } from "./context.js";

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  /** Stops a long-running command (`watch`); the process entry point aborts it on SIGINT/SIGTERM. */
  signal?: AbortSignal;
}

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;

export const USAGE = `usage: docdive <command> [options]

commands:
  index <folder> [--out <dir>] [--src <repoRoot>]   write <dir>/index.json (stdout when --out is omitted)
  build <folder> --out <dir> [--src <repoRoot>]     write index.json, contexts.json and the <docdive-diagram> assets
  watch <folder> --out <dir> [--src <repoRoot>]     build, then rebuild index.json and contexts.json on every Markdown change
  init <folder> [--json] [--src <repoRoot>]
  context <elementId> --folder <folder> [--json]
  context --all --folder <folder>                   JSON map { elementId: markdown }
  stats [--json] [--root <repo>] [--docs <folder>]
  lint [--json] [--fix] [--root <repo>] [--docs <folder>]   docs default: <root>/docs

options:
  -h, --help       show this help
  -v, --version    show the version

exit codes: 0 ok, 1 errors in the docs or the lint, 2 usage error`;

class UsageError extends Error {}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

export function readVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
  return pkg.version;
}

function parse<const T extends ParseArgsOptionsConfig>(args: string[], options: T, positionals: number) {
  try {
    const { values, positionals: pos } = parseArgs({ args, options, allowPositionals: true, strict: true });
    if (pos.length > positionals) throw new UsageError(`unexpected argument "${pos[positionals]}"`);
    return { values, pos };
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError((e as Error).message);
  }
}

function summarise(index: Index): string {
  return (
    `indexed ${Object.keys(index.elements).length} elements, ${index.diagrams.length} diagrams, ` +
    `${Object.keys(index.scenarios).length} scenarios, ${index.diagnostics.length} diagnostics; ` +
    `blocks: ${index.stats.byStatus.supported} supported, ${index.stats.byStatus["unsupported-type"]} unsupported-type, ` +
    `${index.stats.byStatus["parse-failed"]} parse-failed`
  );
}

function elementDist(): string {
  return join(dirname(fileURLToPath(import.meta.resolve("docdive-element/package.json"))), "dist");
}

function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function writeOutputs(index: Index, root: string, dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeAtomic(join(dir, "index.json"), JSON.stringify(sortKeys(index), null, 2) + "\n");
  writeAtomic(join(dir, "contexts.json"), JSON.stringify(renderAllContexts(index, root), null, 2) + "\n");
}

function copyAssets(dir: string): void {
  cpSync(elementDist(), dir, { recursive: true, filter: (src) => !/[\\/]shared\.(js|d\.ts)$/.test(src) });
}

function requireFolder(path: string): string {
  const abs = resolve(path);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) throw new Error(`folder not found: ${path}`);
  return abs;
}

const WATCH_DEBOUNCE_MS = 100;

function watchDocs(rest: string[], io: Io): Promise<number> {
  const { values, pos } = parse(rest, { out: { type: "string" }, src: { type: "string" } }, 1);
  if (!pos[0]) throw new UsageError("watch: missing <folder>");
  if (typeof values.out !== "string") throw new UsageError("watch: missing --out <dir>");
  const root = requireFolder(pos[0]);
  const dir = resolve(values.out);
  const srcRoot = typeof values.src === "string" ? resolve(values.src) : undefined;

  const rebuild = (): Index => {
    const index = buildModel(root, root, { srcRoot });
    writeOutputs(index, root, dir);
    return index;
  };
  const stamp = () => new Date().toLocaleTimeString("en-GB");

  const initial = rebuild();
  copyAssets(dir);
  io.err(`[${stamp()}] watching ${pos[0]}: ${summarise(initial)}`);

  return new Promise<number>((resolveRun) => {
    const changed = new Set<string>();
    let timer: NodeJS.Timeout | undefined;

    const finish = (code: number, message?: string) => {
      clearTimeout(timer);
      watcher.close();
      io.signal?.removeEventListener("abort", onAbort);
      if (message) io.err(`docdive: ${message}`);
      resolveRun(code);
    };
    const onAbort = () => finish(EXIT_OK);
    const folderGone = () => !existsSync(root) || !statSync(root).isDirectory();

    const flush = () => {
      const files = [...changed].sort().join(", ");
      changed.clear();
      if (folderGone()) return finish(EXIT_ERROR, `folder disappeared: ${pos[0]}`);
      try {
        io.err(`[${stamp()}] ${files}: ${summarise(rebuild())}`);
      } catch (e) {
        if (folderGone()) return finish(EXIT_ERROR, `folder disappeared: ${pos[0]}`);
        io.err(`docdive: rebuild failed: ${(e as Error).message}`);
      }
    };

    const watcher = fsWatch(root, { recursive: true }, (_event, filename) => {
      if (folderGone()) return finish(EXIT_ERROR, `folder disappeared: ${pos[0]}`);
      if (!filename || !/\.mdx?$/.test(filename)) return;
      const rel = relative(root, resolve(root, filename));
      if (relative(dir, resolve(root, filename)).split(sep)[0] !== "..") return;
      changed.add(rel);
      clearTimeout(timer);
      timer = setTimeout(flush, WATCH_DEBOUNCE_MS);
    });
    watcher.on("error", (e) => finish(EXIT_ERROR, e.message));

    if (io.signal?.aborted) onAbort();
    else io.signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function execute(command: string, rest: string[], io: Io): number | Promise<number> {
  if (command === "index") {
    const { values, pos } = parse(rest, { out: { type: "string" }, src: { type: "string" } }, 1);
    if (!pos[0]) throw new UsageError("index: missing <folder>");
    const root = requireFolder(pos[0]);
    const srcRoot = typeof values.src === "string" ? resolve(values.src) : undefined;
    const index = buildModel(root, root, { srcRoot });
    const json = JSON.stringify(sortKeys(index), null, 2) + "\n";
    if (typeof values.out === "string") {
      const dir = resolve(values.out);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "index.json"), json);
    } else io.out(json.trimEnd());
    io.err(summarise(index));
    return EXIT_OK;
  }

  if (command === "build") {
    const { values, pos } = parse(rest, { out: { type: "string" }, src: { type: "string" } }, 1);
    if (!pos[0]) throw new UsageError("build: missing <folder>");
    if (typeof values.out !== "string") throw new UsageError("build: missing --out <dir>");
    const root = requireFolder(pos[0]);
    const srcRoot = typeof values.src === "string" ? resolve(values.src) : undefined;
    const index = buildModel(root, root, { srcRoot });
    const dir = resolve(values.out);
    writeOutputs(index, root, dir);
    copyAssets(dir);
    io.err(summarise(index));
    return EXIT_OK;
  }

  if (command === "watch") return watchDocs(rest, io);

  if (command === "init") {
    const { values, pos } = parse(rest, { json: { type: "boolean" }, src: { type: "string" } }, 1);
    if (!pos[0]) throw new UsageError("init: missing <folder>");
    const root = requireFolder(pos[0]);
    const srcRoot = typeof values.src === "string" ? resolve(values.src) : undefined;
    const report = buildReport(buildModel(root, root, { srcRoot }), pos[0], srcRoot !== undefined);
    io.out(values.json ? JSON.stringify(sortKeys(report), null, 2) : renderReportMarkdown(report));
    return EXIT_OK;
  }

  if (command === "context") {
    const { values, pos } = parse(rest, { all: { type: "boolean" }, json: { type: "boolean" }, folder: { type: "string" } }, 1);
    if (typeof values.folder !== "string") throw new UsageError("context: missing --folder <folder>");
    const root = requireFolder(values.folder);
    if (values.all) {
      io.out(JSON.stringify(renderAllContexts(buildModel(root, root), root), null, 2));
      return EXIT_OK;
    }
    if (!pos[0]) throw new UsageError("context: missing <elementId> (or --all)");
    const bundle = buildContext(buildModel(root, root), root, pos[0]);
    io.out(values.json ? JSON.stringify(sortKeys(bundle), null, 2) : renderContextMarkdown(bundle));
    return EXIT_OK;
  }

  if (command === "stats") {
    const { values } = parse(rest, { json: { type: "boolean" }, root: { type: "string" }, docs: { type: "string" } }, 0);
    const root = resolve(typeof values.root === "string" ? values.root : ".");
    const docs = requireFolder(typeof values.docs === "string" ? values.docs : join(root, "docs"));
    const stats = floorStats(docs, root);
    io.out(values.json ? JSON.stringify(sortKeys(stats), null, 2) : JSON.stringify(stats));
    return EXIT_OK;
  }

  if (command === "lint") {
    const { values } = parse(
      rest,
      { json: { type: "boolean" }, fix: { type: "boolean" }, root: { type: "string" }, docs: { type: "string" } },
      0,
    );
    const root = resolve(typeof values.root === "string" ? values.root : ".");
    const docs = requireFolder(typeof values.docs === "string" ? values.docs : join(root, "docs"));
    const fixed = values.fix ? applyFixes(docs, root) : undefined;
    const result = lint(docs, root);
    if (values.json) io.out(JSON.stringify(sortKeys(fixed ? { ...result, fixed } : result), null, 2));
    else {
      for (const f of fixed ?? []) io.out(`fixed ${f.rule} ${f.file}: ${f.from} -> ${f.to}`);
      for (const e of result.errors) io.out(`error ${e.rule} ${e.file}: ${e.message ?? ""}`);
      io.out(`${result.errors.length} errors, ${result.warnings.length} warnings`);
    }
    return result.errors.length ? EXIT_ERROR : EXIT_OK;
  }

  throw new UsageError(`unknown command "${command}"`);
}

export function run(argv: string[], io: Io): number | Promise<number> {
  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h" || rest.includes("--help") || rest.includes("-h")) {
    io.out(USAGE);
    return EXIT_OK;
  }
  if (command === "--version" || command === "-v") {
    io.out(readVersion());
    return EXIT_OK;
  }
  const fail = (e: unknown): number => {
    const message = (e as Error).message;
    if (e instanceof UsageError) {
      io.err(`docdive: ${message}\n\n${USAGE}`);
      return EXIT_USAGE;
    }
    io.err(`docdive: ${message}`);
    return EXIT_ERROR;
  };
  try {
    if (!command) throw new UsageError("missing command");
    const result = execute(command, rest, io);
    return typeof result === "number" ? result : result.catch(fail);
  } catch (e) {
    return fail(e);
  }
}
