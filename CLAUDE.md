# CLAUDE.md

## Project overview

Obsidian plugin that auto-commits vault changes to Git. TypeScript, built with esbuild, published as `@vctrtvfrrr/obsidian-auto-commit`.

## Infrastructure

- Hosted on **Gitea** at `git.codelab.tec.br` (not GitHub). Use `GITEA_TOKEN` for CI auth; clone auth format is `TOKEN:x-oauth-basic@host`.
- `GITEA_API_TOKEN` is available in `.claude/settings.local.json` env. Read it from there directly rather than relying on env inheritance.
- npm package is published to the private Gitea npm registry, not npmjs.com.

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

## Commits

Conventional Commits style: `feat:`, `fix:`, `refact:`, `chore:`, etc. Pass commit messages via HEREDOC.

## Plans and specs

Design documents live at `https://git.codelab.tec.br/vctrtvfrrr/obsidian/src/branch/master/Projetos/Plugin%20Obsidian%20-%20Auto%20Commit`. When asked to align implementation with a plan, read the relevant file from that repository.
