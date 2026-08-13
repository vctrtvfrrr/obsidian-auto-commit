# AGENTS.md

## Project overview

Obsidian plugin that auto-commits vault changes to Git. TypeScript, built with esbuild, published as `@vctrtvfrrr/obsidian-auto-commit`.

## Obsidian API constraints

- Never use `fetch()` for HTTP calls inside the plugin — it is blocked by CORS from `app://obsidian.md`. Always use `requestUrl` from the `obsidian` module.

## Code architecture

- `src/main.ts` is a thin orchestrator. All logic lives in `src/` modules (`src/settings.ts`, `src/tooltips.ts`, `src/guards.ts`, `src/commit.ts`, `src/remote.ts`, `src/ai.ts`). Do not collapse logic into `src/main.ts`.
- Functions that can fail return a `SyncResult` discriminated union (defined in `src/tooltips.ts`), not bare `TooltipKey | null`. Follow this pattern for new async functions.
- All status-bar tooltip strings are constants in `src/tooltips.ts`. New states must get an entry there — no inline strings elsewhere.

## Build

- esbuild with `platform: "node"`. Run `npm run typecheck && npm run build` before every commit.
- `main.js` is committed to the repo — this is an Obsidian plugin convention (users install by copying files). Do not add it to `.gitignore`.

## Versioning

- Version must stay in sync between `package.json` and `manifest.json`. Use `npm version` — the `version` script in `package.json` handles `manifest.json` via `jq`.

## Agent skills

### Issue tracker

Issues live in this repo's Gitea instance (`git.codelab.tec.br`), driven by the `tea` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
