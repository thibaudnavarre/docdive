import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lint, type LintResult } from "./lint.js";
import { loadDocs } from "./loader.js";
import { buildModel } from "./model.js";

export interface Fix {
  rule: "missing-parent" | "fuzzy-id-candidate";
  file: string;
  from: string;
  to: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const idPattern = (id: string) => new RegExp(`(?<![\\w-])${escape(id)}(?![\\w-])`, "g");

/** Renames an ID in frontmatter `id:`/`parent:` values and inside mermaid fences; prose is untouched. */
function renameInDoc(raw: string, bodyOffset: number, from: string, to: string): string {
  const re = idPattern(from);
  let inMermaid = false;
  return raw
    .split("\n")
    .map((line, i) => {
      if (i < bodyOffset) return /^(id|parent):/.test(line) ? line.replace(re, to) : line;
      if (/^[ \t]*```mermaid\s*$/.test(line)) inMermaid = true;
      else if (inMermaid && /^[ \t]*```\s*$/.test(line)) inMermaid = false;
      else if (inMermaid) return line.replace(re, to);
      return line;
    })
    .join("\n");
}

/** Renames drop the ID with fewer appearances (ties: keep the alphabetically first) and resolve chains. */
function planRenames(result: LintResult, appearances: Map<string, number>): Map<string, string> {
  const renames = new Map<string, string>();
  for (const w of result.warnings) {
    if (w.rule !== "fuzzy-id-candidate" || w.kind !== "normalized") continue;
    const [a, b] = [String(w.a), String(w.b)];
    const [keep, drop] =
      (appearances.get(a) ?? 0) > (appearances.get(b) ?? 0) || ((appearances.get(a) ?? 0) === (appearances.get(b) ?? 0) && a < b)
        ? [a, b]
        : [b, a];
    renames.set(drop, keep);
  }
  for (const [from, to] of renames) {
    let target = to;
    while (renames.has(target) && target !== from) target = renames.get(target)!;
    renames.set(from, target);
  }
  return renames;
}

/** Mechanical, in-place fixes: missing parent → single closest doc id; normalized near-duplicate IDs → the more used one. */
export function applyFixes(docsFolder: string, repoRoot: string): Fix[] {
  const before = lint(docsFolder, repoRoot);
  const docs = loadDocs(docsFolder, repoRoot);
  const fixes: Fix[] = [];
  const text = new Map(docs.map((d) => [d.path, readFileSync(join(repoRoot, d.path), "utf8")]));
  const offsets = new Map(docs.map((d) => [d.path, d.bodyOffset]));

  for (const e of before.errors) {
    if (e.rule !== "missing-parent" || typeof e.suggestion !== "string") continue;
    const file = e.file;
    const raw = text.get(file)!;
    const lines = raw.split("\n");
    const offset = offsets.get(file)!;
    const re = new RegExp(`^(parent:\\s*)(['"]?)${escape(String(e.parent))}\\2\\s*$`);
    const i = lines.slice(0, offset).findIndex((l) => re.test(l));
    if (i < 0) continue;
    lines[i] = lines[i].replace(re, `$1$2${e.suggestion}$2`);
    text.set(file, lines.join("\n"));
    fixes.push({ rule: "missing-parent", file, from: String(e.parent), to: e.suggestion });
  }

  const elements = buildModel(docsFolder, repoRoot).elements;
  const appearances = new Map(Object.entries(elements).map(([id, el]) => [id, el.appearsIn.length]));
  for (const [from, to] of planRenames(before, appearances)) {
    for (const [file, raw] of text) {
      const next = renameInDoc(raw, offsets.get(file)!, from, to);
      if (next === raw) continue;
      text.set(file, next);
      fixes.push({ rule: "fuzzy-id-candidate", file, from, to });
    }
  }

  const changed = new Set(fixes.map((f) => f.file));
  for (const file of changed) writeFileSync(join(repoRoot, file), text.get(file)!);
  return fixes;
}
