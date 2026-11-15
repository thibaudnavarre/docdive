#!/usr/bin/env bash
# Sparse-clones the pinned brownfield corpora into corpus/<name>/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS="$ROOT/corpus"
mkdir -p "$CORPUS"

# name|repo|path|sha
REPOS=(
  "gitlabhq|gitlabhq/gitlabhq|doc|d7b9a6176ab4e279465ba3ee09922cde2b74de47"
  "temporal|temporalio/documentation|docs|882a9dececd9ddcf7d3e18d4934b191c7e82a161"
  "posthog|PostHog/posthog.com|contents|bdf3ff26372578def9794105bc79b61d194f92a1"
)

for entry in "${REPOS[@]}"; do
  IFS='|' read -r name repo path sha <<<"$entry"
  dest="$CORPUS/$name"
  if [ ! -d "$dest/.git" ]; then
    git clone --quiet --filter=blob:none --no-checkout "https://github.com/$repo.git" "$dest"
  fi
  git -C "$dest" sparse-checkout set --cone "$path"
  git -C "$dest" fetch --quiet --depth 1 origin "$sha"
  git -C "$dest" checkout --quiet --force "$sha"
  echo "$name  $repo  $path  $(git -C "$dest" rev-parse HEAD)"
done
