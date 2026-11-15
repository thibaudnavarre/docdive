export interface SequenceStep {
  from: string;
  to: string;
  label: string;
  isReturn: boolean;
}

export interface SequenceResult {
  participants: string[];
  steps: SequenceStep[];
}

const NAME = String.raw`[^\s:][^:]*?`;
const MESSAGE = new RegExp(String.raw`^\s*(${NAME})\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)[+-]?\s*(${NAME})\s*:\s*(.*)$`);
const DECL = new RegExp(String.raw`^\s*(?:create\s+)?(?:participant|actor)\s+(${NAME})(?:\s+as\s+.*)?\s*$`);
const IGNORED = /^\s*(%%|sequenceDiagram\b|title\b|accTitle\b|accDescr\b|autonumber\b|note\b|loop\b|alt\b|else\b|opt\b|par\b|and\b|critical\b|option\b|break\b|rect\b|end\b|activate\b|deactivate\b|destroy\b|box\b|links?\b|properties\b|details\b)/i;

export function extractSequence(source: string): SequenceResult {
  const participants: string[] = [];
  const steps: SequenceStep[] = [];
  const add = (id: string) => {
    if (!participants.includes(id)) participants.push(id);
  };

  const cleaned = source.replace(/%%\{[\s\S]*?\}%%/g, "").replace(/^\s*accDescr\s*\{[^}]*\}/gm, "");
  for (const line of cleaned.split("\n")) {
    if (!line.trim()) continue;
    const decl = line.match(DECL);
    if (decl) {
      add(decl[1]);
      continue;
    }
    if (IGNORED.test(line)) continue;
    const m = line.match(MESSAGE);
    if (!m) throw new Error(`Unrecognised sequenceDiagram syntax: "${line.trim()}"`);
    const [, from, arrow, to, label] = m;
    add(from);
    add(to);
    steps.push({ from, to, label: label.trim(), isReturn: arrow.startsWith("--") });
  }
  return { participants, steps };
}
