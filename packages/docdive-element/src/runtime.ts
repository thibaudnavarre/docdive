import { hostTheme, THEME_ATTRS } from "./shared.js";

// Shared by <docdive-diagram> and <docdive-map>: data fetching, theme tokens and host-theme mirroring.

export const here = import.meta.url;
const cache = new Map<string, Promise<unknown>>();
export const getJson = <T>(url: string): Promise<T> => {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    });
    cache.set(url, p);
  }
  return p as Promise<T>;
};

const DARK_TOKENS =
  "--docdive-bg: #111113; --docdive-surface: #18181b; --docdive-surface-2: #1f1f23; --docdive-fg: #e4e4e7; --docdive-fg-muted: #9b9ba6; --docdive-border: #2e2e33; --docdive-accent: #818cf8; --docdive-on-accent: #111113; --docdive-selected: #38bdf8; --docdive-ok: #4ade80; --docdive-error: #f87171; --docdive-node-fill: #18181b; --docdive-node-stroke: #71717a; --docdive-edge: #a1a1aa; --docdive-shadow: 0 1px 2px rgb(0 0 0 / .4), 0 8px 24px -12px rgb(0 0 0 / .6);";

// The public styling API: every `--docdive-*` property, with its light default and dark override.
export const TOKEN_STYLE = `
:host {
  --docdive-bg: #fafafa; --docdive-surface: #fff; --docdive-surface-2: #f4f4f5; --docdive-fg: #18181b; --docdive-fg-muted: #6b6b76;
  --docdive-border: #e4e4e7; --docdive-accent: #4f46e5; --docdive-on-accent: #fff; --docdive-selected: #0284c7; --docdive-ok: #15803d; --docdive-error: #b91c1c;
  --docdive-node-fill: #fff; --docdive-node-stroke: #8e8e96; --docdive-edge: #71717a;
  --docdive-font: inherit; --docdive-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --docdive-radius: 14px; --docdive-space: 16px; --docdive-duration: 160ms;
  --docdive-shadow: 0 1px 2px rgb(0 0 0 / .04), 0 4px 16px -8px rgb(0 0 0 / .08);
  display: block; font-family: var(--docdive-font); color: var(--docdive-fg); line-height: 1.45;
}
@media (prefers-color-scheme: dark) { :host(:not([data-docdive-theme])) { ${DARK_TOKENS} } }
:host([data-docdive-theme="dark"]) { ${DARK_TOKENS} }
*, *::before, *::after { box-sizing: border-box; }
.chip { display: inline-flex; align-items: center; padding: .1em .7em; border-radius: 999px; background: var(--docdive-surface-2); border: 1px solid transparent; color: inherit; text-decoration: none; font: inherit; font-size: .86em; line-height: 1.6; cursor: default; }
:is(a, button).chip { cursor: pointer; }
:is(a, button).chip:hover { border-color: var(--docdive-accent); color: var(--docdive-accent); background: var(--docdive-surface-2); }
.kind { padding: .05em .6em; background: transparent; border-color: var(--docdive-border); color: var(--docdive-fg-muted); text-transform: uppercase; letter-spacing: .06em; font-size: .72em; font-weight: 600; }
.muted { color: var(--docdive-fg-muted); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--docdive-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

// Shadow DOM cannot see host attributes from CSS, so the host theme is mirrored onto the element as
// `data-docdive-theme`. Returns the disconnect function.
export function observeTheme(target: Element): () => void {
  const sync = (): void => {
    const theme = hostTheme(document);
    if (theme) target.setAttribute("data-docdive-theme", theme);
    else target.removeAttribute("data-docdive-theme");
  };
  sync();
  const observer = new MutationObserver(sync);
  const opts = { attributes: true, attributeFilter: THEME_ATTRS };
  observer.observe(document.documentElement, opts);
  if (document.body) observer.observe(document.body, opts);
  return () => observer.disconnect();
}
