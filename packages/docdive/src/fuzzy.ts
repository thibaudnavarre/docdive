import type { Diagnostic, Element } from "./model.js";

export const normalise = (id: string) => id.toLowerCase().replace(/[-_.:/\s]+/g, "");
const stripDigits = (s: string) => s.replace(/\d+/g, "");

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, row[j]);
    }
    if (rowMin > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

export interface NearMiss {
  kind: "normalized" | "edit-distance";
  distance: number;
  confidence: number;
}

/** Whether two IDs probably name the same thing; the single definition shared by fuzzy proposals and lint. */
export function nearMiss(a: string, b: string): NearMiss | null {
  const na = normalise(a);
  const nb = normalise(b);
  if (na.length < 3 || nb.length < 3) return null;
  if (na === nb) return { kind: "normalized", distance: 0, confidence: 0.9 };
  if (na.length < 5 || nb.length < 5 || Math.abs(na.length - nb.length) > 2) return null;
  if (stripDigits(na) === stripDigits(nb)) return null;
  const max = Math.max(na.length, nb.length);
  const d = distance(na, nb, 2);
  if (d <= 2 && d / max <= 0.25) {
    return { kind: "edit-distance", distance: d, confidence: Math.round((0.8 * (1 - d / max)) * 100) / 100 };
  }
  return null;
}

const fileOf = (el: Element) => el.doc ?? el.appearsIn[0]?.slice(0, el.appearsIn[0].lastIndexOf("#")) ?? "";

/** Proposes (never merges) pairs of element IDs that probably name the same thing. */
export function proposeFuzzyIds(elements: Record<string, Element>): Diagnostic[] {
  const ids = Object.keys(elements).sort();
  const norm = new Map(ids.map((id) => [id, normalise(id)]));
  const out: Diagnostic[] = [];
  const byLength = new Map<number, string[]>();
  for (const id of ids) {
    const n = norm.get(id)!;
    byLength.set(n.length, [...(byLength.get(n.length) ?? []), id]);
  }

  const emit = (a: string, b: string, kind: string, dist: number, confidence: number) =>
    out.push({
      rule: "fuzzy-id-candidate",
      file: fileOf(elements[a]),
      a,
      b,
      kind,
      distance: dist,
      confidence,
    });

  for (const [i, a] of ids.entries()) {
    if (norm.get(a)!.length < 3) continue;
    for (const b of ids.slice(i + 1)) {
      const m = nearMiss(a, b);
      if (m) emit(a, b, m.kind, m.distance, m.confidence);
    }
  }
  return out;
}
