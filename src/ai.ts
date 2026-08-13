import { type RequestUrlParam, requestUrl } from "obsidian";
import { DEFAULT_COMMIT_STYLE } from "./settings";

const STRUCTURAL_RULES =
  "You generate commit messages for a vault in Obsidian. These structural rules are " +
  "absolute and override any conflicting style instruction below:\n" +
  "- A subject line of up to 80 characters.\n" +
  "- An optional body, separated from the subject by a blank line, hard wrapped at 80 " +
  "columns, with an unlimited number of lines. Omit the body when the change is trivial.\n" +
  "- No conventional commit prefixes (no \"feat:\", \"docs:\", etc.).\n" +
  "- Describe what changed concretely, citing files or areas when useful. Backticks around " +
  "file and directory names are allowed.\n" +
  "- If there are many heterogeneous changes, summarize the dominant theme.\n" +
  "- When the diff contains only `.obsidian/` changes, describe them coarsely (theme, " +
  "hotkeys, plugin configuration) in a subject line only, with no body.\n" +
  "- Output the message alone: no code fences, no decorative quotation marks, no preamble " +
  "such as \"Message:\".";

async function callAnthropicApi(
  prompt: string,
  apiKey: string,
  commitStyle: string
): Promise<string> {
  const req: RequestUrlParam = {
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      temperature: 0.2,
      system:
        STRUCTURAL_RULES +
        "\n\nWrite the message in the following language and writing style:\n" +
        commitStyle,
      messages: [{ role: "user", content: prompt }],
    }),
    throw: false,
  };

  const timeout = new Promise<never>((_, reject) =>
    window.setTimeout(() => reject(new Error("timeout")), 60_000)
  );

  console.debug("Auto-commit: calling Anthropic API");
  const res = await Promise.race([requestUrl(req), timeout]);
  console.debug(`Auto-commit: Anthropic API responded with status ${res.status}`);

  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

  return (res.json.content[0].text as string).trim();
}

export async function generateCommitMessage(
  diff: string,
  apiKey: string,
  commitStyle: string
): Promise<string> {
  return callAnthropicApi(diff, apiKey, commitStyle || DEFAULT_COMMIT_STYLE);
}
