export interface Subgraph {
  id: string;
  label: string;
  parent: string | null;
  /** Direct members: nodes and nested subgraph ids. */
  members: string[];
}

export interface FlowchartResult {
  nodes: string[];
  labels: Record<string, string>;
  edges: [string, string][];
  subgraphs: Subgraph[];
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
// Arrow with optional inline label: -->, ---, -.->, ==>, ~~~, --x, --o, -- text -->, -->|text|, --> |text|
const ARROW =
  /(?:--(?![->])[^\n]*?(?:-{2,}>|-{3,}|--[xo])|==(?![=>])[^\n]*?(?:==>|===)|-\.(?![-.])[^\n]*?\.->?|<?(?:-{2,}|={2,}|-\.+-?|~{3,})[>xo]?|\.-+>)(?:[ \t]*\|[^|]*\|)?\s*/y;
const SKIP =
  /^[ \t]*(?:%%|flowchart\b|graph\b|direction\b|classDef\b|class\b|style\b|linkStyle\b|click\b|accTitle\b|accDescr\b)/;

export function extractFlowchart(source: string): FlowchartResult {
  const src = source.replace(/%%\{[\s\S]*?\}%%/g, "");
  const nodes: string[] = [];
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
  const addNode = (id: string, label: string) => {
    if (!nodes.includes(id)) nodes.push(id);
    if (label !== id || !(id in labels)) labels[id] = label;
    const top = stack[stack.length - 1];
    if (top && id !== top.id && !owner.has(id)) {
      owner.set(id, top);
      top.members.push(id);
    }
  };
  const openSubgraph = (text: string) => {
    const titled = /^([^\s[]+)[ \t]*\[\s*"?(.*?)"?\s*\]$/.exec(text);
    const id = titled ? titled[1] : text.replace(/^"(.*)"$/, "$1");
    const sg: Subgraph = { id, label: titled ? titled[2] : id, parent: stack[stack.length - 1]?.id ?? null, members: [] };
    subgraphs.push(sg);
    addNode(id, sg.label);
    stack.push(sg);
  };

  const parseNode = (): string => {
    ID.lastIndex = i;
    const m = ID.exec(src);
    if (!m) throw new Error(`Unrecognised flowchart node syntax: "${lineAt(i)}" (at "${src.slice(i, i + 20)}")`);
    const id = m[0];
    i += id.length;
    let label = id;
    const shape = SHAPES.find(([open]) => src.startsWith(open, i));
    if (shape) {
      const [open, closers] = shape;
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
      label = /\blabel:\s*"([^"]*)"/.exec(src.slice(i, end))?.[1] ?? id;
      i = end + 1;
    }
    if (src[i] === "@") throw new Error(`Unrecognised flowchart node syntax: "${lineAt(i)}" (at "${src.slice(i - id.length, i + 20)}")`);
    addNode(id, label);
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
      openSubgraph(sg[1]);
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
  return { nodes, labels, edges, subgraphs };
}
