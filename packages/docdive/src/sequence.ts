export interface SequenceStep {
  from: string;
  to: string;
  label: string;
  isReturn: boolean;
}

export interface SequenceResult {
  participants: string[];
  steps: SequenceStep[];
  /** 1-based line within the source: `participant`/`actor` declaration, else first message mention. */
  lines: Record<string, number>;
}

const NAME = String.raw`[^\s:][^:]*?`;
const MESSAGE = new RegExp(String.raw`^\s*(${NAME})\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)[+-]?\s*(${NAME})\s*:\s*(.*)$`);
const DECL = new RegExp(String.raw`^\s*(?:create\s+)?(?:participant|actor)\s+(${NAME})(?:\s+as\s+.*)?\s*$`);
const IGNORED = /^\s*(%%|sequenceDiagram\b|title\b|accTitle\b|accDescr\b|autonumber\b|note\b|loop\b|alt\b|else\b|opt\b|par\b|and\b|critical\b|option\b|break\b|rect\b|end\b|activate\b|deactivate\b|destroy\b|box\b|links?\b|properties\b|details\b)/i;

export function extractSequence(source: string): SequenceResult {
  const participants: string[] = [];
  const steps: SequenceStep[] = [];
  const lines: Record<string, number> = {};
  const declared = new Set<string>();
  const add = (id: string, line: number, isDecl = false) => {
    if (!participants.includes(id)) participants.push(id);
    if (!(id in lines) || (isDecl && !declared.has(id))) lines[id] = line;
    if (isDecl) declared.add(id);
  };

  // Blank multi-line blocks but keep their newlines so line numbers stay true to the fence.
  const blank = (m: string) => m.replace(/[^\n]/g, "");
  const cleaned = source.replace(/%%\{[\s\S]*?\}%%/g, blank).replace(/^\s*accDescr\s*\{[^}]*\}/gm, blank);
  for (const [n, line] of cleaned.split("\n").entries()) {
    if (!line.trim()) continue;
    const decl = line.match(DECL);
    if (decl) {
      add(decl[1], n + 1, true);
      continue;
    }
    if (IGNORED.test(line)) continue;
    const m = line.match(MESSAGE);
    if (!m) throw new Error(`Unrecognised sequenceDiagram syntax: "${line.trim()}"`);
    const [, from, arrow, to, label] = m;
    add(from, n + 1);
    add(to, n + 1);
    steps.push({ from, to, label: label.trim(), isReturn: arrow.startsWith("--") });
  }
  return { participants, steps, lines };
}
