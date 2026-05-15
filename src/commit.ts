import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Notice, type RequestUrlParam, requestUrl } from "obsidian";
import type { TooltipKey } from "./tooltips";

const execFileP = promisify(execFile);

export async function createCommit(
  cwd: string,
  apiKey: string
): Promise<TooltipKey | null> {
  let statusOut: string;
  try {
    const { stdout } = await execFileP("git", ["status", "--porcelain"], { cwd });
    statusOut = stdout;
  } catch {
    return "failedGitStatus";
  }

  if (!statusOut.trim()) return "noChanges";

  await execFileP("git", ["add", "-A"], { cwd });

  const { stdout: diff } = await execFileP("git", ["diff", "--staged"], { cwd });

  if (diff.length > 50_000) {
    new Notice(
      "Auto-commit: diff > 50 KB, requer revisão manual. Resolva via terminal.",
      0
    );
    return "failedDiffTooLarge";
  }

  let message: string;
  try {
    message = await generateCommitMessage(diff, apiKey);
  } catch (err) {
    new Notice(
      "Auto-commit: falha ao gerar mensagem (IA indisponível). Mudanças continuam pendentes.",
      0
    );
    console.error("Auto-commit: AI error:", err);
    return "failedAi";
  }

  await execFileP("git", ["commit", "-m", message], { cwd });
  return null;
}

async function generateCommitMessage(diff: string, apiKey: string): Promise<string> {
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
      messages: [{ role: "user", content: diff }],
    }),
    throw: false,
  };

  const timeout = new Promise<never>((_, reject) =>
    window.setTimeout(() => reject(new Error("timeout")), 60_000)
  );

  const res = await Promise.race([requestUrl(req), timeout]);

  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

  return (res.json.content[0].text as string).trim();
}
