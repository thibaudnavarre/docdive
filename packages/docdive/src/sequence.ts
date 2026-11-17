/**
 * A `Note over A[,B]: …` is the state of its participants at the step it follows. The text is read as
 * `[Entity] key=value … [free text]`: a leading PascalCase word is the entity, `k=v` tokens are fields, the rest is text.
 */
export interface StateNote {
  over: string[];
  text: string;
  entity?: string;
  fields?: Record<string, string>;
}

export interface SequenceStep {
  from: string;
  to: string;
  label: string;
  isReturn: boolean;
  /** Notes written right after this message (state at this step). */
  notes?: StateNote[];
}

export interface SequenceResult {
  participants: string[];
  steps: SequenceStep[];
  /** 1-based line within the source: `participant`/`actor` declaration, else first message mention. */
  lines: Record<string, number>;
  /** Notes before the first message: the initial state. */
  initial?: StateNote[];
}

const NAME = String.raw`[^\s:][^:]*?`;
const MESSAGE = new RegExp(String.raw`^\s*(${NAME})\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)[+-]?\s*(${NAME})\s*:\s*(.*)$`);
const DECL = new RegExp(String.raw`^\s*(?:create\s+)?(?:participant|actor)\s+(${NAME})(?:\s+as\s+.*)?\s*$`);
const NOTE = /^\s*note\s+(?:over|left\s+of|right\s+of)\s+([^:]+?)\s*:\s*(.*)$/i;
const IGNORED = /^\s*(%%|sequenceDiagram\b|title\b|accTitle\b|accDescr\b|autonumber\b|loop\b|alt\b|else\b|opt\b|par\b|and\b|critical\b|option\b|break\b|rect\b|end\b|activate\b|deactivate\b|destroy\b|box\b|links?\b|properties\b|details\b)/i;

const ENTITY = /^[A-Z][A-Za-z0-9]*$/;
const FIELD = /^([A-Za-z_][\w.-]*)=(.+)$/;

/** `Order status=paid id=42 row in orders` → entity Order, fields {status, id}, text "row in orders". */
export function parseNote(over: string[], raw: string): StateNote {
  const tokens = raw.replace(/<br\s*\/?>/gi, " ").trim().split(/\s+/).filter(Boolean);
  const note: StateNote = { over, text: "" };
  const rest: string[] = [];
  tokens.forEach((t, i) => {
    const f = FIELD.exec(t);
    if (i === 0 && ENTITY.test(t)) note.entity = t;
    else if (f) (note.fields ??= {})[f[1] as string] = f[2] as string;
    else rest.push(t);
  });
  note.text = rest.join(" ");
  return note;
}

export function extractSequence(source: string): SequenceResult {
  const participants: string[] = [];
  const steps: SequenceStep[] = [];
  const lines: Record<string, number> = {};
  const initial: StateNote[] = [];
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
    const note = line.match(NOTE);
    if (note) {
      const over = (note[1] as string).split(",").map((p) => p.trim()).filter(Boolean);
      for (const p of over) add(p, n + 1);
      const last = steps.at(-1);
      (last ? (last.notes ??= []) : initial).push(parseNote(over, note[2] as string));
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
  return initial.length ? { participants, steps, lines, initial } : { participants, steps, lines };
}
