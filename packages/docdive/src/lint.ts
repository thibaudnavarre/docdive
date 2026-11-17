import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadDocs, type Doc } from "./loader.js";
import { asStringArray, buildModel, resolveParticipant, type Diagnostic, type Index } from "./model.js";
import { nearMiss, normalise } from "./fuzzy.js";

export interface LintResult {
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Abbreviation: `OrderSvc` for `OrderService` (same first letter, subsequence, ≥ 60 % of the length). */
export function isAbbreviation(short: string, long: string): boolean {
  const s = normalise(short);
  const l = normalise(long);
  if (s.length < 4 || s.length >= l.length || s[0] !== l[0] || s.length / l.length < 0.6) return false;
  let i = 0;
  for (const c of l) if (c === s[i]) i++;
  return i === s.length;
}

const sameThing = (a: string, b: string) => !!nearMiss(a, b) || isAbbreviation(a, b);

/** E1: a scenario participant that is not anchored but is a near-miss of a documented or parented ID. */
export function lintUnresolvedParticipants(index: Index): Diagnostic[] {
  const targets = Object.entries(index.elements)
    .filter(([, el]) => el.doc || el.parent)
    .map(([id]) => id)
    .sort();
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const d of index.diagrams) {
    if (d.type !== "sequence") continue;
    const file = d.id.replace(/#\d+$/, "");
    for (const p of d.nodes) {
      if (seen.has(`${file}|${p}`) || resolveParticipant(index, p)) continue;
      const q = targets.find((t) => t !== p && sameThing(p, t));
      if (!q) continue;
      seen.add(`${file}|${p}`);
      out.push({
        rule: "unresolved-participant",
        file,
        diagram: d.id,
        participant: p,
        suggestion: q,
        message: `participant "${p}" looks like "${q}" but matches no documented element`,
      });
    }
  }
  return out;
}

/** E2: sibling docs (same `parent`) that declare the same explicit `id`. */
export function lintDuplicateIds(docs: Doc[]): Diagnostic[] {
  const groups = new Map<string, string[]>();
  for (const doc of docs) {
    const id = str(doc.frontmatter.id);
    if (!id) continue;
    const key = `${str(doc.frontmatter.parent) ?? ""}\u0000${id}`;
    groups.set(key, [...(groups.get(key) ?? []), doc.path]);
  }
  const out: Diagnostic[] = [];
  for (const [key, files] of groups) {
    if (files.length < 2) continue;
    const [parent, id] = key.split("\u0000");
    for (const file of files) {
      out.push({
        rule: "duplicate-id-siblings",
        file,
        id,
        parent: parent || null,
        others: files.filter((f) => f !== file),
        message: `id "${id}" is declared by ${files.length} sibling docs`,
      });
    }
  }
  return out;
}

/** E3: `parent:` that is not the explicit `id` of any doc. */
export function lintMissingParents(docs: Doc[]): Diagnostic[] {
  const ids = new Set(docs.map((d) => str(d.frontmatter.id)).filter((id): id is string => id !== null));
  const out: Diagnostic[] = [];
  for (const doc of docs) {
    const parent = str(doc.frontmatter.parent);
    if (!parent || ids.has(parent)) continue;
    const candidates = [...ids].sort().filter((id) => nearMiss(parent, id));
    out.push({
      rule: "missing-parent",
      file: doc.path,
      parent,
      ...(candidates.length === 1 && { suggestion: candidates[0] }),
      message: `parent "${parent}" is not the id of any doc`,
    });
  }
  return out;
}

/** E4: `src:` path that does not exist under the repo root. */
export function lintMissingSrc(docs: Doc[], repoRoot: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const doc of docs) {
    for (const path of asStringArray(doc.frontmatter.src)) {
      if (existsSync(join(repoRoot, path))) continue;
      out.push({ rule: "missing-src", file: doc.path, src: path, message: `src path "${path}" does not exist` });
    }
  }
  return out;
}

export function lint(docsFolder: string, repoRoot: string): LintResult {
  const docs = loadDocs(docsFolder);
  const index = buildModel(docs);
  return {
    errors: [
      ...lintUnresolvedParticipants(index),
      ...lintDuplicateIds(docs),
      ...lintMissingParents(docs),
      ...lintMissingSrc(docs, repoRoot),
    ],
    warnings: index.diagnostics,
  };
}
