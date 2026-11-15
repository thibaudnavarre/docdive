# COR Config

## Stack

TypeScript (Node) core (indexer/CLI + web component, Docusaurus theme) + thin Python MkDocs plugin

npm-workspaces monorepo (`packages/*`, `apps/*`, `examples/*`); run every check from the repo root. TypeScript is pinned to `~6.0` because typescript-eslint does not support TS 7 (no JS compiler API) yet. Ruff runs via `uvx` with the root `ruff.toml` (excludes `corpus`). The e2e suites (`npm run e2e`, `npm run e2e:ssg` after `npm run examples:build`) are not part of the checks: they need Playwright browsers and the example-site builds.

## Checks

npm run typecheck
npm run lint
npm test
uvx ruff check . --fix

## Worktree Support

disabled

## Auto Commit

manual

## Plan Storage

markdown

## Dependency Documentation

disabled

## Artifact Canvas

enabled
Path: .github/extensions/cor-artifacts/

## Extensions

copilot
