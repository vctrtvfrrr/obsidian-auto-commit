# Issue tracker: Gitea (via `tea`)

Issues and specs for this repo live in the self-hosted Gitea instance at `https://git.codelab.tec.br` (repo `vctrtvfrrr/obsidian-auto-commit`). Use the [`tea`](https://gitea.com/gitea/tea) CLI for all operations — there is no `gh`/`glab` here, and no MCP server for this Gitea.

Always pass `--login vctrtvfrrr`. `tea` infers the repo from the `origin` remote when run inside the clone.

## Conventions

- **Create an issue**: `tea issues create --login vctrtvfrrr --title "..." --description "$(cat body.md)"`. There is no `--body` flag and `tea` does not read the description from stdin, so write multi-line bodies to a temp file first and interpolate it with `$(cat ...)`.
- **Read an issue**: `tea issues <index> --login vctrtvfrrr --comments`
- **List issues**: `tea issues list --login vctrtvfrrr --state open --fields index,title,state,labels,author`. Filter with `--labels`, `--state all|open|closed`, `--assignee`, `--keyword`. Add `--output json` for parsing.
- **Comment on an issue**: `tea comment <index> --login vctrtvfrrr < body.md` — **deliver the body on stdin, never as an argument**. Passed as an argument, `tea` blocks waiting on a stdin that never arrives in a non-interactive session and the comment is never published.
- **Apply / remove labels**: `tea issues edit <index> --login vctrtvfrrr --add-labels "..."` / `--remove-labels "..."`
- **Close**: `tea issues close <index> --login vctrtvfrrr`, then post the closing rationale as a separate comment (`tea issues close` takes no comment flag).
- **Create a missing label**: `tea labels create --login vctrtvfrrr --name "..." --color "..." --description "..."`. This repo starts with no labels defined, so expect to create them on first use.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `tea pulls` equivalents: `tea pulls <index> --comments`, `tea pulls list`, `tea comment <index>` (shared with issues), `tea pulls edit <index> --add-labels`, `tea pulls close <index>`. Gitea shares one index space across issues and PRs, so a bare `#42` may be either — resolve with `tea pulls 42` and fall back to `tea issues 42`. `tea` exposes no author-association field, so filter external contributors by comparing the author against the repo's collaborators.

## When a skill says "publish to the issue tracker"

Create a Gitea issue with `tea issues create`.

## When a skill says "fetch the relevant ticket"

Run `tea issues <index> --login vctrtvfrrr --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets. `tea` exposes no sub-issue or dependency commands, so both relationships live in issue bodies:

- **Map**: an issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: an issue with `Part of #<map>` as the first line of its body, plus a task-list entry in the map body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, assigned to the driving dev.
- **Blocking**: a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every listed blocker is closed — check each with `tea issues <n>`.
- **Frontier query**: read the map's task list, `tea issues list --state open` to keep only open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `tea issues edit <n> --login vctrtvfrrr --add-assignees vctrtvfrrr` — the session's first write.
- **Resolve**: `tea comment <n> --login vctrtvfrrr < answer.md`, then `tea issues close <n>`, then append a context pointer to the map's Decisions-so-far.
