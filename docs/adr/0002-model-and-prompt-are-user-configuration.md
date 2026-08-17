# ADR-0002: Model and prompt are user configuration; the plugin guarantees only the output contract

Status: accepted
Date: 2026-08-17

## Context

The plugin fixed the Anthropic model and almost the whole prompt in code. The user controlled a single line of free prose — the commit message style — while columns, the absence of conventional commit prefixes, the coarse treatment of `.obsidian/` changes and every other structural rule were the plugin author's decision.

Both halves of that turned out to be the wrong owner. Haiku 4.5 does not reliably respect the 80 column subject limit even with the rule stated explicitly in the prompt, and a user who wants a different model has no way to ask for one. A user who wants Conventional Commits, a 72 column subject, or a body on every commit has to edit the plugin source.

Deciding what a good commit message looks like belongs to whoever owns the repository history.

## Decision

Model, reasoning effort and the full prompt are user settings. The plugin retains exactly one non-editable guarantee: the **output contract** — the model's response is the commit message and nothing else, with no code fences, no decorative quotation marks and no preamble.

- The system prompt is the output contract (a constant in `ai.ts`) followed by the user's prompt. Everything that used to be a structural rule now lives in `DEFAULT_PROMPT` and is editable.
- `DEFAULT_PROMPT` is a placeholder for the settings field only. It is never written to disk and never used as a fallback — falling back to it would defeat the field being mandatory.
- An empty prompt blocks the commit before any Git command runs, surfaced as a failure state and tooltip in the status bar.

## Consequences

- **The output contract stays out of the user's reach, and that is the point of this record.** It is not style, it is the integration format between two processes: the response goes straight into `git commit -m`. A code fence there lands literally in the Git history, and the user discovers it only when reading `git log` later. A configuration mistake in a style rule produces an ugly message; a configuration mistake in the output contract produces a corrupted history. Do not "finish the job" by making the contract editable too.
- The contract is instructed, never verified after the fact. The response is trimmed and nothing else; there is no parsing that hunts for code fences. Validating would require deciding what to do on failure — reject, re-ask, truncate — and that is not justified for a personal vault.
- There is no migration from the old style field. Its value is discarded: it is a line of style, not a prompt, and composing one from the other would produce a half-baked prompt. Every install, new or upgraded, therefore starts blocked until the user writes a prompt.
- The default model stays Haiku 4.5, so upgrading never multiplies anyone's bill without warning. The reported 80 column defect therefore persists on the default path — the fix exists, but requires the user to open the settings and pick Sonnet 5 or Opus 5.
- Prompt quality stops being the plugin's problem. A bad prompt produces bad messages, and the plugin does not check whether the prompt asks for a coherent language, format or column limit.

ADR-0001 is untouched: nothing here changes what is sent to the API, only which model receives it and under which instructions.
