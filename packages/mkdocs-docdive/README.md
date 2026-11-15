# mkdocs-docdive

[docdive](https://github.com/thibaudnavarre/docdive) plugin for MkDocs: renders Mermaid fences as interactive
`<docdive-diagram>` elements and, after the build, writes the index and assets to `<site>/docdive/`.

```bash
pip install mkdocs-docdive
```

```yaml
# mkdocs.yml
site_url: https://example.com/docs/   # required
markdown_extensions:
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
plugins:
  - docdive
```

Options:

- `command`: how to run the docdive CLI. Default `npx --yes docdive@<this plugin's version>`; Node >= 22.12 is needed at
  build time.
- `src`: repo root that `src:` frontmatter paths are relative to (optional).

Supports `mkdocs>=1.6,<2` and Python >= 3.11. MkDocs 2.0 has no plugin system and is not supported. MIT.
