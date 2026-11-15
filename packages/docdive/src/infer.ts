import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { Doc } from "./loader.js";

export interface DocMeta {
  id: string;
  explicit: boolean;
}

const INDEX_NAME = /^(_index|index|readme)$/i;
const stem = (path: string) => basename(path).replace(/\.mdx?$/, "");
const slugify = (text: string) => text.trim().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");

function h1(doc: Doc): string | null {
  let fenced = false;
  for (const line of doc.body.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    else if (!fenced && /^#\s+\S/.test(line)) return line.replace(/^#\s+/, "");
  }
  return null;
}

function candidateId(doc: Doc): string {
  const name = stem(doc.path);
  if (!INDEX_NAME.test(name)) return name;
  const dir = basename(dirname(doc.path));
  if (dir && dir !== ".") return dir;
  const title = h1(doc) ?? (doc.frontmatter.title ? String(doc.frontmatter.title) : null);
  return (title && slugify(title)) || name;
}

const SSG_CONFIG = /^(docusaurus\.config\.\w+|mkdocs\.ya?ml)$/;

/** True when a Docusaurus or MkDocs config sits in `folder` or an ancestor (the search stops at the repo root). */
export function detectSsg(folder: string): boolean {
  for (let dir = resolve(folder); ; dir = dirname(dir)) {
    try {
      if (readdirSync(dir).some((name) => SSG_CONFIG.test(name))) return true;
    } catch {
      return false;
    }
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return false;
  }
}

export interface InferOptions {
  /** Frontmatter `id` belongs to an SSG (doc slug), not to the element model. */
  ssg?: boolean;
}

/** Element id per non-scenario doc: frontmatter `id`, else filename (folder name for index docs, H1/title at the root). */
export function inferDocIds(docs: Doc[], options: InferOptions = {}): Map<Doc, DocMeta> {
  const metas = new Map<Doc, DocMeta>();
  const explicitIds = new Set<string>();
  for (const doc of docs) {
    if (doc.frontmatter.kind === "scenario") continue;
    if (doc.frontmatter.id && !options.ssg) {
      const id = String(doc.frontmatter.id);
      explicitIds.add(id);
      metas.set(doc, { id, explicit: true });
    }
  }
  const byCandidate = new Map<string, Doc[]>();
  for (const doc of docs) {
    if (doc.frontmatter.kind === "scenario" || metas.has(doc)) continue;
    const id = options.ssg && doc.frontmatter.id ? String(doc.frontmatter.id) : candidateId(doc);
    byCandidate.set(id, [...(byCandidate.get(id) ?? []), doc]);
  }
  for (const [id, group] of byCandidate) {
    const clash = group.length > 1 || explicitIds.has(id);
    for (const doc of group) {
      metas.set(doc, { id: clash ? doc.path.replace(/\.mdx?$/, "") : id, explicit: false });
    }
  }
  return metas;
}

/** Nearest ancestor folder index doc (`_index`, `index`, `README`), skipping the doc itself. */
export function findParentDoc(doc: Doc, docs: Doc[]): Doc | null {
  const indexByDir = new Map<string, Doc>();
  for (const d of docs) {
    if (INDEX_NAME.test(stem(d.path)) && !indexByDir.has(dirname(d.path))) indexByDir.set(dirname(d.path), d);
  }
  let dir = dirname(doc.path);
  for (;;) {
    const idx = indexByDir.get(dir);
    if (idx && idx !== doc) return idx;
    if (dir === ".") return null;
    dir = dirname(dir);
  }
}
