import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

export interface MermaidBlock {
  index: number;
  startLine: number;
  source: string;
  /** First token of the diagram header, e.g. `flowchart`, `sequenceDiagram`, `stateDiagram-v2`. */
  type: string;
}

export interface Doc {
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
  blocks: MermaidBlock[];
}

/** Files docdive reads: Markdown with fenced diagrams, and bare `.mmd` Mermaid files (one diagram each). */
export const DOC_EXT = /\.(mdx?|mmd)$/;

export function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      return DOC_EXT.test(full) ? [full] : [];
    });
}

const dedent = (line: string, indent: number) => line.replace(new RegExp(`^[ \\t]{0,${indent}}`), "");

function diagramType(source: string): string {
  for (const line of source.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("%%")) return t.split(/\s+/)[0];
  }
  return "";
}

function stripBlockFrontmatter(source: string, startLine: number) {
  const lines = source.split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first < 0 || lines[first].trim() !== "---") return { source, startLine };
  const end = lines.findIndex((l, i) => i > first && l.trim() === "---");
  if (end < 0) return { source, startLine };
  return { source: lines.slice(end + 1).join("\n"), startLine: startLine + end + 1 };
}

export function extractBlocks(body: string, lineOffset = 0): MermaidBlock[] {
  const lines = body.split("\n");
  const blocks: MermaidBlock[] = [];
  let current: { startLine: number; indent: number; lines: string[] } | null = null;
  lines.forEach((line, i) => {
    const open = current ? null : /^([ \t]*)```mermaid\s*$/.exec(line);
    if (open) {
      current = { startLine: lineOffset + i + 2, indent: open[1].length, lines: [] };
    } else if (current && /^[ \t]*```\s*$/.test(line)) {
      const stripped = stripBlockFrontmatter(current.lines.join("\n"), current.startLine);
      blocks.push({
        index: blocks.length,
        startLine: stripped.startLine,
        source: stripped.source,
        type: diagramType(stripped.source),
      });
      current = null;
    } else if (current) {
      current.lines.push(dedent(line, current.indent));
    }
  });
  return blocks;
}

export function parseDoc(path: string, raw: string): Doc {
  if (path.endsWith(".mmd")) {
    const { source, startLine } = stripBlockFrontmatter(raw, 1);
    // No prose in a bare diagram file: an empty body keeps the diagram source out of the context bundle.
    return { path, frontmatter: {}, body: "", blocks: [{ index: 0, startLine, source, type: diagramType(source) }] };
  }
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    parsed = { data: {}, content: raw } as matter.GrayMatterFile<string>;
  }
  const bodyOffset = raw.split("\n").length - parsed.content.split("\n").length;
  return { path, frontmatter: parsed.data, body: parsed.content, blocks: extractBlocks(parsed.content, bodyOffset) };
}

/** Docs under `folder`, with paths relative to it. */
export function loadDocs(folder: string): Doc[] {
  return walk(folder).map((file) => parseDoc(relative(folder, file), readFileSync(file, "utf8")));
}
