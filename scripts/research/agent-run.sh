#!/usr/bin/env bash
# Isolation harness for the A4 agent test (docs/agent-findings.md).
#   agent-run.sh prepare <ni|tsup> <runName>   create the isolated dir, print its path and the prompt
#   agent-run.sh lint    <dir>                 lint (before the cycle): writes lint-1.json
#   agent-run.sh fix     <dir>                 lint --fix then lint again: writes fix.json, lint-2.json
#   agent-run.sh score   <dir>                 lint + stats of the final state: writes final.json
#   agent-run.sh leak    <dir> <transcript>    leak check: transcript and project manifest
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT="$ROOT"
DOCDIVE=(node "$ROOT/packages/docdive/dist/cli.js")
DOCS="docs/architecture"

# pinned targets: repo|sha
target() {
  case "$1" in
    ni) echo "antfu-collective/ni|71e261fd497c9e5f7bc925267ff249f5b9f9bc14" ;;
    tsup) echo "egoist/tsup|198479b814f5981032dc0b7cd52c4b9e4b699ac3" ;;
    *) echo "unknown target $1" >&2; return 1 ;;
  esac
}

manifest() {
  (cd "$PROJECT" && find docs packages -path "*/node_modules" -prune -o -type f -exec shasum {} + 2>/dev/null | sort -k2)
}

cmd="${1:?usage}"; shift
case "$cmd" in
  prepare)
    name="${1:?target}"; run="${2:?runName}"
    IFS='|' read -r repo sha <<<"$(target "$name")"
    work="$(mktemp -d "${TMPDIR:-/tmp}/agentrun-$name-$run-XXXXXX")"
    git clone --quiet --filter=blob:none --no-checkout "https://github.com/$repo.git" "$work/repo"
    git -C "$work/repo" fetch --quiet --depth 1 origin "$sha"
    git -C "$work/repo" checkout --quiet --force "$sha"
    rm -rf "$work/repo/.git"
    mkdir -p "$work/skill"
    cp "$ROOT/packages/docdive/skill/conventions.md" "$work/skill/conventions.md"
    shasum -a 256 "$work/skill/conventions.md" | cut -d' ' -f1 >"$work/skill.sha256"
    manifest >"$work/project-manifest.before"
    sed "s#{{WORKDIR}}#$work#g" "$ROOT/scripts/research/agent-prompt.md" >"$work/prompt.md"
    echo "$work"
    ;;
  lint)
    work="${1:?dir}"
    "${DOCDIVE[@]}" lint --json --root "$work/repo" --docs "$work/repo/$DOCS" >"$work/lint-1.json" || true
    cat "$work/lint-1.json"
    ;;
  fix)
    work="${1:?dir}"
    "${DOCDIVE[@]}" lint --fix --json --root "$work/repo" --docs "$work/repo/$DOCS" >"$work/fix.json" || true
    cp "$work/fix.json" "$work/lint-2.json"
    cat "$work/lint-2.json"
    ;;
  score)
    work="${1:?dir}"
    "${DOCDIVE[@]}" lint --json --root "$work/repo" --docs "$work/repo/$DOCS" >"$work/final-lint.json" || true
    "${DOCDIVE[@]}" stats --json --root "$work/repo" --docs "$work/repo/$DOCS" >"$work/final-stats.json"
    node -e '
      const w = process.argv[1], r = (f) => JSON.parse(require("fs").readFileSync(w + "/" + f, "utf8"));
      const l = r("final-lint.json"), s = r("final-stats.json");
      const out = { errors: l.errors.length, warnings: l.warnings.length, floorMet: s.floorMet, stats: s, pass: l.errors.length === 0 && s.floorMet };
      require("fs").writeFileSync(w + "/score.json", JSON.stringify(out, null, 2));
      console.log(JSON.stringify(out, null, 2));
    ' "$work"
    ;;
  leak)
    work="${1:?dir}"; transcript="${2:?transcript}"
    leaked=0
    if grep -nE "$PROJECT|MERMAID_ANIM|product-brief|agent-findings|/packages/docdive|\bdocdive\b" "$transcript"; then leaked=1; fi
    manifest >"$work/project-manifest.after"
    if ! diff -q "$work/project-manifest.before" "$work/project-manifest.after" >/dev/null; then
      diff "$work/project-manifest.before" "$work/project-manifest.after" || true
      leaked=1
    fi
    echo "{\"leak\": $([ $leaked = 1 ] && echo true || echo false)}" | tee "$work/leak.json"
    ;;
  *) echo "unknown command $cmd" >&2; exit 2 ;;
esac
