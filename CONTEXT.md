# Context

Glossary for this repo. Use these terms as defined here; avoid synonyms.

## Staged diff

Everything Git has staged and that will go into the commit. Always complete — it includes `.obsidian/`. The plugin never narrows what it commits.

## Payload

The subset of the staged diff sent to the Anthropic API to generate a commit message. It excludes `.obsidian/`, unless `.obsidian/` is the only thing that changed. The size limit is a property of the payload, not of the staged diff.

## Commit message style

Free prose, configured by the user, describing the language and the writing style of generated messages (for example `日本語` or `Português Brasileiro, presente do indicativo`). It governs wording only. The structural rules of the message are fixed by the plugin and take precedence.

## Subject and body

The two parts of a generated commit message. The subject is the first line. The body is optional, separated from the subject by a blank line, and describes why the change happened. Both are hard wrapped at 80 columns.
