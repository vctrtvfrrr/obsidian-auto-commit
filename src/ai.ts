import { type RequestUrlParam, requestUrl } from "obsidian";
import { type AiConfig, DEFAULT_MODEL, findModel } from "./settings";

// The only guarantee the plugin keeps for itself. This is not style, it is the
// integration format between two processes: the response goes straight into
// `git commit -m`, and a code fence there lands literally in the Git history.
const OUTPUT_CONTRACT =
  "Your entire response is the commit message and nothing else. No code fences, no " +
  "decorative quotation marks, no preamble such as \"Message:\", no commentary before " +
  "or after the message.";

const MAX_TOKENS = 8192;

async function callAnthropicApi(diff: string, ai: AiConfig): Promise<string> {
  const model = findModel(ai.model) ?? findModel(DEFAULT_MODEL)!;

  const payload: Record<string, unknown> = {
    model: model.id,
    max_tokens: MAX_TOKENS,
    system: OUTPUT_CONTRACT + "\n\n" + ai.prompt,
    messages: [{ role: "user", content: diff }],
  };
  if (model.supportsEffort) payload.output_config = { effort: ai.effort };
  if (model.supportsThinking) payload.thinking = { type: "adaptive" };

  const req: RequestUrlParam = {
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ai.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    throw: false,
  };

  const timeout = new Promise<never>((_, reject) =>
    window.setTimeout(() => reject(new Error("timeout")), 60_000)
  );

  console.debug(`Auto-commit: calling Anthropic API (${model.id})`);
  const res = await Promise.race([requestUrl(req), timeout]);
  console.debug(`Auto-commit: Anthropic API responded with status ${res.status}`);

  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

  // With thinking enabled the response opens with thinking blocks, so the message is
  // not necessarily at index 0.
  const blocks: unknown = res.json?.content;
  const text = Array.isArray(blocks)
    ? blocks.find((b) => b?.type === "text")
    : undefined;
  if (typeof text?.text !== "string") throw new Error("no text block in response");

  return (text.text as string).trim();
}

export async function generateCommitMessage(
  diff: string,
  ai: AiConfig
): Promise<string> {
  return callAnthropicApi(diff, ai);
}
