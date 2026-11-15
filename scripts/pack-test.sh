#!/usr/bin/env bash
# Pack-and-install test: builds the npm tarballs and the MkDocs wheel, installs them into fresh Docusaurus and
# MkDocs sites outside the workspace (no symlinks), builds both, then runs e2e/packed.pw.ts against the results.
# Needs network (npm, PyPI) and uv. Usage: scripts/pack-test.sh [workdir]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(cd "${1:-$(mktemp -d)}" && pwd)"
echo "pack-test workdir: $WORK"

cd "$ROOT"
npm run build
mkdir -p "$WORK/tarballs"
for pkg in docdive-element docdive docusaurus-theme-docdive; do
  npm pack --workspace "$pkg" --pack-destination "$WORK/tarballs" >/dev/null
done
(cd packages/mkdocs-docdive && rm -rf dist && uv build --out-dir "$WORK/tarballs" >/dev/null)
TARBALLS=("$WORK"/tarballs/docdive-element-*.tgz "$WORK"/tarballs/docdive-0*.tgz "$WORK"/tarballs/docusaurus-theme-docdive-*.tgz)
WHEEL=("$WORK"/tarballs/mkdocs_docdive-*.whl)

# The CLI installed from the tarballs, for the MkDocs plugin's `command` option.
mkdir -p "$WORK/cli"
(cd "$WORK/cli" && npm init -y >/dev/null && npm install --no-audit --no-fund "${TARBALLS[@]}")
CLI="$WORK/cli/node_modules/docdive/dist/cli.js"

# Docusaurus site.
SITE="$WORK/docusaurus"
mkdir -p "$SITE"
cp -R "$ROOT/fixtures/toy" "$SITE/docs"
cp "$ROOT"/scripts/pack-test/package.json "$ROOT"/scripts/pack-test/docusaurus.config.js "$SITE/"
(cd "$SITE" && npm install --no-audit --no-fund "${TARBALLS[@]}" && npm run build)

# MkDocs site.
SITE="$WORK/mkdocs"
mkdir -p "$SITE"
cp -R "$ROOT/fixtures/toy" "$SITE/docs"
sed "s#{{CLI}}#$CLI#" "$ROOT/scripts/pack-test/mkdocs.yml" >"$SITE/mkdocs.yml"
(cd "$SITE" && NO_MKDOCS_2_WARNING=1 uv run --no-project --with mkdocs-material==9.8.1 --with "${WHEEL[0]}" mkdocs build)

cd "$ROOT"
PACK_DIR="$WORK" npx playwright test -c playwright.packed.config.ts
