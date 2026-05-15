import { Notice } from "obsidian";
import type { TooltipKey } from "./tooltips";
import { generateCommitMessage } from "./ai";

export async function createCommit(
  cwd: string,
  apiKey: string
): Promise<{ ok: false; reason: TooltipKey } | { ok: "noChanges" } | null> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileP = promisify(execFile);
  let statusOut: string;
  try {
    const { stdout } = await execFileP("git", ["status", "--porcelain"], { cwd });
    statusOut = stdout;
  } catch {
    return { ok: false, reason: "failedGitStatus" };
  }

  if (!statusOut.trim()) return { ok: "noChanges" };

  await execFileP("git", ["add", "-A"], { cwd });

  const { stdout: diff } = await execFileP("git", ["diff", "--staged"], { cwd });

  if (diff.length > 50_000) {
    new Notice(
      "Auto-commit: diff exceeds 50 KB. Review and commit manually via terminal.",
      0
    );
    return { ok: false, reason: "failedDiffTooLarge" };
  }

  let message: string;
  try {
    message = await generateCommitMessage(diff, apiKey);
  } catch (err) {
    new Notice(
      "Auto-commit: failed to generate commit message (AI unavailable). Changes remain staged.",
      0
    );
    console.error("Auto-commit: AI error:", err);
    return { ok: false, reason: "failedAi" };
  }

  await execFileP("git", ["commit", "-m", message], { cwd });
  return null;
}
