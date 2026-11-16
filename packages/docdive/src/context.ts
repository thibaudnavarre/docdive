import { loadDocs } from "./loader.js";
import type { Element, Index } from "./model.js";
import type { Prose } from "./prose.js";
import type { SrcHit } from "./src.js";

export interface ContextBundle {
  id: string;
  doc: string | null;
  docBody: string | null;
  parent: string | null;
  children: string[];
  appearsIn: string[];
  scenarios: { id: string; doc: string; inferred?: true; steps: { from: string; to: string; label: string }[] }[];
  src: string[];
  confidence: number;
  prose?: Prose;
  srcInferred?: SrcHit[];
  docInherited?: Element["docInherited"];
  srcInherited?: Element["srcInherited"];
  aliases?: string[];
  description?: string;
  /** Children that are data entities (also listed in `children`). */
  entities?: string[];
}

export function buildContext(index: Index, folder: string, id: string): ContextBundle {
  const el = index.elements[id];
  if (!el) {
    throw new Error(`Unknown element "${id}". Known: ${Object.keys(index.elements).sort().join(", ")}`);
  }
  const docBody = el.doc
    ? (loadDocs(folder, folder).find((d) => d.path === el.doc)?.body.trim() ?? null)
    : null;
  const scenarios = Object.entries(index.scenarios)
    .filter(([, s]) => s.steps.some((st) => st.from === id || st.to === id))
    .map(([sid, s]) => ({
      id: sid,
      doc: s.doc,
      ...(s.inferred && { inferred: true as const }),
      steps: s.steps.map(({ from, to, label }) => ({ from, to, label })),
    }));
  const entities = el.children.filter((c) => index.elements[c]?.kind === "entity");
  return {
    id,
    doc: el.doc,
    docBody,
    parent: el.parent,
    children: el.children,
    appearsIn: el.appearsIn,
    scenarios,
    src: el.src,
    confidence: el.confidence,
    ...(el.prose && { prose: el.prose }),
    ...(el.srcInferred && { srcInferred: el.srcInferred }),
    ...(el.docInherited && { docInherited: el.docInherited }),
    ...(el.srcInherited && { srcInherited: el.srcInherited }),
    ...(el.aliases && { aliases: el.aliases }),
    ...(el.description && { description: el.description }),
    ...(entities.length && { entities }),
  };
}

export function renderContextMarkdown(c: ContextBundle): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)");
  const doc = c.doc ?? (c.docInherited ? `${c.docInherited.path} (inherited from ${c.docInherited.from})` : "(none)");
  const source = [
    ...c.src,
    ...(c.srcInferred ?? []).map((h) => `${h.path} (inferred, confidence ${h.confidence}, via ${h.via})`),
    ...(c.srcInherited?.paths ?? []).map((p) => `${p} (inherited from ${c.srcInherited!.from})`),
  ];
  const entities = c.entities ?? [];
  const head = [
    `- parent: ${c.parent ?? "(none)"}`,
    `- doc: ${doc}`,
    `- confidence: ${c.confidence}`,
    ...(c.aliases ? [`- aliases: ${c.aliases.join(", ")}`] : []),
    ...(c.description ? [`- description: ${c.description}`] : []),
  ];
  const parts = [
    `# Context: ${c.id}\n\n${head.join("\n")}`,
    `## Children\n${list(c.children.filter((x) => !entities.includes(x)))}`,
    ...(entities.length ? [`## Entities\n${list(entities)}`] : []),
    `## Appears in\n${list(c.appearsIn)}`,
    `## Scenarios\n${
      c.scenarios.length
        ? c.scenarios
            .map(
              (s) =>
                `### ${s.id} (${s.doc}${s.inferred ? ", inferred" : ""})\n` +
                s.steps.map((st, i) => `${i + 1}. ${st.from} -> ${st.to}: ${st.label}`).join("\n"),
            )
            .join("\n\n")
        : "- (none)"
    }`,
    `## Source\n${list(source)}`,
  ];
  if (c.docBody) parts.push(`## Doc\n${c.docBody}`);
  else if (c.prose) {
    parts.push(
      `## Nearest section (confidence ${c.prose.confidence})\n` +
        `${c.prose.file}:${c.prose.line}${c.prose.heading ? ` — ${c.prose.heading}` : ""}\n\n${c.prose.excerpt}`,
    );
  }
  return parts.join("\n\n") + "\n";
}

export function renderAllContexts(index: Index, folder: string): Record<string, string> {
  return Object.fromEntries(
    Object.keys(index.elements)
      .sort()
      .map((id) => [id, renderContextMarkdown(buildContext(index, folder, id))]),
  );
}
