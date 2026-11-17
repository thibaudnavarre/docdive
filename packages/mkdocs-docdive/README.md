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
- `source_url`: template for the panel's Source link, with `{path}` (doc path relative to `docs_dir`) and `{line}`,
  e.g. `https://git.example.com/org/repo/src/main/docs/{path}#L{line}`. Wins over `edit_uri` (optional).

Selecting a node can show a **Source** link that opens the repo page at the Markdown line where the node is declared
(or first mentioned). The URL comes from MkDocs' `repo_url` + `edit_uri`: a GitHub `/edit/` or GitLab `/-/edit/` URL is
rewritten to its `/blob/` view with `#L<line>`. Other hosts need `source_url`. With neither, the link is hidden.

Overview page: write `<docdive-map></docdive-map>` in any Markdown page to show the element tree and the flows, each
linking to its page. The element script is loaded on every page, so no extra setup is needed.

Supports `mkdocs>=1.6,<2` and Python >= 3.11. MkDocs 2.0 has no plugin system and is not supported. MIT.
