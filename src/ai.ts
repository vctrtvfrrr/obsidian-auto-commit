import { type RequestUrlParam, requestUrl } from "obsidian";

async function callAnthropicApi(prompt: string, apiKey: string): Promise<string> {
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
      max_tokens: 100,
      temperature: 0.2,
      system:
        "You generate commit messages in English (US), in imperative mode, for a vault in Obsidian. Rules:\n" +
        "- A single line of up to 72 characters.\n" +
        "- No conventional prefixes (no \"feat:\", \"docs:\", etc.).\n" +
        "- Describe what changed concretely, citing files or areas when useful.\n" +
        "- If there are many heterogeneous changes, summarize the dominant theme.\n" +
        "- Any changes to the `.obsidian/` directory should not be detailed, only mentioned.\n" +
        "- Do not use quotation marks, backticks, or special characters. Just the message, without prefixes " +
        "like \"Message:\" or explanatory text.",
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
  apiKey: string
): Promise<string> {
  return callAnthropicApi(diff, apiKey);
}
