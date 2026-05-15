import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Notice } from "obsidian";
import type { TooltipKey } from "./tooltips";
import { generateCommitMessage } from "./ai";

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
