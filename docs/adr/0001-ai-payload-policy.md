# ADR-0001: Payload policy — exclude `.obsidian/`, abort instead of truncate

Status: accepted
Date: 2026-08-13

## Context

Obsidian rewrites files under `.obsidian/` (workspace layout, plugin caches, pane state) on almost every session. That churn is noise: it says nothing about what the user wrote, but it dominates the staged diff. With a single 50 KB budget covering the whole staged diff, a session that changed 3 KB of notes and 500 KB of `.obsidian/` was blocked — a persistent notice, no commit, and a trip to the terminal to fix by hand.

## Decision

The **payload** (what is sent to the AI) is separate from the **staged diff** (what is committed).

- The payload is `git diff --staged -- ':(exclude,top).obsidian/'`. It is assembled by Git, not by filtering diff text in TypeScript — hand parsing a format Git already knows how to filter is fragile.
- If that diff is empty, the payload is rebuilt as `git diff --staged -- .obsidian/`, so a configuration-only change still produces a message that describes something.
- The limit is 200 KB of UTF-8 **bytes**, measured on the final payload. Counting JavaScript string length instead would let a CJK vault through at three times the announced size.
- Above the limit the plugin aborts: persistent notice, everything stays staged, no commit.
- An empty payload means nothing was staged — `git status` reports changes `git add -A` cannot stage, such as a submodule with a dirty worktree — so the run ends as "no changes" without calling the AI.
- `git add -A` and `git commit` are untouched. `.obsidian/` is always committed.

## Consequences

- A mixed change (notes plus configuration) produces a message that describes only the notes. The configuration changes ride along silently. Injecting a synthetic note into the payload was considered and rejected as ceremony.
- Configuration noise no longer consumes the budget, so legitimate commits stop being blocked by it.
- **Truncating the payload was rejected.** A truncated payload yields a message that describes less than the commit contains — a history that lies is worse than a commit the user has to write by hand.
