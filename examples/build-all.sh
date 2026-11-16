#!/usr/bin/env bash
# Build both example sites with the docdive adapter. Needs `npm install` at the repo root once, and uv.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build --workspace docdive-element --workspace docdive

(cd examples/docusaurus && npx docusaurus build)
(cd examples/mkdocs && NO_MKDOCS_2_WARNING=1 uv run mkdocs build)
