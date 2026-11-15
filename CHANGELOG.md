# Changelog

## 0.1.0 - 2026-11-16

First public release: `docdive`, `docdive-element`, `docusaurus-theme-docdive` (npm) and `mkdocs-docdive` (PyPI).

- `docdive` CLI (`docdive`, `ddv`): `index`, `build`, `init`, `lint` (`--fix`), `stats`, `context`; exit codes 0 / 1 / 2, diagnostics on stderr, `--help`, `--version`.
- `<docdive-diagram>` element: ID mapping, info panel, deep dive, scenario trace, copy context. Uses the host's Mermaid (injected instance, then `window.mermaid`), falling back to a bundled Mermaid 12.
- Docusaurus 3.10 theme and MkDocs 1.6 plugin; removing either restores the site's native Mermaid.
- Requires Node >= 22.12 and, for the MkDocs plugin, Python >= 3.11. MkDocs 2.0 is not supported.
