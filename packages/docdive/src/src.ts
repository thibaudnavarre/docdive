import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

export interface SrcHit {
  path: string;
  confidence: number;
  via: "file" | "stem" | "dir" | "definition";
}

const CODE_EXT = new Set([".rb", ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".java", ".rs", ".cs", ".php", ".vue"]);
const SKIP_DIR = new Set(["node_modules", ".git", "vendor", "tmp", "log"]);
const MAX_FILE_BYTES = 1_000_000;
const MAX_HITS = 3;

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const lastSegment = (id: string) => id.split(/::|\/|\./).filter(Boolean).pop() ?? id;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (SKIP_DIR.has(name)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
}

/** Paths relative to `root`. A git root lists the pinned commit's tree, so it works on sparse checkouts. */
function listFiles(root: string): string[] {
  if (existsSync(join(root, ".git"))) {
    const out = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "HEAD"], {
      encoding: "utf8",
      maxBuffer: 1 << 28,
    });
    return out.split("\n").filter(Boolean);
  }
  const files: string[] = [];
  walk(root, files);
  return files.map((f) => relative(root, f));
}

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => map.set(key, [...(map.get(key) ?? []), value]);

export function inferSrc(
  elements: Record<string, { src: string[]; srcInferred?: SrcHit[] }>,
  root: string,
): void {
  const files = listFiles(root).filter((f) => CODE_EXT.has(extname(f)));
  const byStem = new Map<string, string[]>();
  const byDir = new Map<string, string[]>();
  const dirs = new Set<string>();
  for (const f of files) {
    push(byStem, normalise(lastSegment(f.slice(0, -extname(f).length).split("/").pop()!)), f);
    for (let d = dirname(f); d !== "." && !dirs.has(d); d = dirname(d)) dirs.add(d);
  }
  for (const d of dirs) push(byDir, normalise(d.split("/").pop()!), d);

  // Definitions can only be read for files that are actually checked out.
  const definitions = new Map<string, string[]>();
  const DEF = /^\s*(?:class|module|def)\s+(?:self\.)?([A-Za-z_][\w:]*)/gm;
  for (const f of files) {
    const full = join(root, f);
    if (!existsSync(full) || statSync(full).size > MAX_FILE_BYTES) continue;
    for (const m of readFileSync(full, "utf8").matchAll(DEF)) push(definitions, normalise(lastSegment(m[1])), f);
  }

  for (const [id, el] of Object.entries(elements)) {
    const key = normalise(id);
    const leaf = normalise(lastSegment(id));
    if (el.src.length || key.length < 4 || leaf.length < 4) continue;
    const hits = new Map<string, SrcHit>();
    const add = (path: string, confidence: number, via: SrcHit["via"]) => {
      if ((hits.get(path)?.confidence ?? 0) < confidence) hits.set(path, { path, confidence, via });
    };
    for (const f of byStem.get(leaf) ?? []) {
      const pathKey = normalise(f.slice(0, -extname(f).length));
      if (key !== leaf && pathKey.endsWith(key)) add(f, 0.85, "file");
      else if (key === leaf) add(f, 0.7, "stem");
    }
    for (const d of byDir.get(key) ?? []) add(`${d}/`, 0.5, "dir");
    for (const f of definitions.get(leaf) ?? []) add(f, 0.6, "definition");
    const top = [...hits.values()].sort((a, b) => b.confidence - a.confidence || a.path.localeCompare(b.path)).slice(0, MAX_HITS);
    if (top.length) el.srcInferred = top;
  }
}
