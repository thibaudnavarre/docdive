import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, watch as fsWatch, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { DOC_EXT, loadDocs, type Doc } from "./loader.js";
import { buildModel, type Index } from "./model.js";
import { lint } from "./lint.js";
import { renderAllContexts } from "./context.js";

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
  build <folder> --out <dir>         write index.json, contexts.json and the <docdive-diagram> assets
  watch <folder> --out <dir>         build, then rebuild index.json and contexts.json on every Markdown change
  lint <folder> [--root <repo>] [--json]   check the model; src paths resolve against --root (default: .)

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

/** Resolves `<folder> --out <dir>` for build/watch. */
function target(command: string, rest: string[]): { root: string; out: string } {
  const { values, pos } = parse(rest, { out: { type: "string" } }, 1);
  if (!pos[0]) throw new UsageError(`${command}: missing <folder>`);
  if (typeof values.out !== "string") throw new UsageError(`${command}: missing --out <dir>`);
  return { root: requireFolder(pos[0]), out: resolve(values.out) };
}

function summarise(index: Index): string {
  return (
    `indexed ${Object.keys(index.elements).length} elements, ${index.diagrams.length} diagrams, ` +
    `${Object.keys(index.scenarios).length} scenarios, ${index.diagnostics.length} diagnostics`
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

function writeOutputs(index: Index, docs: Doc[], dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeAtomic(join(dir, "index.json"), JSON.stringify(sortKeys(index), null, 2) + "\n");
  writeAtomic(join(dir, "contexts.json"), JSON.stringify(renderAllContexts(index, docs), null, 2) + "\n");
}

function copyAssets(dir: string): void {
  cpSync(elementDist(), dir, { recursive: true });
}

function requireFolder(path: string): string {
  const abs = resolve(path);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) throw new Error(`folder not found: ${path}`);
  return abs;
}

const WATCH_DEBOUNCE_MS = 100;

function watchDocs(rest: string[], io: Io): Promise<number> {
  const { root, out: dir } = target("watch", rest);
  const folder = relative(process.cwd(), root) || ".";

  const rebuild = (): Index => {
    const docs = loadDocs(root);
    const index = buildModel(docs);
    writeOutputs(index, docs, dir);
    return index;
  };
  const stamp = () => new Date().toLocaleTimeString("en-GB");

  // A failed first build must not kill the watcher: the next save may fix it.
  let status: string;
  try {
    status = summarise(rebuild());
  } catch (e) {
    status = `initial build failed: ${(e as Error).message}`;
  }
  copyAssets(dir);
  io.err(`[${stamp()}] watching ${folder}: ${status}`);

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
      if (folderGone()) return finish(EXIT_ERROR, `folder disappeared: ${folder}`);
      try {
        io.err(`[${stamp()}] ${files}: ${summarise(rebuild())}`);
      } catch (e) {
        if (folderGone()) return finish(EXIT_ERROR, `folder disappeared: ${folder}`);
        io.err(`docdive: rebuild failed: ${(e as Error).message}`);
      }
    };

    const watcher = fsWatch(root, { recursive: true }, (_event, filename) => {
      if (folderGone()) return finish(EXIT_ERROR, `folder disappeared: ${folder}`);
      if (!filename || !DOC_EXT.test(filename)) return;
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
  if (command === "build") {
    const { root, out } = target("build", rest);
    const docs = loadDocs(root);
    const index = buildModel(docs);
    writeOutputs(index, docs, out);
    copyAssets(out);
    io.err(summarise(index));
    return EXIT_OK;
  }

  if (command === "watch") return watchDocs(rest, io);

  if (command === "lint") {
    const { values, pos } = parse(rest, { json: { type: "boolean" }, root: { type: "string" } }, 1);
    if (!pos[0]) throw new UsageError("lint: missing <folder>");
    const docs = requireFolder(pos[0]);
    const result = lint(docs, resolve(typeof values.root === "string" ? values.root : "."));
    if (values.json) io.out(JSON.stringify(sortKeys(result), null, 2));
    else {
      for (const e of result.errors) io.out(`error ${e.rule} ${e.file}: ${e.message ?? ""}`);
      io.out(`${result.errors.length} errors, ${result.warnings.length} warnings (--json lists them)`);
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
