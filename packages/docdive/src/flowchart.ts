export interface Subgraph {
  id: string;
  label: string;
  /** Direct members: nodes and nested subgraph ids. */
  members: string[];
}

export interface FlowchartResult {
  nodes: string[];
  labels: Record<string, string>;
  edges: [string, string][];
  subgraphs: Subgraph[];
  /** 1-based line within the source: first declaration with a label (shape, subgraph), else first mention. */
  lines: Record<string, number>;
}

const ID = /\w(?:\w|-(?=\w)|::?(?=\w)|\.(?=\w))*/y;
// [opener, accepted closers]; longest openers first so `((` wins over `(`
const SHAPES: [string, string[]][] = [
  ["(((", [")))"]],
  ["((", ["))"]],
  ["([", ["])"]],
  ["[(", [")]"]],
  ["[[", ["]]"]],
  ["{{", ["}}"]],
  ["[/", ["/]", "\\]"]],
  ["[\\", ["\\]", "/]"]],
  [">", ["]"]],
  ["[", ["]"]],
  ["(", [")"]],
  ["{", ["}"]],
];
const NESTING: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
// Arrow with optional inline label: -->, ---, -.->, ==>, ~~~, --x, ---x, --o, -- text -->, -->|text|, --> |text|,
// each optionally bidirectional or crossed at the start (<-->, <-. text .->, x--x, o--o); quoted text may span lines
const TEXT = `(?:"[^"]*"|[^\\n"])*?`;
const ARROW = new RegExp(
  `(?:[xo<]?--(?![->])${TEXT}(?:-{2,}[>xo]|-{3,})|[xo<]?==(?![=>])${TEXT}(?:={2,}[>xo]|={3,})|[xo<]?-\\.(?![-.])${TEXT}\\.-[>xo]?|[xo<]?(?:-{2,}|={2,}|-\\.+-?|~{3,})[>xo]?|\\.-+>)(?:[ \\t]*\\|[^|]*\\|)?\\s*`,
  "y",
);
const SKIP =
  /^[ \t]*(?:%%|flowchart\b|graph\b|direction\b|classDef\b|class\b|style\b|linkStyle\b|click\b|accTitle\b|accDescr\b)/;

export function extractFlowchart(source: string): FlowchartResult {
  // Blank the directive but keep its newlines so line numbers stay true to the fence.
  const src = source.replace(/%%\{[\s\S]*?\}%%/g, (m) => m.replace(/[^\n]/g, ""));
  const nodes: string[] = [];
  const lines: Record<string, number> = {};
  const declared = new Set<string>();
  const labels: Record<string, string> = {};
  const edges: [string, string][] = [];
  const subgraphs: Subgraph[] = [];
  const stack: Subgraph[] = [];
  const owner = new Map<string, Subgraph>();
  let i = 0;

  const lineAt = (pos: number) => {
    const start = src.lastIndexOf("\n", pos - 1) + 1;
    const end = src.indexOf("\n", pos);
    return src.slice(start, end < 0 ? src.length : end).trim();
  };
  const eol = (pos: number) => {
    const end = src.indexOf("\n", pos);
    return end < 0 ? src.length : end;
  };
  const skipBlanks = () => {
    while (i < src.length && /[ \t]/.test(src[i])) i++;
    if (src.startsWith("%%", i)) i = eol(i);
  };
  const lineNo = (pos: number) => src.slice(0, pos).split("\n").length;
  const addNode = (id: string, label: string, pos: number, isDecl: boolean) => {
    if (!nodes.includes(id)) nodes.push(id);
    if (!(id in lines) || (isDecl && !declared.has(id))) lines[id] = lineNo(pos);
    if (isDecl) declared.add(id);
    if (label !== id || !(id in labels)) labels[id] = label;
    const top = stack[stack.length - 1];
    if (top && id !== top.id && !owner.has(id)) {
      owner.set(id, top);
      top.members.push(id);
    }
  };
  const openSubgraph = (text: string, pos: number) => {
    const titled = /^([^\s[]+)[ \t]*\[\s*"?(.*?)"?\s*\]$/.exec(text);
    const id = titled ? titled[1] : text.replace(/^"(.*)"$/, "$1");
    const sg: Subgraph = { id, label: titled ? titled[2] : id, members: [] };
    subgraphs.push(sg);
    addNode(id, sg.label, pos, true);
    stack.push(sg);
  };

  const parseNode = (): string => {
    ID.lastIndex = i;
    const m = ID.exec(src);
    if (!m) throw new Error(`Unrecognised flowchart node syntax: "${lineAt(i)}" (at "${src.slice(i, i + 20)}")`);
    const id = m[0];
    const pos = i;
    let isDecl = false;
    i += id.length;
    let label = id;
    const shape = SHAPES.find(([open]) => src.startsWith(open, i));
    if (shape) {
      const [open, closers] = shape;
      isDecl = true;
      i += open.length;
      label = parseShapeBody(open, closers);
    }
    if (src.startsWith(":::", i)) {
      const cls = /^:::[\w-]+/.exec(src.slice(i));
      if (!cls) throw new Error(`Unrecognised flowchart syntax: "${lineAt(i)}" (at "${src.slice(i, i + 20)}")`);
      i += cls[0].length;
    }
    if (src[i] === "@" && src[i + 1] === "{") {
      const end = src.indexOf("}", i);
      if (end < 0) throw new Error(`Unrecognised flowchart node syntax: "${lineAt(i)}" (at "${src.slice(i, i + 20)}")`);
      isDecl = true;
      label = /\blabel:\s*"([^"]*)"/.exec(src.slice(i, end))?.[1] ?? id;
      i = end + 1;
    }
    if (src[i] === "@") throw new Error(`Unrecognised flowchart node syntax: "${lineAt(i)}" (at "${src.slice(i - id.length, i + 20)}")`);
    addNode(id, label, pos, isDecl);
    return id;
  };

  const parseShapeBody = (open: string, closers: string[]): string => {
    const start = i;
    const fail = () => new Error(`Unsupported node shape: "${lineAt(start)}" (at "${src.slice(start - open.length, start + 20)}")`);
    while (src[i] === " ") i++;
    if (src[i] === '"') {
      const end = src.indexOf('"', i + 1);
      if (end < 0) throw fail();
      const text = src.slice(i + 1, end);
      i = end + 1;
      while (src[i] === " ") i++;
      const closer = closers.find((c) => src.startsWith(c, i));
      if (!closer) throw fail();
      i += closer.length;
      return text;
    }
    const nestOpen = open[open.length - 1];
    const nestClose = NESTING[nestOpen];
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      const closer = depth === 0 ? closers.find((c) => src.startsWith(c, j)) : undefined;
      if (closer) {
        const text = src.slice(i, j).trim();
        i = j + closer.length;
        return text;
      }
      if (nestClose && src[j] === nestOpen) depth++;
      else if (nestClose && src[j] === nestClose && depth > 0) depth--;
    }
    throw fail();
  };

  const parseGroup = (): string[] => {
    const group = [parseNode()];
    skipBlanks();
    while (src[i] === "&") {
      i++;
      skipBlanks();
      group.push(parseNode());
      skipBlanks();
    }
    return group;
  };

  while (i < src.length) {
    while (i < src.length && /[\s;]/.test(src[i])) i++;
    if (i >= src.length) break;
    const lineEnd = eol(i);
    const line = src.slice(i, lineEnd);
    const sg = /^[ \t]*subgraph\b[ \t]*(.*?)[ \t]*;?$/.exec(line);
    if (sg && sg[1]) {
      openSubgraph(sg[1], i);
      i = lineEnd;
      continue;
    }
    if (/^[ \t]*end[ \t]*;?[ \t]*$/.test(line)) {
      stack.pop();
      i = lineEnd;
      continue;
    }
    if (SKIP.test(line)) {
      i = /^[ \t]*accDescr[ \t]*\{/.test(line) && !line.includes("}") ? eol(src.indexOf("}", i) + 1) : lineEnd;
      continue;
    }
    let prev: string[] | null = null;
    for (;;) {
      const group = parseGroup();
      if (prev) for (const p of prev) for (const g of group) edges.push([p, g]);
      prev = group;
      skipBlanks();
      if (i >= src.length || src[i] === "\n" || src[i] === ";" || src[i] === "\r") break;
      ARROW.lastIndex = i;
      const arrow = ARROW.exec(src);
      if (!arrow) throw new Error(`Unrecognised flowchart syntax: "${lineAt(i)}" (at "${src.slice(i, i + 20).trim()}")`);
      i += arrow[0].length;
    }
  }
  return { nodes, labels, edges, subgraphs, lines };
}
