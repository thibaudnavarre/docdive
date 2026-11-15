import type { Doc } from "./loader.js";

export interface Prose {
  file: string;
  line: number;
  heading: string;
  excerpt: string;
  confidence: number;
}

interface Section {
  heading: string;
  startLine: number;
  endLine: number;
  paragraphs: { line: number; text: string }[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const plain = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function sectionsOf(doc: Doc): Section[] {
  const lines = doc.body.split("\n");
  const abs = (i: number) => doc.bodyOffset + i + 1;
  const sections: Section[] = [];
  let current: Section = { heading: "", startLine: abs(0), endLine: abs(0), paragraphs: [] };
  let fence: { char: string; len: number } | null = null;
  let para: { line: number; text: string[] } | null = null;
  const flush = () => {
    if (para) current.paragraphs.push({ line: para.line, text: para.text.join(" ") });
    para = null;
  };
  lines.forEach((line, i) => {
    const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    const heading = !fence && /^#{1,6}\s+\S/.exec(line);
    if (marker && !fence) {
      flush();
      fence = { char: marker[1][0], len: marker[1].length };
    } else if (marker && fence && marker[1][0] === fence.char && marker[1].length >= fence.len && !marker[2].trim()) {
      fence = null;
    } else if (heading) {
      flush();
      current.endLine = abs(i) - 1;
      sections.push(current);
      current = { heading: line.replace(/^#+\s+/, "").trim(), startLine: abs(i), endLine: abs(i), paragraphs: [] };
    } else if (!fence && line.trim()) {
      (para ??= { line: abs(i), text: [] }).text.push(line.trim());
    } else if (!fence) {
      flush();
    }
  });
  flush();
  current.endLine = abs(lines.length - 1);
  sections.push(current);
  return sections;
}

/** For each element without a doc, attaches the nearest section (in the docs where it appears) that mentions its ID or label. */
export function attachProse(
  elements: Record<string, { doc: string | null; appearsIn: string[]; prose?: Prose }>,
  labels: Record<string, string>,
  docs: Doc[],
  diagramLines: Map<string, number>,
): void {
  const docByPath = new Map(docs.map((d) => [d.path, d]));
  const sectionCache = new Map<string, Section[]>();
  const sectionsFor = (doc: Doc) => {
    let s = sectionCache.get(doc.path);
    if (!s) sectionCache.set(doc.path, (s = sectionsOf(doc)));
    return s;
  };

  for (const [id, el] of Object.entries(elements)) {
    if (el.doc) continue;
    const idRe = id.length >= 3 ? new RegExp(`(?<![\\w-])${escapeRe(id)}(?![\\w-])`) : null;
    const label = plain(labels[id] ?? "").toLowerCase();
    const useLabel = label.length >= 4 && label !== id.toLowerCase();
    if (!idRe && !useLabel) continue;

    let best: { prose: Prose; score: number; distance: number } | null = null;
    for (const diagramId of el.appearsIn) {
      const path = diagramId.slice(0, diagramId.lastIndexOf("#"));
      const doc = docByPath.get(path);
      const diagramLine = diagramLines.get(diagramId);
      if (!doc || diagramLine === undefined) continue;
      for (const section of sectionsFor(doc)) {
        const hit = section.paragraphs.find((p) => idRe?.test(p.text));
        const labelHit = hit ? undefined : useLabel ? section.paragraphs.find((p) => p.text.toLowerCase().includes(label)) : undefined;
        const para = hit ?? labelHit;
        if (!para) continue;
        const inSection = diagramLine >= section.startLine && diagramLine <= section.endLine;
        const confidence = (hit ? 0.5 : 0.4) + (inSection ? 0.1 : 0);
        const distance = Math.abs(para.line - diagramLine);
        if (!best || confidence > best.score || (confidence === best.score && distance < best.distance)) {
          best = {
            score: confidence,
            distance,
            prose: {
              file: doc.path,
              line: para.line,
              heading: section.heading,
              excerpt: para.text.length > 400 ? `${para.text.slice(0, 400)}…` : para.text,
              confidence,
            },
          };
        }
      }
    }
    if (best) el.prose = best.prose;
  }
}
