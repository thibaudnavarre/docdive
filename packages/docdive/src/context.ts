import { loadDocs } from "./loader.js";
import type { Index } from "./model.js";
import type { Prose } from "./prose.js";

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
  };
}

export function renderContextMarkdown(c: ContextBundle): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)");
  const parts = [
    `# Context: ${c.id}\n\n- parent: ${c.parent ?? "(none)"}\n- doc: ${c.doc ?? "(none)"}\n- confidence: ${c.confidence}`,
    `## Children\n${list(c.children)}`,
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
    `## Source\n${list(c.src)}`,
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
