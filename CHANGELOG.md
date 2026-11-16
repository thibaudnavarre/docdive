# Changelog

## Unreleased

- `<docdive-diagram>`: "Copy link" in the panel copies the page URL with `docdive-select=<id>` (plus `docdive-scenario` / `docdive-step` when a trace is active). Opening it reselects the element and restores the trace paused. An ID not in the diagram is ignored.
- `docdive.config.json` (`docs`, `src`, `out`): defaults for `index`, `build` and `watch`; the `<folder>` argument and flags win.
- `<docdive-diagram>` checks the `index.json` `version` and shows a clear error when it is not the one it reads. The schema policy is in `docs/releasing.md`.
- Releases are published from CI on a `v*` tag with npm and PyPI trusted publishing (no tokens, no 2FA prompt).

## 0.2.0 - 2026-11-16

- `docdive watch <folder> --out <dir>`: runs `build`, then rewrites `index.json` and `contexts.json` on every `.md` / `.mdx` change. Ctrl-C exits 0; exits 1 if the docs folder disappears.
- `watch` no longer exits when the first build fails: it logs the error, still copies the element assets, and recovers on the next save.
- `docusaurus-theme-docdive`: `docusaurus start` now serves the docdive assets and data (via `docdive watch`). Reload the page after a Markdown edit to see fresh data. Production builds are unchanged.
- `build` now writes `index.json` and `contexts.json` atomically (temp file, then rename).

## 0.1.0 - 2026-11-16

First public release: `docdive`, `docdive-element`, `docusaurus-theme-docdive` (npm) and `mkdocs-docdive` (PyPI).

- `docdive` CLI (`docdive`, `ddv`): `index`, `build`, `init`, `lint` (`--fix`), `stats`, `context`; exit codes 0 / 1 / 2, diagnostics on stderr, `--help`, `--version`.
- `<docdive-diagram>` element: ID mapping, info panel, deep dive, scenario trace, copy context. Uses the host's Mermaid (injected instance, then `window.mermaid`), falling back to a bundled Mermaid 12.
- Docusaurus 3.10 theme and MkDocs 1.6 plugin; removing either restores the site's native Mermaid.
- Requires Node >= 22.12 and, for the MkDocs plugin, Python >= 3.11. MkDocs 2.0 is not supported.
