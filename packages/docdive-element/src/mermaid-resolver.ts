export interface MermaidApi {
  render(id: string, text: string): Promise<{ svg: string }>;
  initialize?(config: Record<string, unknown>): void;
}

export type MermaidSource = "injected" | "window" | "bundled";

export interface ResolveOptions {
  /** A Mermaid instance, an ES module namespace exposing one as `default`, a promise of either, or a thunk returning one. */
  injected?: unknown;
  /** Object searched for a global `mermaid`. */
  win?: object;
  loadBundled: () => Promise<MermaidApi>;
}

const initialized = new WeakSet<object>();

export function isMermaidApi(value: unknown): value is MermaidApi {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
  // `<div id="mermaid">` makes `window.mermaid` a DOM element, which must never be mistaken for the library.
  if (typeof Element !== "undefined" && value instanceof Element) return false;
  return typeof (value as { render?: unknown }).render === "function";
}

async function unwrap(value: unknown): Promise<MermaidApi | undefined> {
  const settled = typeof value === "function" && !isMermaidApi(value) ? await (value as () => unknown)() : await value;
  if (isMermaidApi(settled)) return settled;
  const fallback = (settled as { default?: unknown } | null | undefined)?.default;
  return isMermaidApi(fallback) ? fallback : undefined;
}

/**
 * Picks the Mermaid to render with: injected host instance, then a valid `window.mermaid`, then the lazily
 * bundled copy. `initialize` is only ever called on the bundled copy, so a host's theme and config stay intact.
 */
export async function resolveMermaid(opts: ResolveOptions): Promise<{ mermaid: MermaidApi; source: MermaidSource }> {
  if (opts.injected !== undefined) {
    const mermaid = await unwrap(opts.injected).catch(() => undefined);
    if (mermaid) return { mermaid, source: "injected" };
  }
  const global = (opts.win as { mermaid?: unknown } | undefined)?.mermaid;
  if (isMermaidApi(global)) return { mermaid: global, source: "window" };
  const mermaid = await opts.loadBundled();
  if (!initialized.has(mermaid)) {
    initialized.add(mermaid);
    mermaid.initialize?.({ startOnLoad: false });
  }
  return { mermaid, source: "bundled" };
}
