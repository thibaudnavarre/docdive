#!/usr/bin/env bash
# Build both example sites, with and without the docdive adapter. Run from anywhere; needs `npm install` at the
# repo root once. Records the Docusaurus exit status and log for the S7 check.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build --workspace docdive-element --workspace docdive

cd examples/docusaurus
status=0
npx docusaurus build >build.log 2>&1 || status=$?
echo "$status" >build.status
cat build.log
[ "$status" -eq 0 ]
DOCDIVE_ADAPTER=off npx docusaurus build --out-dir build-plain
DOCDIVE_HOST_MERMAID=11 npx docusaurus build --out-dir build-mermaid11

cd ../mkdocs
export NO_MKDOCS_2_WARNING=1
uv run mkdocs build
uv run mkdocs build -f mkdocs-plain.yml
