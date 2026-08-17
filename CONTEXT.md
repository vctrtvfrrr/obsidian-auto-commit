# Context

Glossary for this repo. Use these terms as defined here; avoid synonyms.

## Staged diff

Everything Git has staged and that will go into the commit. Always complete — it includes `.obsidian/`. The plugin never narrows what it commits.

## Payload

The subset of the staged diff sent to the Anthropic API to generate a commit message. It excludes `.obsidian/`, unless `.obsidian/` is the only thing that changed. The size limit is a property of the payload, not of the staged diff.

## Prompt

The instructions the user writes for the commit message: language, writing style, column limits, format — everything about the content of the message. Configured by the user and mandatory; with no prompt there is no commit. It is injected raw into the system prompt, after the output contract.

## Output contract

The one rule the plugin fixes and the user cannot edit: the model's response is the commit message and nothing else, with no code fences, no decorative quotation marks and no preamble. It is not style — it is the integration format between the model's response and `git commit -m`. It always precedes the prompt in the system prompt.

## Subject and body

The two parts of a generated commit message. The subject is the first line. The body is optional, separated from the subject by a blank line, and describes why the change happened. Their length and formatting are the user's choice, stated in the prompt.
